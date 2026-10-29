-- Week 2: the prep engine, scheduler and notification outbox.
--
-- Producers (the scheduler, triggers) only INSERT into public.notifications;
-- the unique (member_id, dedupe_key) keeps every send idempotent. An insert
-- trigger asks the send-notification Edge Function (via pg_net) to deliver it,
-- and a sweep retries anything left undelivered.
--
-- The function URL and shared secret live in Vault, set per environment:
--   select vault.create_secret('<functions base url>', 'prep_functions_url');
--   select vault.create_secret('<PREP_FUNCTIONS_SECRET>', 'prep_functions_secret');

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- ---------------------------------------------------------------------------
-- Notification outbox
-- ---------------------------------------------------------------------------
alter table public.notifications
  add column delivered_at timestamptz,
  add column attempts int not null default 0,
  add column delivery jsonb;                 -- what happened per channel
create index on public.notifications (sent_at) where delivered_at is null;

create function private.secret(p_name text) returns text
language sql stable security definer set search_path = ''
as $$ select decrypted_secret from vault.decrypted_secrets where name = p_name $$;

create function private.call_send_notification(p_body jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text := private.secret('prep_functions_url');
  v_secret text := private.secret('prep_functions_secret');
begin
  if v_url is null or v_secret is null then
    return;  -- not configured (e.g. tests): rows wait for the sweep
  end if;
  perform net.http_post(
    url := v_url || '/send-notification',
    body := p_body,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-prep-secret', v_secret),
    timeout_milliseconds := 15000
  );
end $$;

create function private.dispatch_notification() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.call_send_notification(jsonb_build_object('id', new.id));
  return null;
end $$;

create trigger notifications_dispatch after insert on public.notifications
  for each row execute function private.dispatch_notification();

-- Queue one notification; returns its id, or null if this key was already sent to this member.
create function private.notify(
  p_member uuid, p_kind text, p_key text, p_title text, p_body text,
  p_link text default null, p_channels text[] default '{push}'
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.notifications (household_id, member_id, kind, dedupe_key, title, body, link, channels)
  select m.household_id, m.id, p_kind, p_key, p_title, p_body, p_link, p_channels
  from public.members m where m.id = p_member
  on conflict (member_id, dedupe_key) do nothing
  returning id into v_id;
  return v_id;
end $$;

create function private.notify_role(
  p_household uuid, p_role public.member_role, p_kind text, p_key text, p_title text, p_body text,
  p_link text default null, p_channels text[] default '{push}'
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.notify(m.id, p_kind, p_key, p_title, p_body, p_link, p_channels)
  from public.members m where m.household_id = p_household and m.role = p_role;
end $$;

-- ---------------------------------------------------------------------------
-- Formatting helpers
-- ---------------------------------------------------------------------------
create function private.fmt_time(t time) returns text
language sql immutable set search_path = ''
as $$ select to_char(t, 'FMHH12:MI AM') $$;

create function private.fmt_day(d date) returns text
language sql immutable set search_path = ''
as $$ select to_char(d, 'FMDay') $$;

-- {'Ada'} -> 'Ada'; {'Ada','Tobi'} -> 'Ada and Tobi'; {'A','B','C'} -> 'A, B and C'
create function private.join_names(p_names text[]) returns text
language sql immutable set search_path = ''
as $$
  select case
    when coalesce(cardinality(p_names), 0) = 0 then ''
    when cardinality(p_names) = 1 then p_names[1]
    else array_to_string(p_names[1:cardinality(p_names) - 1], ', ') || ' and ' || p_names[cardinality(p_names)]
  end
$$;

create function private.parent_names(p_household uuid) returns text
language sql stable security definer set search_path = ''
as $$
  select private.join_names(array_agg(display_name order by created_at))
  from public.members where household_id = p_household and role = 'parent'
$$;

-- ---------------------------------------------------------------------------
-- What each child needs for a date
-- ---------------------------------------------------------------------------

-- Outfit for a child on a date: override (manual beats school notice), then the
-- weekly routine, with school outfits switched to the household's casual outfit on holidays.
create function private.resolve_outfit(p_child uuid, p_date date) returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_outfit uuid;
  v_household uuid;
begin
  select o.outfit_id into v_outfit
  from public.overrides o
  where o.child_id = p_child and o.on_date = p_date and o.outfit_id is not null
  order by (o.source = 'manual') desc
  limit 1;
  if v_outfit is not null then
    return v_outfit;
  end if;

  select r.outfit_id, c.household_id into v_outfit, v_household
  from public.children c
  left join public.weekly_routine r on r.child_id = c.id and r.weekday = extract(isodow from p_date)
  where c.id = p_child;

  if v_outfit is not null
     and (select is_school from public.outfits where id = v_outfit)
     and exists (select 1 from public.holidays h
                 where h.household_id = v_household and p_date between h.starts_on and h.ends_on) then
    select id into v_outfit
    from public.outfits
    where household_id = v_household and not is_school
    order by (lower(name) = 'casual') desc, sort, name
    limit 1;
  end if;

  return v_outfit;
end $$;

-- The checklist a household should have for a date (optionally only some children).
-- Groups: the outfit first, then activities by start time, then extras from overrides.
create function private.desired_prep_items(p_household uuid, p_date date, p_children uuid[] default null)
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
    where a.active and a.weekday = extract(isodow from p_date)
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

-- Session status follows the ticks (and rebuilds).
create function private.refresh_session_status(p_session uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_remaining int;
begin
  select count(*) filter (where checked_at is null) into v_remaining
  from public.prep_items where session_id = p_session;

  if v_remaining = 0 then
    update public.prep_sessions
       set status = 'complete', completed_at = now()
     where id = p_session and status <> 'complete';
  else
    update public.prep_sessions
       set status = case when now() >= deadline_at then 'overdue'::public.session_status
                         else 'pending'::public.session_status end,
           completed_at = null
     where id = p_session and status = 'complete';
  end if;
end $$;

create or replace function private.sync_session_status() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.refresh_session_status(new.session_id);
  return null;
end $$;

-- Bring a session's items in line with the current routine, keeping existing ticks.
create function private.rebuild_session_items(p_session uuid, p_children uuid[] default null) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  s public.prep_sessions;
begin
  select * into s from public.prep_sessions where id = p_session;

  create temp table want on commit drop as
    select * from private.desired_prep_items(s.household_id, s.for_date, p_children);

  delete from public.prep_items i
   where i.session_id = p_session
     and (p_children is null or i.child_id = any (p_children))
     and not exists (select 1 from want w
                     where w.child_id = i.child_id and w.label = i.label and w.group_label = i.group_label);

  update public.prep_items i set sort = w.sort
    from want w
   where i.session_id = p_session
     and w.child_id = i.child_id and w.label = i.label and w.group_label = i.group_label;

  insert into public.prep_items (session_id, child_id, label, group_label, sort)
  select p_session, w.child_id, w.label, w.group_label, w.sort
  from want w
  where not exists (select 1 from public.prep_items i
                    where i.session_id = p_session
                      and i.child_id = w.child_id and i.label = w.label and i.group_label = w.group_label);

  drop table want;
  perform private.refresh_session_status(p_session);
end $$;

-- Create tomorrow's session, snapshot its items and tell the nannies.
create function private.release_prep(p_household uuid, p_for_date date) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  h public.households;
  v_session uuid;
  v_items int;
  v_children int;
begin
  select * into h from public.households where id = p_household;

  insert into public.prep_sessions (household_id, for_date, deadline_at)
  values (p_household, p_for_date, ((p_for_date - 1) + h.prep_deadline_time) at time zone h.timezone)
  on conflict (household_id, for_date) do nothing
  returning id into v_session;
  if v_session is null then
    return null;
  end if;

  insert into public.prep_items (session_id, child_id, label, group_label, sort)
  select v_session, d.child_id, d.label, d.group_label, d.sort
  from private.desired_prep_items(p_household, p_for_date) d;

  select count(*), count(distinct child_id) into v_items, v_children
  from public.prep_items where session_id = v_session;

  if v_items = 0 then
    perform private.refresh_session_status(v_session);  -- nothing to prepare
    return v_session;
  end if;

  perform private.notify_role(
    p_household, 'nanny', 'prep_release', 'prep_release:' || v_session,
    'Tonight''s prep is ready',
    format('Prep for %s: %s %s, %s items. Finish by %s.',
           private.fmt_day(p_for_date), v_children,
           case when v_children = 1 then 'child' else 'children' end,
           v_items, private.fmt_time(h.prep_deadline_time)),
    '/nanny');
  return v_session;
end $$;

-- Deadline missed: parents get push (+ SMS backup), nannies get a firmer push.
create function private.notify_overdue(p_session uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  s public.prep_sessions;
  h public.households;
  v_detail text;
  v_names text[];
begin
  select * into s from public.prep_sessions where id = p_session;
  select * into h from public.households where id = s.household_id;

  select string_agg(format('%s: %s %s left', c.name, x.remaining,
                           case when x.remaining = 1 then 'item' else 'items' end), '. ' order by c.sort, c.name),
         array_agg(c.name order by c.sort, c.name)
    into v_detail, v_names
  from (select child_id, count(*) as remaining
        from public.prep_items where session_id = p_session and checked_at is null
        group by child_id) x
  join public.children c on c.id = x.child_id;

  perform private.notify_role(
    s.household_id, 'parent', 'prep_overdue', 'prep_overdue:' || p_session,
    'Prep isn''t finished',
    format('Prep for %s missed the %s deadline. %s.', private.fmt_day(s.for_date),
           private.fmt_time(h.prep_deadline_time), v_detail),
    '/parent',
    case when h.sms_backup then '{push,sms}'::text[] else '{push}'::text[] end);

  perform private.notify_role(
    s.household_id, 'nanny', 'prep_overdue', 'prep_overdue:' || p_session,
    'Prep is overdue',
    format('%s %s not finished. %s %s been notified.',
           private.join_names(v_names), case when cardinality(v_names) = 1 then 'is' else 'are' end,
           private.parent_names(s.household_id),
           case when (select count(*) from public.members
                      where household_id = s.household_id and role = 'parent') = 1 then 'has' else 'have' end),
    '/nanny');
end $$;

-- ---------------------------------------------------------------------------
-- Scheduler (pg_cron, every minute)
-- ---------------------------------------------------------------------------
create function public.run_scheduler() returns jsonb
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
      perform private.notify_overdue(s.id);
    end if;
  end loop;

  return jsonb_build_object('released', v_released, 'overdue', v_overdue);
end $$;

-- Retry undelivered notifications (pg_cron, every 5 minutes).
create function private.sweep_notifications() returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.notifications
             where delivered_at is null and attempts < 5
               and sent_at > now() - interval '1 day' and sent_at < now() - interval '1 minute') then
    perform private.call_send_notification(jsonb_build_object('sweep', true));
  end if;
end $$;

revoke execute on function public.run_scheduler() from public, anon, authenticated;
grant execute on function public.run_scheduler() to service_role;

select cron.schedule('prep-scheduler', '* * * * *', 'select public.run_scheduler()');
select cron.schedule('prep-notification-sweep', '*/5 * * * *', 'select private.sweep_notifications()');

-- ---------------------------------------------------------------------------
-- Event-driven notifications
-- ---------------------------------------------------------------------------

-- Every child ready: tell the parents (if they want it).
create function private.on_session_complete() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  h public.households;
  v_children int;
begin
  select * into h from public.households where id = new.household_id;
  select count(distinct child_id) into v_children from public.prep_items where session_id = new.id;
  if not h.notify_parents_all_ready or v_children = 0 then
    return null;
  end if;

  perform private.notify_role(
    new.household_id, 'parent', 'all_ready', 'all_ready:' || new.id,
    'Everyone''s ready',
    format('%s for %s. Finished at %s.',
           case when v_children = 1 then 'The child is ready' else format('All %s children are ready', v_children) end,
           private.fmt_day(new.for_date),
           private.fmt_time((new.completed_at at time zone h.timezone)::time)),
    '/parent');
  return null;
end $$;

create trigger prep_sessions_all_ready after update of status on public.prep_sessions
  for each row when (new.status = 'complete' and old.status <> 'complete')
  execute function private.on_session_complete();

-- PIN lockouts: tell the parents.
create function private.on_security_event() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
begin
  select display_name into v_name from public.members where id = new.member_id;
  perform private.notify_role(
    new.household_id, 'parent', new.kind, 'security:' || new.id,
    case new.kind when 'pin_locked' then 'Nanny sign-in locked' else 'Wrong PIN attempts' end,
    case new.kind
      when 'pin_locked' then format('Someone entered the wrong PIN for %s 10 times today. Sign-in is locked until you send a new setup link from Settings.', v_name)
      else format('Someone entered the wrong PIN for %s 5 times. Sign-in is paused for 15 minutes.', v_name)
    end,
    '/parent/settings#nannies');
  return null;
end $$;

create trigger security_events_notify after insert on public.security_events
  for each row execute function private.on_security_event();

-- ---------------------------------------------------------------------------
-- RPCs for the app
-- ---------------------------------------------------------------------------

-- Tonight's session for the caller's household: tomorrow's once released;
-- before noon, today's (for a morning check). Plus the times to show when there is none.
create function public.prep_overview() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  h public.households;
  v_local timestamp;
  s public.prep_sessions;
begin
  select * into h from public.households where id = private.my_household_id();
  if h.id is null then
    return null;
  end if;
  v_local := now() at time zone h.timezone;

  select * into s from public.prep_sessions
   where household_id = h.id
     and (for_date = v_local::date + 1 or (for_date = v_local::date and v_local::time < '12:00'))
   order by for_date desc
   limit 1;

  return jsonb_build_object(
    'session', case when s.id is null then null else to_jsonb(s) end,
    'release_time', private.fmt_time(h.prep_release_time),
    'deadline_time', private.fmt_time(h.prep_deadline_time),
    'tomorrow', private.fmt_day(v_local::date + 1));
end $$;

-- Parent: "Rebuild tonight's list" after changing the routine. Keeps ticks.
create function public.rebuild_prep_session(p_session_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_parent() or not exists (
       select 1 from public.prep_sessions where id = p_session_id and household_id = private.my_household_id()) then
    raise exception 'session not found' using errcode = 'P0002';
  end if;
  perform private.rebuild_session_items(p_session_id);
end $$;

-- "Send test notification" for the caller's own devices.
create function public.send_test_notification() returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_member uuid := private.my_member_id();
begin
  if v_member is null then
    raise exception 'not a member' using errcode = '42501';
  end if;
  perform private.notify(v_member, 'test', 'test:' || gen_random_uuid(),
                         'PREP notifications are working',
                         'You''ll get reminders like this on this phone.', '/');
end $$;

revoke execute on function
  public.prep_overview(), public.rebuild_prep_session(uuid), public.send_test_notification()
from public, anon;
grant execute on function
  public.prep_overview(), public.rebuild_prep_session(uuid), public.send_test_notification()
to authenticated;
