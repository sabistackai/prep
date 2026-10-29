-- RLS and PIN lockout checks. Run with: npm run test:db

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'rls-test-parent@example.invalid'),
  ('00000000-0000-0000-0000-00000000000b', 'rls-test-nanny@example.invalid'),
  ('00000000-0000-0000-0000-00000000000c', 'rls-test-other@example.invalid');

do $test$
declare
  parent_a  constant uuid := '00000000-0000-0000-0000-00000000000a';
  nanny     constant uuid := '00000000-0000-0000-0000-00000000000b';
  parent_c  constant uuid := '00000000-0000-0000-0000-00000000000c';
  v_household uuid;
  v_other_household uuid;
  v_child uuid;
  v_token text;
  v_nanny_member uuid;
  v_parent_member uuid;
  v_session uuid;
  v_item uuid;
  v_task uuid;
  v_status public.session_status;
  n int;
begin
  -- Parent A creates the household and a child --------------------------------
  perform pg_temp.act_as(parent_a);
  v_household := public.create_household('Okafor', 'Mrs Okafor', '+2348031111111');
  select id into v_parent_member from public.members where user_id = parent_a;

  select count(*) into n from public.outfits;
  perform pg_temp.check(n = 5, 'household seeded with 5 outfits');

  insert into public.children (household_id, name, class_name) values (v_household, 'Tobi', 'JSS 2')
    returning id into v_child;
  select count(*) into n from public.weekly_routine where child_id = v_child;
  perform pg_temp.check(n = 7, 'new child gets a 7-day default routine');

  insert into public.activities (household_id, child_id, weekday, start_time, title, bring)
  values (v_household, v_child, 6, '08:00', 'Football academy', '{Boots,"Shin guards",Jersey,"Water bottle"}');

  v_token := public.add_nanny('Blessing', '+2348030000000');
  perform pg_temp.check(length(v_token) = 48, 'parent can add a nanny and gets a setup token');
  perform pg_temp.check(pg_temp.fails($$select public.create_household('Again', 'Mrs Okafor')$$),
    'parent cannot create a second household');

  -- Server side: nanny completes setup, scheduler releases tonight's prep -------
  perform pg_temp.act_as_admin();
  update public.members set user_id = nanny, setup_token = null, setup_token_expires_at = null
   where setup_token = v_token returning id into v_nanny_member;
  insert into public.prep_sessions (household_id, for_date, deadline_at)
  values (v_household, current_date + 1, now() + interval '2 hours') returning id into v_session;
  insert into public.prep_items (session_id, child_id, label, group_label, sort) values
    (v_session, v_child, 'School uniform (ironed)', 'Uniform', 1),
    (v_session, v_child, 'School shoes (polished)', 'Uniform', 2);
  select id into v_item from public.prep_items where session_id = v_session order by sort limit 1;

  perform pg_temp.act_as(parent_a);
  insert into public.tasks (household_id, created_by, assigned_to, title)
  values (v_household, v_parent_member, v_nanny_member, 'Iron Ada''s choir robe') returning id into v_task;
  insert into public.school_notices (household_id, created_by, raw_text)
  values (v_household, v_parent_member, 'Sports day on Monday');

  -- Nanny: what she can read --------------------------------------------------
  perform pg_temp.act_as(nanny);
  select count(*) into n from public.children;       perform pg_temp.check(n = 1, 'nanny reads children');
  select count(*) into n from public.weekly_routine; perform pg_temp.check(n = 7, 'nanny reads routine');
  select count(*) into n from public.activities;     perform pg_temp.check(n = 1, 'nanny reads activities');
  select count(*) into n from public.prep_items;     perform pg_temp.check(n = 2, 'nanny reads prep items');
  select count(*) into n from public.tasks;          perform pg_temp.check(n = 1, 'nanny reads her tasks');
  select count(*) into n from public.households;     perform pg_temp.check(n = 0, 'nanny cannot read household settings');
  select count(*) into n from public.school_notices; perform pg_temp.check(n = 0, 'nanny cannot read school notices');
  select count(*) into n from public.members;        perform pg_temp.check(n = 1, 'nanny sees only her own member row');
  select count(*) into n from public.members where phone = '+2348031111111';
  perform pg_temp.check(n = 0, 'nanny cannot see parent phone numbers');
  select count(*) into n from public.member_names;   perform pg_temp.check(n = 2, 'nanny sees household member names');

  -- Nanny: what she cannot change ---------------------------------------------
  perform pg_temp.check(pg_temp.affected(format(
    $$update public.weekly_routine set outfit_id = outfit_id where child_id = %L$$, v_child)) = 0,
    'nanny cannot edit the routine');
  perform pg_temp.check(pg_temp.affected($$update public.activities set title = 'x'$$) = 0,
    'nanny cannot edit activities');
  perform pg_temp.check(pg_temp.fails(format(
    $$insert into public.activities (household_id, child_id, weekday, start_time, title) values (%L, %L, 1, '09:00', 'x')$$,
    v_household, v_child)), 'nanny cannot add activities');
  perform pg_temp.check(pg_temp.affected($$update public.children set name = 'x'$$) = 0,
    'nanny cannot edit children');
  perform pg_temp.check(pg_temp.affected($$update public.households set prep_deadline_time = '23:00'$$) = 0,
    'nanny cannot edit settings');
  perform pg_temp.check(pg_temp.affected($$update public.prep_items set label = 'x'$$) = 0,
    'nanny cannot edit item labels');
  perform pg_temp.check(pg_temp.affected($$update public.members set display_name = 'x' where role = 'parent'$$) = 0,
    'nanny cannot edit other users');
  perform pg_temp.check(pg_temp.affected($$delete from public.members$$) = 0,
    'nanny cannot remove users');
  perform pg_temp.check(pg_temp.fails($$select public.add_nanny('Someone', '+2348000000000')$$),
    'nanny cannot add a nanny');
  perform pg_temp.check(pg_temp.fails(format(
    $$insert into public.tasks (household_id, created_by, assigned_to, title) values (%L, %L, %L, 'x')$$,
    v_household, v_nanny_member, v_nanny_member)), 'nanny cannot create tasks');
  perform pg_temp.check(pg_temp.fails(format(
    $$insert into public.notifications (household_id, member_id, kind, dedupe_key, title, body) values (%L, %L, 'x', 'x', 'x', 'x')$$,
    v_household, v_nanny_member)), 'nanny cannot write notifications');

  -- Nanny: ticking and tasks --------------------------------------------------
  perform public.tick_item(v_item, true);
  perform public.tick_item(v_item, true);  -- offline replay is harmless
  select count(*) into n from public.prep_items where checked_by = v_nanny_member;
  perform pg_temp.check(n = 1, 'nanny can tick an item (idempotent)');
  select status into v_status from public.prep_sessions where id = v_session;
  perform pg_temp.check(v_status = 'pending', 'session stays pending while items remain');

  perform public.tick_item(id, true) from public.prep_items where session_id = v_session;
  select status into v_status from public.prep_sessions where id = v_session;
  perform pg_temp.check(v_status = 'complete', 'session completes when every item is ticked');

  perform public.tick_item(v_item, false);
  select status into v_status from public.prep_sessions where id = v_session;
  perform pg_temp.check(v_status = 'pending', 'unticking reopens the session');

  perform public.complete_task(v_task);
  select count(*) into n from public.tasks where id = v_task and done_at is not null;
  perform pg_temp.check(n = 1, 'nanny can complete her task');

  insert into public.push_subscriptions (member_id, endpoint, p256dh, auth)
  values (v_nanny_member, 'https://push.example/1', 'k', 'a');
  perform pg_temp.check(true, 'nanny can save her push subscription');

  -- Another household sees nothing --------------------------------------------
  perform pg_temp.act_as(parent_c);
  v_other_household := public.create_household('Other', 'Mr Other');
  select count(*) into n from public.children;       perform pg_temp.check(n = 0, 'other household cannot read children');
  select count(*) into n from public.prep_items;     perform pg_temp.check(n = 0, 'other household cannot read prep items');
  select count(*) into n from public.members;        perform pg_temp.check(n = 1, 'other household cannot read members');
  select count(*) into n from public.push_subscriptions;
  perform pg_temp.check(n = 0, 'other household cannot read subscriptions');
  perform pg_temp.check(pg_temp.fails(format($$select public.tick_item(%L, true)$$, v_item)),
    'other household cannot tick items');
  perform pg_temp.check(pg_temp.fails(format($$select public.complete_task(%L)$$, v_task)),
    'other household cannot complete tasks');
  perform pg_temp.check(pg_temp.fails(format(
    $$insert into public.children (household_id, name) values (%L, 'x')$$, v_household)),
    'other household cannot add children to the Okafors');

  -- Parent A still sees everything --------------------------------------------
  perform pg_temp.act_as(parent_a);
  select count(*) into n from public.members;        perform pg_temp.check(n = 2, 'parent sees all household members');
  select count(*) into n from public.push_subscriptions;
  perform pg_temp.check(n = 1, 'parent sees the nanny''s subscription health');
  perform pg_temp.check(pg_temp.affected(format(
    $$update public.members set role = 'parent' where id = %L$$, v_nanny_member)) = 0,
    'parent cannot change a member''s role directly');
  perform pg_temp.check(pg_temp.affected(format(
    $$delete from public.members where id = %L$$, v_parent_member)) = 0,
    'parent cannot delete a parent row');
end
$test$;

-- PIN lockout ------------------------------------------------------------------
do $pin$
declare
  v_phone constant text := '+2340000000001';
  v_house uuid;
  s text;
  n int;
begin
  perform pg_temp.act_as_admin();
  insert into public.households (name) values ('PIN test') returning id into v_house;
  insert into public.members (household_id, role, display_name, phone)
  values (v_house, 'nanny', 'Pin Nanny', v_phone);

  perform pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
  perform pg_temp.check(pg_temp.fails(format($$select public.pin_attempt_start(%L)$$, v_phone)),
    'signed-in users cannot call the lockout functions');
  perform pg_temp.check(pg_temp.fails(format($$select public.pin_attempts_reset(%L)$$, v_phone)),
    'signed-in users cannot clear a lockout');

  perform pg_temp.act_as_server();
  for i in 1..5 loop
    s := public.pin_attempt_start(v_phone);
  end loop;
  perform pg_temp.check(s = 'ok', 'first 5 attempts are allowed');
  perform pg_temp.check(public.pin_attempt_failed(v_phone) = 'paused', '5th wrong PIN pauses sign-in');
  perform pg_temp.check(public.pin_attempt_start(v_phone) = 'paused', 'attempts are refused while paused');

  perform pg_temp.act_as_admin();
  update private.login_attempts set paused_until = now() - interval '1 second' where login_attempts.phone = v_phone;
  perform pg_temp.act_as_server();
  for i in 1..5 loop
    s := public.pin_attempt_start(v_phone);
  end loop;
  perform pg_temp.check(s = 'ok', 'attempts resume after the 15-minute pause');
  perform pg_temp.check(public.pin_attempt_failed(v_phone) = 'locked', '10th wrong PIN in a day locks sign-in');

  perform pg_temp.act_as_admin();
  update private.login_attempts set window_started_at = now() - interval '25 hours' where login_attempts.phone = v_phone;
  perform pg_temp.act_as_server();
  perform pg_temp.check(public.pin_attempt_start(v_phone) = 'locked', 'a lock does not expire on its own');

  perform public.pin_attempts_reset(v_phone);
  perform pg_temp.check(public.pin_attempt_start(v_phone) = 'ok', 'a new setup link (reset) lifts the lock');

  perform public.pin_attempts_reset(v_phone);
  for i in 1..5 loop
    s := public.pin_attempt_start(v_phone);
  end loop;
  perform pg_temp.check(public.pin_attempt_start(v_phone) = 'paused',
    'parallel attempts are capped at 5 even before any result comes back');

  perform pg_temp.act_as_admin();
  select count(*) into n from public.security_events where household_id = v_house;
  perform pg_temp.check(n = 3, 'each pause and lock is recorded for the parents');
end
$pin$;

rollback;
