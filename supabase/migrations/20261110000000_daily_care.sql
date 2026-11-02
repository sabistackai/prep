-- Daily care, care cards and the weekly summary.
--
-- Daily care: each child has a timed schedule for every day of the week (meals, bath,
-- nap, medicine, homework, bedtime). Each day the schedule is copied into care_log, which
-- the nanny ticks off. She is reminded care_lead_minutes before each item (default 30).
-- If an item isn't ticked by its due time, the parents are alerted and the nanny gets a
-- firmer push. Items due at the same time go out as one push.
--
-- Care cards: allergies, medicines, the doctor and other notes per child, plus the
-- household's emergency contacts. Parents edit them; nannies can read them.
--
-- Weekly summary: weekly_summary() for the parents' dashboard, and a push to the
-- parents every Monday morning about the week before.

alter table public.households
  add column care_lead_minutes int not null default 30 check (care_lead_minutes between 0 and 240),
  add column notify_parents_care_late boolean not null default true,
  add column notify_parents_weekly boolean not null default true;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.care_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  child_id uuid not null references public.children on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),   -- 1 = Monday (ISO)
  at_time time not null,
  kind text not null default 'other'
    check (kind in ('meal', 'bath', 'nap', 'medicine', 'homework', 'play', 'bedtime', 'other')),
  title text not null check (btrim(title) <> '' and length(title) <= 80),
  details text check (length(details) <= 300),                -- "Rice and stew", "5 ml Calpol"
  school_days_only boolean not null default false,             -- skipped on holidays
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.care_items (household_id, weekday);
create index on public.care_items (child_id);

-- One row per scheduled item per day. Rows are written by the server only.
create table public.care_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  child_id uuid not null references public.children on delete cascade,
  item_id uuid references public.care_items on delete set null,
  for_date date not null,
  due_at timestamptz not null,
  kind text not null,
  title text not null,
  details text,
  done_at timestamptz,
  done_by uuid references public.members on delete set null,
  skipped_at timestamptz,                 -- a parent took it off for the day
  skipped_by uuid references public.members on delete set null,
  reminded_at timestamptz,
  late_notified_at timestamptz,
  unique (item_id, for_date)
);
create index on public.care_log (household_id, for_date);
create index on public.care_log (due_at) where done_at is null and skipped_at is null;
create index on public.care_log (child_id);

-- Days whose schedule has been copied into care_log.
create table public.care_days (
  household_id uuid references public.households on delete cascade,
  for_date date,
  built_at timestamptz not null default now(),
  primary key (household_id, for_date)
);

create table public.care_cards (
  child_id uuid primary key references public.children on delete cascade,
  allergies text,
  avoid_foods text,
  conditions text,
  medicines text,
  doctor_name text,
  doctor_phone text,
  hospital text,
  blood_group text,
  notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.members on delete set null,
  check (length(allergies) <= 500 and length(avoid_foods) <= 500 and length(conditions) <= 500
         and length(medicines) <= 500 and length(notes) <= 1000 and length(doctor_name) <= 100
         and length(doctor_phone) <= 30 and length(hospital) <= 150 and length(blood_group) <= 10)
);

create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  name text not null check (btrim(name) <> '' and length(name) <= 80),
  relation text check (length(relation) <= 60),
  phone text not null check (btrim(phone) <> '' and length(phone) <= 30),
  sort int not null default 0
);
create index on public.emergency_contacts (household_id);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.care_items enable row level security;
alter table public.care_log enable row level security;
alter table public.care_days enable row level security;
alter table public.care_cards enable row level security;
alter table public.emergency_contacts enable row level security;

revoke all on public.care_items, public.care_log, public.care_days, public.care_cards,
              public.emergency_contacts from anon;

-- Schedule and contacts: parents read and write, nannies read.
do $$
declare t text;
begin
  foreach t in array array['care_items', 'emergency_contacts'] loop
    execute format(
      'create policy "household read" on public.%I for select to authenticated
         using (household_id = (select private.my_household_id()))', t);
    execute format(
      'create policy "parents write" on public.%I for all to authenticated
         using (household_id = (select private.my_household_id()) and (select private.is_parent()))
         with check (household_id = (select private.my_household_id()) and (select private.is_parent()))', t);
  end loop;
end $$;

-- Care cards: the same rules, via the child's household.
create policy "household read" on public.care_cards for select to authenticated
  using (exists (select 1 from public.children c
                 where c.id = child_id and c.household_id = (select private.my_household_id())));
create policy "parents write" on public.care_cards for all to authenticated
  using ((select private.is_parent()) and exists (select 1 from public.children c
         where c.id = child_id and c.household_id = (select private.my_household_id())))
  with check ((select private.is_parent()) and exists (select 1 from public.children c
         where c.id = child_id and c.household_id = (select private.my_household_id())));

-- The day's log: everyone in the household reads it; changes go through tick_care() and skip_care().
create policy "household read" on public.care_log for select to authenticated
  using (household_id = (select private.my_household_id()));
revoke insert, update, delete on public.care_log from authenticated;

-- care_days is internal: no policies, no grants.
revoke all on public.care_days from authenticated;

-- An item can't point at another household's child.
create trigger care_items_check_child before insert or update of child_id, household_id on public.care_items
  for each row execute function private.check_activity_child();

-- Who last changed a care card.
create function private.stamp_care_card() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(private.my_member_id(), new.updated_by);
  return new;
end $$;

create trigger care_cards_stamp before insert or update on public.care_cards
  for each row execute function private.stamp_care_card();

-- ---------------------------------------------------------------------------
-- Building each day's log
-- ---------------------------------------------------------------------------
create function private.is_holiday(p_household uuid, p_date date) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.holidays
                 where household_id = p_household and p_date between starts_on and ends_on)
$$;

-- What the schedule says for a household on a date.
create function private.desired_care(p_household uuid, p_date date)
returns table (item_id uuid, child_id uuid, kind text, title text, details text, due_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select ci.id, ci.child_id, ci.kind, btrim(ci.title), nullif(btrim(ci.details), ''),
         (p_date + ci.at_time) at time zone h.timezone
  from public.care_items ci
  join public.households h on h.id = ci.household_id
  join public.children c on c.id = ci.child_id and c.household_id = ci.household_id
  where ci.household_id = p_household and ci.active
    and ci.weekday = extract(isodow from p_date)
    and not (ci.school_days_only and private.is_holiday(p_household, p_date))
$$;

-- Bring a day's log in line with the schedule. Done and skipped rows stay as they are.
-- Open rows follow edits; one whose time changes gets its reminders again.
create function private.sync_care_day(p_household uuid, p_date date) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.care_log l
   where l.household_id = p_household and l.for_date = p_date
     and l.done_at is null and l.skipped_at is null
     and (l.item_id is null
          or not exists (select 1 from private.desired_care(p_household, p_date) d where d.item_id = l.item_id));

  update public.care_log l
     set kind = d.kind, title = d.title, details = d.details, due_at = d.due_at,
         reminded_at = case when l.due_at = d.due_at then l.reminded_at end,
         late_notified_at = case when l.due_at = d.due_at then l.late_notified_at end
    from private.desired_care(p_household, p_date) d
   where l.item_id = d.item_id and l.for_date = p_date
     and l.done_at is null and l.skipped_at is null
     and (l.kind, l.title, l.details, l.due_at) is distinct from (d.kind, d.title, d.details, d.due_at);

  insert into public.care_log (household_id, child_id, item_id, for_date, due_at, kind, title, details)
  select p_household, d.child_id, d.item_id, p_date, d.due_at, d.kind, d.title, d.details
  from private.desired_care(p_household, p_date) d
  where not exists (select 1 from public.care_log l where l.item_id = d.item_id and l.for_date = p_date);
end $$;

-- Schedule or holiday edits show up in today's log straight away.
create function private.sync_care_today(p_household uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_tz text;
begin
  select timezone into v_tz from public.households where id = p_household;
  if v_tz is not null then
    perform private.sync_care_day(p_household, (now() at time zone v_tz)::date);
  end if;
end $$;

create function private.on_care_schedule_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    perform private.sync_care_today(old.household_id);
  end if;
  if tg_op <> 'DELETE' and (tg_op = 'INSERT' or new.household_id <> old.household_id) then
    perform private.sync_care_today(new.household_id);
  end if;
  return null;
end $$;

create trigger care_items_sync after insert or update or delete on public.care_items
  for each row execute function private.on_care_schedule_change();
create trigger holidays_sync_care after insert or update or delete on public.holidays
  for each row execute function private.on_care_schedule_change();

-- ---------------------------------------------------------------------------
-- Wording helpers
-- ---------------------------------------------------------------------------

-- ('Ada', 'Lunch') -> 'Ada''s lunch'
create function private.care_phrase(p_child text, p_title text) returns text
language sql immutable set search_path = ''
as $$ select p_child || '''s ' || lower(left(p_title, 1)) || substr(p_title, 2) $$;

-- 'was' / 'were', 'isn''t' / 'aren''t'
create function private.plural(p_n int, p_one text, p_many text) returns text
language sql immutable set search_path = ''
as $$ select case when p_n = 1 then p_one else p_many end $$;

-- ---------------------------------------------------------------------------
-- Weekly summary
-- ---------------------------------------------------------------------------

-- A Monday-to-Sunday week. Prep nights are counted by the day they were for.
-- Care items: on time if ticked within the minute they were due; skipped items don't count.
create function private.week_summary(p_household uuid, p_start date) returns jsonb
language sql stable security definer set search_path = ''
as $$
  with days as (
    select (p_start + n)::date as day from generate_series(0, 6) as n
  ),
  prep as (
    select s.for_date, s.completed_at, s.deadline_at,
           case when s.status = 'complete' and s.completed_at <= s.deadline_at then 'on_time'
                when s.status = 'complete' then 'late'
                when now() >= s.deadline_at then 'missed'
                else 'pending' end as result
    from public.prep_sessions s
    where s.household_id = p_household and s.for_date between p_start and p_start + 6
      and exists (select 1 from public.prep_items i where i.session_id = s.id)
  ),
  care as (
    select l.*,
           case when l.skipped_at is not null then 'skipped'
                when l.done_at is not null and l.done_at < l.due_at + interval '1 minute' then 'on_time'
                when l.done_at is not null then 'late'
                when now() >= l.due_at + interval '1 minute' then 'missed'
                else 'upcoming' end as result
    from public.care_log l
    where l.household_id = p_household and l.for_date between p_start and p_start + 6
  ),
  tz as (select timezone from public.households where id = p_household),
  task as (
    select t.*,
           case when t.due_at is null then (case when t.done_at is not null then 'done' end)
                when t.done_at is not null and t.done_at < t.due_at + interval '1 minute' then 'on_time'
                when t.done_at is not null then 'late'
                when now() >= t.due_at then 'open_overdue'
           end as result
    from public.tasks t, tz
    where t.household_id = p_household
      and (case when t.due_at is not null then (t.due_at at time zone tz.timezone)::date
                else (t.done_at at time zone tz.timezone)::date end) between p_start and p_start + 6
  )
  select jsonb_build_object(
    'start', p_start,
    'end', p_start + 6,
    'prep', jsonb_build_object(
      'on_time', (select count(*) from prep where result = 'on_time'),
      'late', (select count(*) from prep where result = 'late'),
      'missed', (select count(*) from prep where result = 'missed'),
      'pending', (select count(*) from prep where result = 'pending'),
      'nights', coalesce((select jsonb_agg(jsonb_build_object(
                    'date', d.day, 'result', p.result, 'completed_at', p.completed_at, 'deadline_at', p.deadline_at)
                  order by d.day)
                  from days d left join prep p on p.for_date = d.day), '[]'::jsonb)),
    'care', jsonb_build_object(
      'on_time', (select count(*) from care where result = 'on_time'),
      'late', (select count(*) from care where result = 'late'),
      'missed', (select count(*) from care where result = 'missed'),
      'skipped', (select count(*) from care where result = 'skipped'),
      'upcoming', (select count(*) from care where result = 'upcoming'),
      'days', coalesce((select jsonb_agg(jsonb_build_object(
                  'date', d.day,
                  'on_time', (select count(*) from care c where c.for_date = d.day and c.result = 'on_time'),
                  'late', (select count(*) from care c where c.for_date = d.day and c.result = 'late'),
                  'missed', (select count(*) from care c where c.for_date = d.day and c.result = 'missed'),
                  'upcoming', (select count(*) from care c where c.for_date = d.day and c.result = 'upcoming'))
                order by d.day) from days d), '[]'::jsonb),
      'children', coalesce((select jsonb_agg(jsonb_build_object(
                      'id', ch.id, 'name', ch.name, 'color', ch.color,
                      'on_time', (select count(*) from care c where c.child_id = ch.id and c.result = 'on_time'),
                      'late', (select count(*) from care c where c.child_id = ch.id and c.result = 'late'),
                      'missed', (select count(*) from care c where c.child_id = ch.id and c.result = 'missed'))
                    order by ch.sort, ch.name)
                    from public.children ch
                    where ch.household_id = p_household
                      and exists (select 1 from care c where c.child_id = ch.id and c.result <> 'skipped')), '[]'::jsonb),
      'trouble', coalesce((select jsonb_agg(x order by x.missed + x.late desc, x.title)
                   from (select ch.name as child, c.title,
                                count(*) filter (where c.result = 'late') as late,
                                count(*) filter (where c.result = 'missed') as missed
                         from care c join public.children ch on ch.id = c.child_id
                         where c.result in ('late', 'missed')
                         group by ch.name, c.title
                         order by count(*) desc, ch.name, c.title
                         limit 3) x), '[]'::jsonb)),
    'tasks', jsonb_build_object(
      'on_time', (select count(*) from task where result = 'on_time'),
      'late', (select count(*) from task where result = 'late'),
      'open_overdue', (select count(*) from task where result = 'open_overdue'),
      'done_no_due', (select count(*) from task where result = 'done'))
  )
$$;

-- Parents: the summary for the week containing p_day (default: this week).
create function public.weekly_summary(p_day date default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  h public.households;
  v_day date;
begin
  if not private.is_parent() then
    raise exception 'Only parents can see the weekly summary.' using errcode = '42501';
  end if;
  select * into h from public.households where id = private.my_household_id();
  v_day := coalesce(p_day, (now() at time zone h.timezone)::date);
  return private.week_summary(h.id, v_day - (extract(isodow from v_day)::int - 1));
end $$;

-- The Monday push: one short paragraph about last week, or nothing if it was empty.
create function private.weekly_summary_text(p_summary jsonb) returns text
language plpgsql immutable set search_path = ''
as $$
declare
  p jsonb := p_summary -> 'prep';
  c jsonb := p_summary -> 'care';
  t jsonb := p_summary -> 'tasks';
  v_nights int := (p ->> 'on_time')::int + (p ->> 'late')::int + (p ->> 'missed')::int;
  v_care int := (c ->> 'on_time')::int + (c ->> 'late')::int + (c ->> 'missed')::int;
  v_tasks int := (t ->> 'on_time')::int + (t ->> 'late')::int + (t ->> 'open_overdue')::int + (t ->> 'done_no_due')::int;
  v_parts text[] := '{}';
begin
  if v_nights > 0 then
    v_parts := v_parts || format('Evening prep was on time %s of %s %s.',
                                 p ->> 'on_time', v_nights, private.plural(v_nights, 'night', 'nights'));
  end if;
  if v_care > 0 then
    v_parts := v_parts || format('Daily care: %s of %s on time, %s late, %s not ticked.',
                                 c ->> 'on_time', v_care, c ->> 'late', c ->> 'missed');
  end if;
  if v_tasks > 0 then
    v_parts := v_parts || format('Tasks: %s done%s%s.',
      (t ->> 'on_time')::int + (t ->> 'late')::int + (t ->> 'done_no_due')::int,
      case when (t ->> 'late')::int > 0 then format(', %s late', t ->> 'late') else '' end,
      case when (t ->> 'open_overdue')::int > 0 then format(', %s still open', t ->> 'open_overdue') else '' end);
  end if;
  if cardinality(v_parts) = 0 then
    return null;
  end if;
  return array_to_string(v_parts, ' ');
end $$;

-- ---------------------------------------------------------------------------
-- Scheduler (pg_cron, every minute)
-- ---------------------------------------------------------------------------
create function private.run_care_scheduler() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  h public.households;
  g record;
  v_local timestamp;
  v_today date;
  v_time text;
  v_built int := 0;
  v_reminders int := 0;
  v_late int := 0;
  v_week date;
  v_text text;
begin
  for h in select * from public.households loop
    begin
      v_local := now() at time zone h.timezone;
      v_today := v_local::date;

      -- 1. Copy today's schedule into the log, once a day.
      insert into public.care_days (household_id, for_date) values (h.id, v_today) on conflict do nothing;
      if found then
        perform private.sync_care_day(h.id, v_today);
        v_built := v_built + 1;
      end if;

      -- 2. Remind the nanny, lead minutes before (one push per due time).
      for g in
        select l.due_at, array_agg(l.id order by c.sort, c.name, l.title) as ids,
               string_agg(c.name || ': ' || l.title || coalesce(' (' || l.details || ')', ''), '. '
                          order by c.sort, c.name, l.title) as lines
        from public.care_log l join public.children c on c.id = l.child_id
        where l.household_id = h.id and l.done_at is null and l.skipped_at is null and l.reminded_at is null
          and now() >= l.due_at - make_interval(mins => h.care_lead_minutes)
          and now() < l.due_at + interval '1 minute'
        group by l.due_at
      loop
        v_time := private.fmt_time((g.due_at at time zone h.timezone)::time);
        perform private.notify_role(h.id, 'nanny', 'care_due', 'care_due:' || g.ids[1] || ':' || extract(epoch from g.due_at)::bigint,
                                    'Coming up at ' || v_time, g.lines || '.', '/nanny/today');
        update public.care_log set reminded_at = now() where id = any (g.ids);
        v_reminders := v_reminders + 1;
      end loop;

      -- 3. Not ticked by the due time: tell the parents and the nanny. Only recent misses,
      --    so a scheduler outage doesn't send stale alerts later.
      for g in
        select l.due_at, array_agg(l.id order by c.sort, c.name, l.title) as ids,
               array_agg(private.care_phrase(c.name, l.title) order by c.sort, c.name, l.title) as phrases
        from public.care_log l join public.children c on c.id = l.child_id
        where l.household_id = h.id and l.done_at is null and l.skipped_at is null and l.late_notified_at is null
          and now() >= l.due_at + interval '1 minute'
          and now() < l.due_at + interval '2 hours'
        group by l.due_at
      loop
        v_time := private.fmt_time((g.due_at at time zone h.timezone)::time);
        if h.notify_parents_care_late then
          perform private.notify_role(
            h.id, 'parent', 'care_late', 'care_late:' || g.ids[1] || ':' || extract(epoch from g.due_at)::bigint,
            'Running late',
            format('%s %s due at %s and %s ticked yet.', private.join_names(g.phrases),
                   private.plural(cardinality(g.phrases), 'was', 'were'), v_time,
                   private.plural(cardinality(g.phrases), 'isn''t', 'aren''t')),
            '/parent');
        end if;
        perform private.notify_role(
          h.id, 'nanny', 'care_late', 'care_late:' || g.ids[1] || ':' || extract(epoch from g.due_at)::bigint,
          'Running late',
          format('%s %s due at %s. %s', private.join_names(g.phrases),
                 private.plural(cardinality(g.phrases), 'was', 'were'), v_time,
                 case when h.notify_parents_care_late
                      then format('%s %s been told. Tick it off as soon as it''s done.', private.parent_names(h.id),
                                  private.plural((select count(*)::int from public.members
                                                  where household_id = h.id and role = 'parent'), 'has', 'have'))
                      else 'Tick it off as soon as it''s done.' end),
          '/nanny/today');
        update public.care_log set late_notified_at = now() where id = any (g.ids);
        v_late := v_late + 1;
      end loop;

      -- 4. Monday morning: last week's summary for the parents.
      if h.notify_parents_weekly and extract(isodow from v_today) = 1
         and v_local::time >= '08:00' and v_local::time < '12:00' then
        v_week := v_today - 7;
        if not exists (select 1 from public.notifications
                       where household_id = h.id and dedupe_key = 'weekly:' || v_week) then
          v_text := private.weekly_summary_text(private.week_summary(h.id, v_week));
          if v_text is not null then
            perform private.notify_role(h.id, 'parent', 'weekly', 'weekly:' || v_week,
                                        'Last week at a glance', v_text, '/parent/week?day=' || v_week);
          end if;
        end if;
      end if;
    exception when others then
      raise warning 'run_care_scheduler: household % skipped: %', h.id, sqlerrm;
    end;
  end loop;

  return jsonb_build_object('built', v_built, 'reminders', v_reminders, 'late', v_late);
end $$;

select cron.schedule('prep-care', '* * * * *', 'select private.run_care_scheduler()');

-- ---------------------------------------------------------------------------
-- RPCs for the app
-- ---------------------------------------------------------------------------

-- Tick or untick a care item (parents and nannies). Idempotent for offline replays;
-- p_at is when the tick was made, ignored if in the future or over 12 hours old.
create function public.tick_care(p_id uuid, p_done boolean, p_at timestamptz default null)
returns public.care_log
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.care_log;
  v_at timestamptz := case when p_at between now() - interval '12 hours' and now() then p_at else now() end;
begin
  update public.care_log
     set done_at = case when p_done then coalesce(done_at, v_at) end,
         done_by = case when p_done then coalesce(done_by, private.my_member_id()) end
   where id = p_id and household_id = private.my_household_id() and skipped_at is null
  returning * into v_row;

  if v_row.id is null then
    raise exception 'item not found' using errcode = 'P0002';
  end if;
  return v_row;
end $$;

-- Parent: take an item off for the day ("Ada is at Grandma's"), or put it back.
create function public.skip_care(p_id uuid, p_skip boolean) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_parent() then
    raise exception 'Only parents can skip an item.' using errcode = '42501';
  end if;
  update public.care_log
     set skipped_at = case when p_skip then coalesce(skipped_at, now()) end,
         skipped_by = case when p_skip then coalesce(skipped_by, private.my_member_id()) end
   where id = p_id and household_id = private.my_household_id() and done_at is null;
  if not found then
    raise exception 'item not found' using errcode = 'P0002';
  end if;
end $$;

-- Parent: make other days match one day's schedule (for one child, or all of them).
-- The other days' items are replaced. Returns the number of items copied.
create function public.copy_care_day(p_from int, p_to int[], p_child uuid default null) returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_house uuid := private.my_household_id();
  v_to int[];
  n int;
begin
  if not private.is_parent() then
    raise exception 'Only parents can change the schedule.' using errcode = '42501';
  end if;
  select coalesce(array_agg(distinct d), '{}') into v_to from unnest(p_to) d where d between 1 and 7 and d <> p_from;
  if p_from not between 1 and 7 or cardinality(v_to) = 0 then
    raise exception 'Pick the days to copy to.' using errcode = '23514';
  end if;
  if p_child is not null and not exists (select 1 from public.children where id = p_child and household_id = v_house) then
    raise exception 'That child isn''t in this household.' using errcode = '23514';
  end if;

  delete from public.care_items
   where household_id = v_house and weekday = any (v_to) and (p_child is null or child_id = p_child);

  insert into public.care_items (household_id, child_id, weekday, at_time, kind, title, details, school_days_only, active)
  select v_house, ci.child_id, d, ci.at_time, ci.kind, ci.title, ci.details, ci.school_days_only, ci.active
  from public.care_items ci cross join unnest(v_to) as d
  where ci.household_id = v_house and ci.weekday = p_from and (p_child is null or ci.child_id = p_child);
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function
  public.tick_care(uuid, boolean, timestamptz), public.skip_care(uuid, boolean),
  public.copy_care_day(int, int[], uuid), public.weekly_summary(date)
from public, anon;
grant execute on function
  public.tick_care(uuid, boolean, timestamptz), public.skip_care(uuid, boolean),
  public.copy_care_day(int, int[], uuid), public.weekly_summary(date)
to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: parents watch the day's ticks live
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.care_log;
