-- Security review fixes. Anyone who signs up gets a household of their own, so a
-- parent account can't be trusted to reach only their own data by accident:
--   1. A phone number belongs to one nanny, so another household can't add the same
--      number and use "new setup link" to wipe its wrong-PIN count.
--   2. A bad time zone is refused, and one household's failure can't stop the
--      scheduler for the others.
--   3. A row can't point at another household's child or outfit.

-- ---------------------------------------------------------------------------
-- 1. One nanny per phone number
-- ---------------------------------------------------------------------------
create unique index members_nanny_phone_key on public.members (phone) where role = 'nanny';

-- A nanny's login is derived from their number, so it can't be edited afterwards.
revoke update (phone) on public.members from authenticated;

create or replace function public.add_nanny(p_display_name text, p_phone text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if not private.is_parent() then
    raise exception 'only parents can add a nanny' using errcode = '42501';
  end if;

  insert into public.members (household_id, role, display_name, phone, setup_token, setup_token_expires_at)
  values (private.my_household_id(), 'nanny', p_display_name, p_phone, v_token, now() + interval '7 days');
  return v_token;
exception when unique_violation then
  raise exception 'That phone number is already set up in PREP.' using errcode = '23505';
end $$;

-- ---------------------------------------------------------------------------
-- 2. Time zones and the scheduler
-- ---------------------------------------------------------------------------
create function private.check_household_timezone() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'That time zone isn''t recognised.' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger households_check_timezone before insert or update of timezone on public.households
  for each row execute function private.check_household_timezone();

-- Same as before, with each household and each overdue alert in its own block.
create or replace function public.run_scheduler() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  h public.households;
  s public.prep_sessions;
  a public.activities;
  v_local timestamp;
  v_today date;
  v_released int := 0;
  v_overdue int := 0;
  v_child text;
  v_lead text;
begin
  for h in select * from public.households loop
    begin
      v_local := now() at time zone h.timezone;
      v_today := v_local::date;

      -- 1. Release tomorrow's prep between release time and the deadline.
      if v_local::time >= h.prep_release_time and v_local::time < h.prep_deadline_time
         and exists (select 1 from public.children where household_id = h.id)
         and not exists (select 1 from public.prep_sessions where household_id = h.id and for_date = v_today + 1) then
        if private.release_prep(h.id, v_today + 1) is not null then
          v_released := v_released + 1;
        end if;
      end if;

      -- 2. Nudge if nothing has been ticked by the nudge time.
      if h.prep_nudge_time is not null and v_local::time >= h.prep_nudge_time
         and v_local::time < h.prep_deadline_time then
        select * into s from public.prep_sessions
         where household_id = h.id and for_date = v_today + 1 and status = 'pending';
        if found and not exists (select 1 from public.prep_items where session_id = s.id and checked_at is not null) then
          perform private.notify_role(
            h.id, 'nanny', 'prep_nudge', 'prep_nudge:' || s.id,
            'Time to start tonight''s prep',
            format('Nothing is ticked yet. Prep for %s is due by %s.',
                   private.fmt_day(s.for_date), private.fmt_time(h.prep_deadline_time)),
            '/nanny');
        end if;
      end if;

      -- 4. Activity reminders, lead minutes before each of today's activities.
      for a in
        select * from public.activities
         where household_id = h.id and active and weekday = extract(isodow from v_today)
           and v_local::time >= start_time - make_interval(mins => h.activity_lead_minutes)
           and v_local::time < start_time
      loop
        select name into v_child from public.children where id = a.child_id;
        v_lead := format('%s: %s at %s. Leave by %s.%s',
          v_child, a.title, private.fmt_time(a.start_time),
          private.fmt_time(a.start_time - make_interval(mins => h.leave_buffer_minutes)),
          case when cardinality(a.bring) > 0 then ' Bring ' || lower(private.join_names(a.bring)) || '.' else '' end);
        perform private.notify_role(h.id, 'nanny', 'activity', 'activity:' || a.id || ':' || v_today,
                                    a.title || ' soon', v_lead, '/nanny/alerts');
        if h.notify_parents_activities then
          perform private.notify_role(h.id, 'parent', 'activity', 'activity:' || a.id || ':' || v_today,
                                      a.title || ' soon', v_lead, '/parent');
        end if;
      end loop;
    exception when others then
      raise warning 'run_scheduler: household % skipped: %', h.id, sqlerrm;
    end;
  end loop;

  -- 3. Deadline: mark pending sessions overdue. Only recent misses are announced,
  --    so a scheduler outage doesn't send stale alerts later.
  for s in
    update public.prep_sessions set status = 'overdue'
     where status = 'pending' and now() >= deadline_at
    returning *
  loop
    v_overdue := v_overdue + 1;
    if now() - s.deadline_at < interval '2 hours' then
      begin
        perform private.notify_overdue(s.id);
      exception when others then
        raise warning 'run_scheduler: overdue alert for session % skipped: %', s.id, sqlerrm;
      end;
    end if;
  end loop;

  return jsonb_build_object('released', v_released, 'overdue', v_overdue);
end $$;

-- ---------------------------------------------------------------------------
-- 3. No references across households
-- ---------------------------------------------------------------------------
create function private.check_activity_child() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.children where id = new.child_id and household_id = new.household_id) then
    raise exception 'That child isn''t in this household.' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger activities_check_child before insert or update of child_id, household_id on public.activities
  for each row execute function private.check_activity_child();

-- weekly_routine and overrides: the outfit must belong to the child's household.
create function private.check_child_outfit() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.outfit_id is not null and not exists (
       select 1 from public.children c
       join public.outfits o on o.household_id = c.household_id
       where c.id = new.child_id and o.id = new.outfit_id) then
    raise exception 'That outfit isn''t in this household.' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger weekly_routine_check_outfit before insert or update of child_id, outfit_id on public.weekly_routine
  for each row execute function private.check_child_outfit();

create trigger overrides_check_outfit before insert or update of child_id, outfit_id on public.overrides
  for each row execute function private.check_child_outfit();

create function private.check_item_child() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
       select 1 from public.prep_sessions s
       join public.children c on c.household_id = s.household_id
       where s.id = new.session_id and c.id = new.child_id) then
    raise exception 'That child isn''t in this household.' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger prep_items_check_child before insert or update of session_id, child_id on public.prep_items
  for each row execute function private.check_item_child();

-- Same as before, but only this household's activities count.
create or replace function private.desired_prep_items(p_household uuid, p_date date, p_children uuid[] default null)
returns table (child_id uuid, label text, group_label text, sort int)
language sql stable security definer set search_path = ''
as $$
  with kids as (
    select c.id from public.children c
    where c.household_id = p_household and (p_children is null or c.id = any (p_children))
  ),
  outfit_items as (
    select k.id as child_id, u.item as label, o.name as group_label, u.ord::int as sort
    from kids k
    join public.outfits o on o.id = private.resolve_outfit(k.id, p_date)
    cross join lateral unnest(o.items) with ordinality as u(item, ord)
  ),
  acts as (
    select a.*, row_number() over (partition by a.child_id order by a.start_time, a.title) as n
    from public.activities a
    join kids k on k.id = a.child_id
    where a.household_id = p_household and a.active and a.weekday = extract(isodow from p_date)
  ),
  activity_items as (
    select a.child_id, u.item as label, a.title || ' · ' || private.fmt_time(a.start_time) as group_label,
           (100 * a.n + u.ord)::int as sort
    from acts a
    cross join lateral unnest(a.bring) with ordinality as u(item, ord)
  ),
  extra_items as (
    select o.child_id, u.item as label, coalesce(nullif(o.note, ''), 'Extras') as group_label,
           (900 + u.ord)::int as sort
    from public.overrides o
    join kids k on k.id = o.child_id
    cross join lateral unnest(o.extra_items) with ordinality as u(item, ord)
    where o.on_date = p_date
  ),
  all_items as (
    select * from outfit_items
    union all select * from activity_items
    union all select * from extra_items
  )
  select distinct on (child_id, group_label, label) child_id, label, group_label, sort
  from all_items
  where btrim(label) <> ''
  order by child_id, group_label, label, sort
$$;
