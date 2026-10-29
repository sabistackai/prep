-- Task checks: creating, who can be assigned, the three task pushes and who may change what.
-- Run with: npm run test:db

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'tasks-mum@example.invalid'),
  ('00000000-0000-0000-0000-0000000000f2', 'tasks-dad@example.invalid'),
  ('00000000-0000-0000-0000-0000000000f3', 'tasks-nanny@example.invalid');

do $test$
declare
  mum   constant uuid := '00000000-0000-0000-0000-0000000000f1';
  dad   constant uuid := '00000000-0000-0000-0000-0000000000f2';
  nanny constant uuid := '00000000-0000-0000-0000-0000000000f3';
  v_house uuid;
  v_mum uuid;
  v_dad uuid;
  v_nanny uuid;
  v_task uuid;
  v_task2 uuid;
  v_text text;
  t public.tasks;
  n int;
begin
  perform pg_temp.act_as(mum);
  v_house := public.create_household('Tasks', 'Mrs Okafor');
  perform pg_temp.act_as_admin();
  select id into v_mum from public.members where user_id = mum;
  insert into public.members (household_id, user_id, role, display_name) values (v_house, dad, 'parent', 'Mr Okafor')
    returning id into v_dad;
  insert into public.members (household_id, user_id, role, display_name, phone)
    values (v_house, nanny, 'nanny', 'Blessing', '+2348030000019') returning id into v_nanny;

  -- Creating ------------------------------------------------------------------------
  perform pg_temp.act_as(mum);
  v_task := public.create_task(v_nanny, '  Iron Ada''s choir robe ', '2036-11-08 18:00');
  perform pg_temp.act_as_admin();
  select * into t from public.tasks where id = v_task;
  perform pg_temp.check(t.due_at = '2036-11-08 17:00+00', 'due time is read in Lagos time');
  perform pg_temp.check(t.title = 'Iron Ada''s choir robe' and t.created_by = v_mum, 'title trimmed, sender recorded');

  select title || ' / ' || body into v_text from public.notifications where dedupe_key = 'task_new:' || v_task;
  perform pg_temp.check(v_text = 'New task from Mrs Okafor / Iron Ada''s choir robe. Due Saturday 6:00 PM.',
    'nanny gets the new-task push: ' || coalesce(v_text, 'none'));

  perform pg_temp.act_as(mum);
  v_task2 := public.create_task(v_nanny, 'Buy bread');
  perform pg_temp.act_as_admin();
  select body into v_text from public.notifications where dedupe_key = 'task_new:' || v_task2;
  perform pg_temp.check(v_text = 'Buy bread', 'no due time, no "Due" in the push');

  perform pg_temp.act_as(mum);
  perform pg_temp.check(pg_temp.fails(format($$select public.create_task(%L, 'x')$$, v_dad)),
    'a task cannot be assigned to a parent');
  perform pg_temp.check(pg_temp.fails(format($$select public.create_task(%L, '  ')$$, v_nanny)),
    'a task needs a title');
  perform pg_temp.check(pg_temp.fails(format($$select public.create_task(%L, 'x', '2020-01-01 09:00')$$, v_nanny)),
    'a due time in the past is refused');
  perform pg_temp.check(pg_temp.fails(format(
    $$insert into public.tasks (household_id, created_by, assigned_to, title) values (%L, %L, %L, 'x')$$,
    v_house, v_mum, v_mum)), 'direct inserts are held to the same assignee rule');

  perform pg_temp.act_as(nanny);
  perform pg_temp.check(pg_temp.fails(format($$select public.create_task(%L, 'x')$$, v_nanny)),
    'a nanny cannot create tasks');
  select count(*) into n from public.tasks;
  perform pg_temp.check(n = 2, 'the nanny sees her tasks');
  perform pg_temp.check(pg_temp.affected(format($$update public.tasks set title = 'changed' where id = %L$$, v_task)) = 0,
    'the nanny cannot edit a task');

  -- Done ----------------------------------------------------------------------------
  t := public.complete_task(v_task);
  perform pg_temp.check(t.done_at is not null and t.done_by = v_nanny, 'nanny marks a task done');
  perform pg_temp.act_as_admin();
  select count(*), max(body) into n, v_text from public.notifications where dedupe_key = 'task_done:' || v_task;
  perform pg_temp.check(n = 1 and v_text = 'Blessing finished: Iron Ada''s choir robe',
    'only the sender is told: ' || coalesce(v_text, 'none'));
  perform pg_temp.check((select member_id from public.notifications where dedupe_key = 'task_done:' || v_task) = v_mum,
    'the done push goes to Mrs Okafor');

  perform pg_temp.act_as(mum);
  perform public.complete_task(v_task2);
  perform pg_temp.act_as_admin();
  select count(*) into n from public.notifications where dedupe_key = 'task_done:' || v_task2;
  perform pg_temp.check(n = 0, 'no push when the sender marks their own task done');

  perform pg_temp.act_as(dad);
  v_task2 := public.create_task(v_nanny, 'Pick up dry cleaning');
  perform pg_temp.act_as(mum);
  perform public.complete_task(v_task2);
  perform pg_temp.act_as_admin();
  select body into v_text from public.notifications where dedupe_key = 'task_done:' || v_task2;
  perform pg_temp.check(v_text = 'Mrs Okafor marked it done: Pick up dry cleaning',
    'the other parent marking it done is named: ' || coalesce(v_text, 'none'));

  -- Due reminders -------------------------------------------------------------------
  delete from public.tasks where household_id = v_house;
  insert into public.tasks (household_id, created_by, assigned_to, title, due_at, created_at)
  values (v_house, v_mum, v_nanny, 'Soak the beans', now() - interval '1 minute', now() - interval '1 hour')
  returning id into v_task;
  perform pg_temp.check(private.remind_due_tasks() = 1, 'an open task past its due time gets a reminder');
  select body into v_text from public.notifications where dedupe_key = 'task_due:' || v_task;
  perform pg_temp.check(v_text like 'Soak the beans. It was due at %', 'due reminder: ' || coalesce(v_text, 'none'));
  perform pg_temp.check(private.remind_due_tasks() = 0, 'only one reminder per task');

  insert into public.tasks (household_id, created_by, assigned_to, title, due_at, created_at, done_at)
  values (v_house, v_mum, v_nanny, 'Done already', now() - interval '1 minute', now() - interval '1 hour', now());
  insert into public.tasks (household_id, created_by, assigned_to, title, due_at)
  values (v_house, v_mum, v_nanny, 'Created late', now() - interval '1 minute');
  insert into public.tasks (household_id, created_by, assigned_to, title, due_at, created_at)
  values (v_house, v_mum, v_nanny, 'Long missed', now() - interval '3 hours', now() - interval '1 day');
  insert into public.tasks (household_id, created_by, assigned_to, title, due_at, created_at)
  values (v_house, v_mum, v_nanny, 'Later', now() + interval '1 hour', now() - interval '1 hour');
  perform pg_temp.check(private.remind_due_tasks() = 0,
    'no reminder for done, created-past-due, long-missed or future tasks');
end $test$;

rollback;
