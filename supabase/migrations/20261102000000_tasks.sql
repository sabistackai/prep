-- Week 3: tasks. Parents send the nanny one-off tasks; the nanny gets a push at once,
-- the sender gets one when it's done, and an open task gets one reminder at its due time.

alter table public.tasks add column done_by uuid references public.members on delete set null;

-- A task can only go to a nanny in the same household.
create function private.check_task_assignee() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.members
                 where id = new.assigned_to and household_id = new.household_id and role = 'nanny') then
    raise exception 'Tasks can only go to a nanny in this household.' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger tasks_check_assignee before insert or update of assigned_to, household_id on public.tasks
  for each row execute function private.check_task_assignee();

-- "Due Saturday 6:00 PM" in the household's time zone.
create function private.fmt_due(p_household uuid, p_due timestamptz) returns text
language sql stable security definer set search_path = ''
as $$
  select private.fmt_day((p_due at time zone h.timezone)::date) || ' '
         || private.fmt_time((p_due at time zone h.timezone)::time)
  from public.households h where h.id = p_household
$$;

-- Parent creates a task; p_due_local is wall-clock time in the household's time zone.
create function public.create_task(p_assigned_to uuid, p_title text, p_due_local timestamp default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  h public.households;
  v_id uuid;
begin
  if not private.is_parent() then
    raise exception 'Only parents can create tasks.' using errcode = '42501';
  end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception 'Say what the task is.' using errcode = '23514';
  end if;
  select * into h from public.households where id = private.my_household_id();
  if (p_due_local at time zone h.timezone) <= now() then
    raise exception 'That due time has already passed.' using errcode = '23514';
  end if;

  insert into public.tasks (household_id, created_by, assigned_to, title, due_at)
  values (h.id, private.my_member_id(), p_assigned_to, trim(p_title), p_due_local at time zone h.timezone)
  returning id into v_id;
  return v_id;
end $$;

-- Mark a task done (its assignee, or any parent in the household), recording who.
create or replace function public.complete_task(p_task_id uuid)
returns public.tasks
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks;
begin
  update public.tasks
     set done_at = coalesce(done_at, now()),
         done_by = coalesce(done_by, private.my_member_id())
   where id = p_task_id
     and household_id = private.my_household_id()
     and (assigned_to = private.my_member_id() or private.is_parent())
  returning * into v_task;

  if v_task.id is null then
    raise exception 'task not found' using errcode = 'P0002';
  end if;
  return v_task;
end $$;

-- New task: push to the nanny.
create function private.on_task_created() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_from text;
begin
  select display_name into v_from from public.members where id = new.created_by;
  perform private.notify(
    new.assigned_to, 'task_new', 'task_new:' || new.id,
    'New task from ' || v_from,
    new.title || case when new.due_at is not null
                      then '. Due ' || private.fmt_due(new.household_id, new.due_at) || '.' else '' end,
    '/nanny/tasks');
  return null;
end $$;

create trigger tasks_notify_created after insert on public.tasks
  for each row execute function private.on_task_created();

-- Task done: push to whoever sent it, unless they marked it done themselves.
create function private.on_task_done() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_by text;
begin
  if new.done_by = new.created_by then
    return null;
  end if;
  select display_name into v_by from public.members where id = new.done_by;
  perform private.notify(
    new.created_by, 'task_done', 'task_done:' || new.id,
    'Task done',
    format('%s %s: %s', coalesce(v_by, 'Someone'),
           case when new.done_by = new.assigned_to then 'finished' else 'marked it done' end, new.title),
    '/parent/tasks');
  return null;
end $$;

create trigger tasks_notify_done after update of done_at on public.tasks
  for each row when (old.done_at is null and new.done_at is not null)
  execute function private.on_task_done();

-- Due reminders (pg_cron, every minute): one push per open task when its due time
-- passes. Tasks created already past due, and misses older than 2 hours, are skipped.
create function private.remind_due_tasks() returns int
language plpgsql security definer set search_path = ''
as $$
declare
  t record;
  n int := 0;
begin
  for t in
    select tk.*, h.timezone from public.tasks tk join public.households h on h.id = tk.household_id
     where tk.done_at is null and tk.due_at <= now() and tk.due_at > now() - interval '2 hours'
       and tk.due_at > tk.created_at
  loop
    if private.notify(t.assigned_to, 'task_due', 'task_due:' || t.id,
                      'Task due now',
                      format('%s. It was due at %s.', t.title,
                             private.fmt_time((t.due_at at time zone t.timezone)::time)),
                      '/nanny/tasks') is not null then
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

select cron.schedule('prep-task-due', '* * * * *', 'select private.remind_due_tasks()');

revoke execute on function public.create_task(uuid, text, timestamp) from public, anon;
grant execute on function public.create_task(uuid, text, timestamp) to authenticated;
