-- PREP initial schema: tables, helpers, RLS, seed triggers and nanny RPCs.
-- See PREP-build-spec.md sections 7 and 8.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.member_role as enum ('parent', 'nanny');
create type public.session_status as enum ('pending', 'complete', 'overdue');
create type public.override_source as enum ('manual', 'school_notice');
create type public.notice_status as enum ('pending', 'applied', 'cancelled', 'failed');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Africa/Lagos',
  prep_release_time time not null default '18:30',
  prep_nudge_time time,
  prep_deadline_time time not null default '20:00',
  activity_lead_minutes int not null default 60 check (activity_lead_minutes between 0 and 720),
  leave_buffer_minutes int not null default 30 check (leave_buffer_minutes between 0 and 240),
  notify_parents_all_ready boolean not null default true,
  notify_parents_activities boolean not null default false,
  sms_backup boolean not null default true,
  created_at timestamptz not null default now(),
  check (prep_deadline_time > prep_release_time)
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  user_id uuid unique references auth.users on delete cascade,
  role public.member_role not null,
  display_name text not null,
  phone text,                                   -- E.164, used for SMS backup
  setup_token text unique,                      -- one-time nanny setup link
  setup_token_expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.members (household_id);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  name text not null,
  class_name text,
  color text not null default '#84CC16',
  sort int not null default 0
);
create index on public.children (household_id);

create table public.outfits (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  name text not null,
  items text[] not null default '{}',
  is_school boolean not null default false,     -- switched to Casual on holidays
  sort int not null default 0,
  unique (household_id, name)
);

create table public.weekly_routine (
  child_id uuid references public.children on delete cascade,
  weekday smallint check (weekday between 1 and 7),  -- 1 = Monday (ISO)
  outfit_id uuid not null references public.outfits on delete cascade,
  primary key (child_id, weekday)
);
create index on public.weekly_routine (outfit_id);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  child_id uuid not null references public.children on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  title text not null,
  bring text[] not null default '{}',
  active boolean not null default true
);
create index on public.activities (household_id, weekday);
create index on public.activities (child_id);

create table public.overrides (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children on delete cascade,
  on_date date not null,
  outfit_id uuid references public.outfits on delete set null,
  extra_items text[] not null default '{}',
  source public.override_source not null default 'manual',
  note text,
  unique (child_id, on_date, source)
);
create index on public.overrides (on_date);

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  starts_on date not null,
  ends_on date not null,
  label text,
  check (ends_on >= starts_on)
);
create index on public.holidays (household_id, starts_on, ends_on);

create table public.prep_sessions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  for_date date not null,
  released_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  status public.session_status not null default 'pending',
  completed_at timestamptz,
  unique (household_id, for_date)
);

create table public.prep_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.prep_sessions on delete cascade,
  child_id uuid not null references public.children on delete cascade,
  label text not null,
  group_label text not null,        -- outfit name or "Football academy · 8:00 AM"
  sort int not null default 0,
  checked_at timestamptz,
  checked_by uuid references public.members on delete set null
);
create index on public.prep_items (session_id);
create index on public.prep_items (child_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  created_by uuid not null references public.members on delete cascade,
  assigned_to uuid not null references public.members on delete cascade,
  title text not null,
  due_at timestamptz,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.tasks (household_id);
create index on public.tasks (assigned_to) where done_at is null;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);
create index on public.push_subscriptions (member_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  member_id uuid not null references public.members on delete cascade,
  kind text not null,               -- prep_release | prep_nudge | prep_overdue | all_ready | activity | task_new | task_done | task_due | notice_applied
  dedupe_key text not null,         -- e.g. 'activity:<activity_id>:2026-10-31'
  title text not null,
  body text not null,
  link text,
  channels text[] not null default '{push}',
  sent_at timestamptz not null default now(),
  read_at timestamptz,
  unique (member_id, dedupe_key)
);
create index on public.notifications (household_id, sent_at desc);

create table public.school_notices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  created_by uuid not null references public.members on delete cascade,
  raw_text text not null,
  parsed jsonb,
  status public.notice_status not null default 'pending',
  created_at timestamptz not null default now()
);
create index on public.school_notices (household_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers (private schema: not exposed through the API)
-- ---------------------------------------------------------------------------
create function private.my_member_id() returns uuid
language sql stable security definer set search_path = ''
as $$ select id from public.members where user_id = auth.uid() $$;

create function private.my_household_id() returns uuid
language sql stable security definer set search_path = ''
as $$ select household_id from public.members where user_id = auth.uid() $$;

create function private.is_parent() returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select role = 'parent' from public.members where user_id = auth.uid()), false) $$;

grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.children enable row level security;
alter table public.outfits enable row level security;
alter table public.weekly_routine enable row level security;
alter table public.activities enable row level security;
alter table public.overrides enable row level security;
alter table public.holidays enable row level security;
alter table public.prep_sessions enable row level security;
alter table public.prep_items enable row level security;
alter table public.tasks enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notifications enable row level security;
alter table public.school_notices enable row level security;

-- Nothing is reachable without signing in.
revoke all on all tables in schema public from anon;

-- households: parents only (nannies never see settings).
create policy "parents read household" on public.households for select to authenticated
  using (id = (select private.my_household_id()) and (select private.is_parent()));
create policy "parents update household" on public.households for update to authenticated
  using (id = (select private.my_household_id()) and (select private.is_parent()))
  with check (id = (select private.my_household_id()));

-- members: parents see everyone in the household; nannies see only themselves.
-- Rows are created through add_nanny()/create_household(); clients may only edit name and phone.
create policy "parents read members" on public.members for select to authenticated
  using (household_id = (select private.my_household_id()) and (select private.is_parent()));
create policy "members read self" on public.members for select to authenticated
  using (user_id = (select auth.uid()));
create policy "parents update members" on public.members for update to authenticated
  using (household_id = (select private.my_household_id()) and (select private.is_parent()))
  with check (household_id = (select private.my_household_id()));
create policy "parents remove nannies" on public.members for delete to authenticated
  using (household_id = (select private.my_household_id()) and (select private.is_parent()) and role = 'nanny');
revoke insert, update on public.members from authenticated;
grant update (display_name, phone) on public.members to authenticated;

-- Names of household members without phone numbers or tokens (for "task from ..." labels).
create view public.member_names with (security_invoker = false) as
  select id, household_id, role, display_name
  from public.members
  where household_id = private.my_household_id();
revoke all on public.member_names from anon;
grant select on public.member_names to authenticated;

-- Household-scoped tables: parents read and write, nannies read.
do $$
declare t text;
begin
  foreach t in array array['children', 'outfits', 'activities', 'holidays', 'prep_sessions'] loop
    execute format(
      'create policy "household read" on public.%I for select to authenticated
         using (household_id = (select private.my_household_id()))', t);
    execute format(
      'create policy "parents write" on public.%I for all to authenticated
         using (household_id = (select private.my_household_id()) and (select private.is_parent()))
         with check (household_id = (select private.my_household_id()) and (select private.is_parent()))', t);
  end loop;
end $$;

-- Child-scoped tables: same rules, via the child's household.
do $$
declare t text;
begin
  foreach t in array array['weekly_routine', 'overrides'] loop
    execute format(
      'create policy "household read" on public.%I for select to authenticated
         using (exists (select 1 from public.children c
                        where c.id = child_id and c.household_id = (select private.my_household_id())))', t);
    execute format(
      'create policy "parents write" on public.%I for all to authenticated
         using ((select private.is_parent()) and exists (select 1 from public.children c
                where c.id = child_id and c.household_id = (select private.my_household_id())))
         with check ((select private.is_parent()) and exists (select 1 from public.children c
                where c.id = child_id and c.household_id = (select private.my_household_id())))', t);
  end loop;
end $$;

-- prep_items: via the session's household. Nannies tick through tick_item().
create policy "household read" on public.prep_items for select to authenticated
  using (exists (select 1 from public.prep_sessions s
                 where s.id = session_id and s.household_id = (select private.my_household_id())));
create policy "parents write" on public.prep_items for all to authenticated
  using ((select private.is_parent()) and exists (select 1 from public.prep_sessions s
         where s.id = session_id and s.household_id = (select private.my_household_id())))
  with check ((select private.is_parent()) and exists (select 1 from public.prep_sessions s
         where s.id = session_id and s.household_id = (select private.my_household_id())));

-- tasks: parents everything; nannies read their own and complete through complete_task().
create policy "parents all tasks" on public.tasks for all to authenticated
  using (household_id = (select private.my_household_id()) and (select private.is_parent()))
  with check (household_id = (select private.my_household_id()) and (select private.is_parent())
              and created_by = (select private.my_member_id()));
create policy "nannies read own tasks" on public.tasks for select to authenticated
  using (assigned_to = (select private.my_member_id()));

-- push_subscriptions: everyone manages their own; parents can see the household's
-- (for the "notifications may be off" warning).
create policy "own subscriptions" on public.push_subscriptions for all to authenticated
  using (member_id = (select private.my_member_id()))
  with check (member_id = (select private.my_member_id()));
create policy "parents read subscriptions" on public.push_subscriptions for select to authenticated
  using ((select private.is_parent()) and exists (select 1 from public.members m
         where m.id = member_id and m.household_id = (select private.my_household_id())));
revoke update on public.push_subscriptions from authenticated;

-- notifications: written by the server only. Own history, parents see the household's.
create policy "own notifications" on public.notifications for select to authenticated
  using (member_id = (select private.my_member_id()));
create policy "parents read notifications" on public.notifications for select to authenticated
  using (household_id = (select private.my_household_id()) and (select private.is_parent()));
revoke insert, update, delete on public.notifications from authenticated;

-- school_notices: parents only.
create policy "parents all notices" on public.school_notices for all to authenticated
  using (household_id = (select private.my_household_id()) and (select private.is_parent()))
  with check (household_id = (select private.my_household_id()) and (select private.is_parent()));

-- ---------------------------------------------------------------------------
-- Seed defaults
-- ---------------------------------------------------------------------------
create function private.seed_household_outfits() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.outfits (household_id, name, items, is_school, sort) values
    (new.id, 'Uniform', '{"School uniform (ironed)","School shoes (polished)","School bag","Lunch box"}', true, 1),
    (new.id, 'Sportswear', '{"House sportswear","Trainers","School bag","Lunch box","Water bottle"}', true, 2),
    (new.id, 'Native attire', '{"Native attire (ironed)","Sandals","School bag","Lunch box"}', true, 3),
    (new.id, 'Church clothes', '{"Sunday clothes (ironed)","Church shoes"}', false, 4),
    (new.id, 'Casual', '{"Casual clothes laid out"}', false, 5);
  return new;
end $$;

create trigger households_seed_outfits after insert on public.households
  for each row execute function private.seed_household_outfits();

-- New children start with Uniform Mon–Fri, Casual Sat, Church clothes Sun.
create function private.seed_child_routine() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.weekly_routine (child_id, weekday, outfit_id)
  select new.id, d.weekday, o.id
  from (values (1, 'Uniform'), (2, 'Uniform'), (3, 'Uniform'), (4, 'Uniform'), (5, 'Uniform'),
               (6, 'Casual'), (7, 'Church clothes')) as d(weekday, outfit)
  join public.outfits o on o.household_id = new.household_id and o.name = d.outfit;
  return new;
end $$;

create trigger children_seed_routine after insert on public.children
  for each row execute function private.seed_child_routine();

-- ---------------------------------------------------------------------------
-- Session status follows the ticks
-- ---------------------------------------------------------------------------
create function private.sync_session_status() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_remaining int;
begin
  select count(*) filter (where checked_at is null) into v_remaining
  from public.prep_items where session_id = new.session_id;

  if v_remaining = 0 then
    update public.prep_sessions
       set status = 'complete', completed_at = now()
     where id = new.session_id and status <> 'complete';
  else
    update public.prep_sessions
       set status = case when now() >= deadline_at then 'overdue'::public.session_status
                         else 'pending'::public.session_status end,
           completed_at = null
     where id = new.session_id and status = 'complete';
  end if;
  return null;
end $$;

create trigger prep_items_sync_status after update of checked_at on public.prep_items
  for each row when (old.checked_at is distinct from new.checked_at)
  execute function private.sync_session_status();

-- ---------------------------------------------------------------------------
-- RPCs called by the app
-- ---------------------------------------------------------------------------

-- First sign-in for a parent: create the household and their member row.
create function public.create_household(p_name text, p_display_name text, p_phone text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_household uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if exists (select 1 from public.members where user_id = auth.uid()) then
    raise exception 'already a member of a household' using errcode = '23505';
  end if;

  insert into public.households (name) values (p_name) returning id into v_household;
  insert into public.members (household_id, user_id, role, display_name, phone)
  values (v_household, auth.uid(), 'parent', p_display_name, p_phone);
  return v_household;
end $$;

-- Parent adds a nanny; returns the one-time setup token (valid 7 days).
create function public.add_nanny(p_display_name text, p_phone text)
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
end $$;

-- Parent issues a fresh setup link for a nanny (new phone, forgotten PIN).
create function public.reset_nanny_setup(p_member_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  update public.members
     set setup_token = v_token, setup_token_expires_at = now() + interval '7 days'
   where id = p_member_id and role = 'nanny'
     and household_id = private.my_household_id() and private.is_parent();
  if not found then
    raise exception 'nanny not found' using errcode = 'P0002';
  end if;
  return v_token;
end $$;

-- Tick or untick a prep item (parents and nannies). Idempotent, so offline replays are safe.
create function public.tick_item(p_item_id uuid, p_checked boolean)
returns public.prep_items
language plpgsql security definer set search_path = ''
as $$
declare
  v_item public.prep_items;
begin
  update public.prep_items i
     set checked_at = case when p_checked then coalesce(i.checked_at, now()) end,
         checked_by = case when p_checked then coalesce(i.checked_by, private.my_member_id()) end
    from public.prep_sessions s
   where i.id = p_item_id and s.id = i.session_id
     and s.household_id = private.my_household_id()
  returning i.* into v_item;

  if v_item.id is null then
    raise exception 'item not found' using errcode = 'P0002';
  end if;
  return v_item;
end $$;

-- Mark a task done (its assignee, or any parent in the household).
create function public.complete_task(p_task_id uuid)
returns public.tasks
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks;
begin
  update public.tasks
     set done_at = coalesce(done_at, now())
   where id = p_task_id
     and household_id = private.my_household_id()
     and (assigned_to = private.my_member_id() or private.is_parent())
  returning * into v_task;

  if v_task.id is null then
    raise exception 'task not found' using errcode = 'P0002';
  end if;
  return v_task;
end $$;

-- Mark own notifications read.
create function public.mark_notifications_read(p_ids uuid[])
returns void
language sql security definer set search_path = ''
as $$
  update public.notifications
     set read_at = coalesce(read_at, now())
   where id = any(p_ids) and member_id = private.my_member_id();
$$;

revoke execute on function
  public.create_household(text, text, text),
  public.add_nanny(text, text),
  public.reset_nanny_setup(uuid),
  public.tick_item(uuid, boolean),
  public.complete_task(uuid),
  public.mark_notifications_read(uuid[])
from public, anon;

grant execute on function
  public.create_household(text, text, text),
  public.add_nanny(text, text),
  public.reset_nanny_setup(uuid),
  public.tick_item(uuid, boolean),
  public.complete_task(uuid),
  public.mark_notifications_read(uuid[])
to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: parents watch ticks live
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.prep_sessions, public.prep_items, public.tasks, public.notifications;
