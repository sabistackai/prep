-- Security review checks: each attack from the review, tried as a stranger with a
-- household of their own. Run with: npm run test:db

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'sec-victim@example.invalid'),
  ('00000000-0000-0000-0000-0000000000d3', 'sec-attacker@example.invalid');

do $test$
declare
  victim   constant uuid := '00000000-0000-0000-0000-0000000000d1';
  attacker constant uuid := '00000000-0000-0000-0000-0000000000d3';
  v_phone  constant text := '+2348030000077';
  v_house uuid;
  a_house uuid;
  v_child uuid;
  a_child uuid;
  v_outfit uuid;
  a_outfit uuid;
  a_nanny uuid;
  a_session uuid;
  v_message text;
  v_tomorrow date;
  n int;
begin
  perform pg_temp.act_as(victim);
  v_house := public.create_household('Victim', 'V');
  perform public.add_nanny('Blessing', v_phone);
  perform pg_temp.act_as(attacker);
  a_house := public.create_household('Attacker', 'A');

  perform pg_temp.act_as_admin();
  insert into public.children (household_id, name) values (v_house, 'Ada') returning id into v_child;
  insert into public.children (household_id, name) values (a_house, 'Own child') returning id into a_child;
  select id into v_outfit from public.outfits where household_id = v_house and name = 'Uniform';
  select id into a_outfit from public.outfits where household_id = a_house and name = 'Uniform';
  insert into private.login_attempts (phone, recent_failures, daily_failures) values (v_phone, 4, 9);

  -- The PIN lockout -----------------------------------------------------------------
  perform pg_temp.act_as(attacker);
  begin
    perform public.add_nanny('Fake', v_phone);
    v_message := null;
  exception when others then
    v_message := sqlerrm;
  end;
  perform pg_temp.check(v_message = 'That phone number is already set up in PREP.',
                        'another household cannot add a nanny with the same number');

  perform public.add_nanny('Own nanny', '+2348030000078');
  select id into a_nanny from public.members where household_id = a_house and role = 'nanny';
  perform pg_temp.check(pg_temp.fails(format('update public.members set phone = %L where id = %L', v_phone, a_nanny)),
                        'a nanny''s number cannot be changed to someone else''s');
  perform public.reset_nanny_setup(a_nanny);

  perform pg_temp.act_as_admin();
  select count(*) into n from private.login_attempts where phone = v_phone and daily_failures = 9;
  perform pg_temp.check(n = 1, 'a stranger''s new setup link leaves the wrong-PIN count alone');

  perform pg_temp.act_as(victim);
  perform public.reset_nanny_setup((select id from public.members where phone = v_phone));
  perform pg_temp.act_as_admin();
  select count(*) into n from private.login_attempts where phone = v_phone;
  perform pg_temp.check(n = 0, 'the nanny''s own parent can still lift the lockout');

  -- Time zones ----------------------------------------------------------------------
  perform pg_temp.act_as(attacker);
  perform pg_temp.check(pg_temp.fails(format('update public.households set timezone = ''Not/AZone'' where id = %L', a_house)),
                        'a made-up time zone is refused');
  perform pg_temp.check(pg_temp.affected(format('update public.households set timezone = ''Africa/Accra'' where id = %L', a_house)) = 1,
                        'a real time zone is accepted');

  -- The scheduler, even if a bad time zone got in some other way ----------------------
  perform pg_temp.act_as_admin();
  alter table public.households disable trigger households_check_timezone;
  update public.households set timezone = 'Not/AZone' where id = a_house;
  alter table public.households enable trigger households_check_timezone;
  update public.households set prep_release_time = '00:00', prep_deadline_time = '23:59:59' where id = v_house;
  v_tomorrow := (now() at time zone 'Africa/Lagos')::date + 1;

  perform public.run_scheduler();
  select count(*) into n from public.prep_sessions where household_id = v_house and for_date = v_tomorrow;
  perform pg_temp.check(n = 1, 'one household''s bad time zone doesn''t stop the others');

  -- References across households ------------------------------------------------------
  perform pg_temp.act_as(attacker);
  perform pg_temp.check(pg_temp.fails(format(
    'insert into public.activities (household_id, child_id, weekday, start_time, title) values (%L, %L, 1, ''08:00'', ''Injected'')',
    a_house, v_child)), 'an activity cannot be added for another household''s child');
  perform pg_temp.check(not pg_temp.fails(format(
    'insert into public.activities (household_id, child_id, weekday, start_time, title) values (%L, %L, 1, ''08:00'', ''Football'')',
    a_house, a_child)), 'an activity can be added for your own child');

  perform pg_temp.check(pg_temp.fails(format(
    'update public.weekly_routine set outfit_id = %L where child_id = %L', v_outfit, a_child)),
    'a routine cannot use another household''s outfit');
  perform pg_temp.check(pg_temp.affected(format(
    'update public.weekly_routine set outfit_id = %L where child_id = %L and weekday = 1', a_outfit, a_child)) = 1,
    'a routine can use your own outfit');

  perform pg_temp.check(pg_temp.fails(format(
    'insert into public.overrides (child_id, on_date, outfit_id) values (%L, ''2036-11-10'', %L)', a_child, v_outfit)),
    'a one-day change cannot use another household''s outfit');

  perform pg_temp.act_as_admin();
  insert into public.prep_sessions (household_id, for_date, deadline_at)
    values (a_house, '2036-11-10', '2036-11-09 19:00+00') returning id into a_session;
  perform pg_temp.act_as(attacker);
  perform pg_temp.check(pg_temp.fails(format(
    'insert into public.prep_items (session_id, child_id, label, group_label) values (%L, %L, ''x'', ''y'')', a_session, v_child)),
    'a checklist item cannot point at another household''s child');

  -- An injected row from before this fix never reaches the checklist.
  perform pg_temp.act_as_admin();
  alter table public.activities disable trigger activities_check_child;
  insert into public.activities (household_id, child_id, weekday, start_time, title, bring)
    select a_house, v_child, d, '08:00', 'Injected', '{"Injected item"}' from generate_series(1, 7) as d;
  alter table public.activities enable trigger activities_check_child;
  select count(*) into n from private.desired_prep_items(v_house, '2036-11-10') where label = 'Injected item';
  perform pg_temp.check(n = 0, 'another household''s activity never reaches the checklist');
end $test$;

rollback;
