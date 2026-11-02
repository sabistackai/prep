-- Daily care checks: building a day's log, edits and holidays, ticking and skipping,
-- reminders and late alerts, care cards, who may change what, and the weekly summary.
-- Run with: npm run test:db

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'care-mum@example.invalid'),
  ('00000000-0000-0000-0000-0000000000c2', 'care-dad@example.invalid'),
  ('00000000-0000-0000-0000-0000000000c3', 'care-nanny@example.invalid'),
  ('00000000-0000-0000-0000-0000000000c4', 'care-other@example.invalid');

do $test$
declare
  mum   constant uuid := '00000000-0000-0000-0000-0000000000c1';
  dad   constant uuid := '00000000-0000-0000-0000-0000000000c2';
  nanny constant uuid := '00000000-0000-0000-0000-0000000000c3';
  other constant uuid := '00000000-0000-0000-0000-0000000000c4';
  v_house uuid;
  v_other_house uuid;
  v_nanny uuid;
  v_mum uuid;
  v_ada uuid;
  v_tobi uuid;
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_tomorrow date := v_today + 1;
  v_wd int := extract(isodow from v_today + 1)::int;
  v_lunch uuid;
  v_homework uuid;
  v_row public.care_log;
  v_id uuid;
  v_id2 uuid;
  v_text text;
  v_sum jsonb;
  v_week constant date := '2026-10-05';  -- a past Monday
  v_session uuid;
  n int;
begin
  perform pg_temp.act_as(mum);
  v_house := public.create_household('Care', 'Mrs Okafor');
  perform pg_temp.act_as(other);
  v_other_house := public.create_household('Other', 'Mrs Bello');
  perform pg_temp.act_as_admin();
  select id into v_mum from public.members where user_id = mum;
  insert into public.members (household_id, user_id, role, display_name) values (v_house, dad, 'parent', 'Mr Okafor');
  insert into public.members (household_id, user_id, role, display_name, phone)
    values (v_house, nanny, 'nanny', 'Blessing', '+2348030000029') returning id into v_nanny;
  insert into public.children (household_id, name, sort) values (v_house, 'Ada', 1) returning id into v_ada;
  insert into public.children (household_id, name, sort) values (v_house, 'Tobi', 2) returning id into v_tobi;

  -- Building a day ------------------------------------------------------------------
  perform pg_temp.act_as(mum);
  insert into public.care_items (household_id, child_id, weekday, at_time, kind, title, details)
    values (v_house, v_ada, v_wd, '13:30', 'meal', ' Lunch ', ' Rice and stew ') returning id into v_lunch;
  insert into public.care_items (household_id, child_id, weekday, at_time, kind, title, school_days_only)
    values (v_house, v_ada, v_wd, '16:00', 'homework', 'Homework', true) returning id into v_homework;
  insert into public.care_items (household_id, child_id, weekday, at_time, kind, title)
    values (v_house, v_tobi, (v_wd % 7) + 1, '19:30', 'bath', 'Bath');
  insert into public.care_items (household_id, child_id, weekday, at_time, kind, title, active)
    values (v_house, v_tobi, v_wd, '12:00', 'nap', 'Nap', false);

  perform pg_temp.act_as_admin();
  perform private.sync_care_day(v_house, v_tomorrow);
  select count(*) into n from public.care_log where household_id = v_house and for_date = v_tomorrow;
  perform pg_temp.check(n = 2, 'tomorrow gets its own day''s active items only: ' || n);
  select * into v_row from public.care_log where item_id = v_lunch and for_date = v_tomorrow;
  perform pg_temp.check(v_row.due_at = ((v_tomorrow + time '13:30') at time zone 'Africa/Lagos')
                        and v_row.title = 'Lunch' and v_row.details = 'Rice and stew',
    'due time is Lagos time, text trimmed');
  perform private.sync_care_day(v_house, v_tomorrow);
  select count(*) into n from public.care_log where household_id = v_house and for_date = v_tomorrow;
  perform pg_temp.check(n = 2, 'building a day again adds nothing');

  insert into public.holidays (household_id, starts_on, ends_on) values (v_house, v_tomorrow, v_tomorrow);
  perform private.sync_care_day(v_house, v_tomorrow);
  perform pg_temp.check(not exists (select 1 from public.care_log where item_id = v_homework and for_date = v_tomorrow),
    'school-days-only items drop off on a holiday');
  delete from public.holidays where household_id = v_house;
  perform private.sync_care_day(v_house, v_tomorrow);
  perform pg_temp.check(exists (select 1 from public.care_log where item_id = v_homework and for_date = v_tomorrow),
    'and come back when the holiday is removed');

  -- Edits follow open rows, never done ones
  update public.care_log set reminded_at = now() where item_id = v_homework and for_date = v_tomorrow;
  update public.care_items set at_time = '17:00' where id = v_homework;
  perform private.sync_care_day(v_house, v_tomorrow);
  select * into v_row from public.care_log where item_id = v_homework and for_date = v_tomorrow;
  perform pg_temp.check(v_row.due_at = ((v_tomorrow + time '17:00') at time zone 'Africa/Lagos') and v_row.reminded_at is null,
    'a new time moves the open item and resets its reminder');

  perform pg_temp.act_as(nanny);
  select * into v_row from public.care_log where item_id = v_lunch and for_date = v_tomorrow;
  v_row := public.tick_care(v_row.id, true);
  perform pg_temp.check(v_row.done_at is not null and v_row.done_by = v_nanny, 'the nanny ticks an item');
  v_row := public.tick_care(v_row.id, true, now() - interval '1 hour');
  perform pg_temp.check(v_row.done_at > now() - interval '1 minute', 'ticking twice keeps the first time');
  perform pg_temp.act_as_admin();
  update public.care_items set title = 'Big lunch' where id = v_lunch;
  perform private.sync_care_day(v_house, v_tomorrow);
  perform pg_temp.check((select title from public.care_log where item_id = v_lunch and for_date = v_tomorrow) = 'Lunch',
    'a done item keeps what it was');
  delete from public.care_items where id = v_lunch;
  delete from public.care_items where id = v_homework;
  perform private.sync_care_day(v_house, v_tomorrow);
  select count(*) into n from public.care_log where household_id = v_house and for_date = v_tomorrow;
  perform pg_temp.check(n = 1 and exists (select 1 from public.care_log where household_id = v_house
                                          and for_date = v_tomorrow and done_at is not null),
    'removing items drops their open rows but keeps done ones as history');

  -- Copying a day
  perform pg_temp.act_as(mum);
  insert into public.care_items (household_id, child_id, weekday, at_time, kind, title)
    values (v_house, v_ada, 1, '07:00', 'meal', 'Breakfast'), (v_house, v_ada, 1, '20:30', 'bedtime', 'Bed'),
           (v_house, v_ada, 3, '09:00', 'play', 'Old Wednesday item');
  n := public.copy_care_day(1, array[2, 3, 1], v_ada);
  perform pg_temp.check(n = 4, 'Monday copied to Tuesday and Wednesday: ' || n);
  perform pg_temp.check((select count(*) from public.care_items where child_id = v_ada and weekday = 3) = 2
                        and not exists (select 1 from public.care_items where title = 'Old Wednesday item'),
    'copying replaces the other day''s items');
  perform pg_temp.check(pg_temp.fails($$select public.copy_care_day(1, array[1])$$), 'copying a day onto itself is refused');

  -- Who may change what --------------------------------------------------------------
  perform pg_temp.act_as(mum);
  insert into public.care_cards (child_id, allergies, medicines) values (v_ada, 'Peanuts', 'Inhaler when wheezy');
  insert into public.emergency_contacts (household_id, name, relation, phone) values (v_house, 'Mama Ngozi', 'Grandmother', '0803 111 2222');
  perform pg_temp.check((select updated_by from public.care_cards where child_id = v_ada) = v_mum, 'care card records who saved it');

  perform pg_temp.act_as(nanny);
  perform pg_temp.check((select allergies from public.care_cards where child_id = v_ada) = 'Peanuts', 'the nanny reads care cards');
  perform pg_temp.check((select count(*) from public.emergency_contacts) = 1, 'the nanny reads emergency contacts');
  perform pg_temp.check((select count(*) from public.care_items) > 0, 'the nanny reads the schedule');
  perform pg_temp.check(pg_temp.affected(format($$update public.care_cards set allergies = 'None' where child_id = %L$$, v_ada)) = 0,
    'the nanny cannot edit a care card');
  perform pg_temp.check(pg_temp.fails(format($$insert into public.care_items (household_id, child_id, weekday, at_time, title)
                                               values (%L, %L, 1, '08:00', 'x')$$, v_house, v_ada)),
    'the nanny cannot add to the schedule');
  perform pg_temp.check(pg_temp.fails(format($$insert into public.emergency_contacts (household_id, name, phone)
                                               values (%L, 'x', '1')$$, v_house)),
    'the nanny cannot add a contact');
  select id into v_id from public.care_log where household_id = v_house limit 1;
  perform pg_temp.check(pg_temp.affected(format($$update public.care_log set done_at = now() where id = %L$$, v_id)) = 0,
    'the log can only be ticked through tick_care');
  perform pg_temp.check(pg_temp.fails(format($$select public.skip_care(%L, true)$$, v_id)), 'the nanny cannot skip an item');

  perform pg_temp.act_as(other);
  perform pg_temp.check((select count(*) from public.care_log) = 0 and (select count(*) from public.care_cards) = 0
                        and (select count(*) from public.care_items) = 0 and (select count(*) from public.emergency_contacts) = 0,
    'another household sees none of it');
  perform pg_temp.check(pg_temp.fails(format($$select public.tick_care(%L, true)$$, v_id)), 'or ticks it');
  perform pg_temp.check(pg_temp.fails(format($$insert into public.care_items (household_id, child_id, weekday, at_time, title)
                                               values (%L, %L, 1, '08:00', 'x')$$, v_other_house, v_ada)),
    'an item cannot point at another household''s child');
  perform pg_temp.check(pg_temp.fails(format($$insert into public.care_cards (child_id, allergies) values (%L, 'x')$$, v_ada)),
    'or a care card');

  -- Reminders and late alerts ----------------------------------------------------------
  -- Today's log is marked built so the scheduler leaves these hand-made rows alone.
  perform pg_temp.act_as_admin();
  delete from public.care_items where household_id = v_house;
  delete from public.care_log where household_id = v_house;
  delete from public.notifications where household_id = v_house;
  insert into public.care_days (household_id, for_date) values (v_house, v_today) on conflict do nothing;
  insert into public.care_log (household_id, child_id, for_date, due_at, kind, title, details) values
    (v_house, v_ada, v_today, date_trunc('minute', now()) + interval '20 minutes', 'meal', 'Lunch', 'Rice and stew'),
    (v_house, v_tobi, v_today, date_trunc('minute', now()) + interval '20 minutes', 'meal', 'Lunch', null),
    (v_house, v_tobi, v_today, now() + interval '2 hours', 'bath', 'Bath', null);
  perform private.run_care_scheduler();
  select count(*), max(body) into n, v_text from public.notifications where household_id = v_house and kind = 'care_due';
  perform pg_temp.check(n = 1 and v_text = 'Ada: Lunch (Rice and stew). Tobi: Lunch.',
    'one reminder for items due at the same time: ' || coalesce(v_text, 'none'));
  perform pg_temp.check((select member_id from public.notifications where household_id = v_house and kind = 'care_due') = v_nanny,
    'reminders go to the nanny only');
  perform private.run_care_scheduler();
  perform pg_temp.check((select count(*) from public.notifications where household_id = v_house and kind = 'care_due') = 1,
    'no second reminder, and nothing for the item 2 hours away');

  delete from public.care_log where household_id = v_house;
  delete from public.notifications where household_id = v_house;
  insert into public.care_log (household_id, child_id, for_date, due_at, kind, title, done_at, skipped_at) values
    (v_house, v_ada, v_today, now() - interval '5 minutes', 'bath', 'Bath', null, null),
    (v_house, v_tobi, v_today, now() - interval '5 minutes', 'meal', 'Done lunch', now(), null),
    (v_house, v_tobi, v_today, now() - interval '5 minutes', 'nap', 'Skipped nap', null, now()),
    (v_house, v_tobi, v_today, now() - interval '3 hours', 'medicine', 'Old medicine', null, null);
  perform private.run_care_scheduler();
  select count(*), max(body) into n, v_text from public.notifications
   where household_id = v_house and kind = 'care_late' and member_id in (select id from public.members where household_id = v_house and role = 'parent');
  perform pg_temp.check(n = 2 and v_text like 'Ada''s bath was due at % and isn''t ticked yet.',
    'both parents told about the late item only: ' || coalesce(v_text, 'none'));
  select body into v_text from public.notifications where household_id = v_house and kind = 'care_late' and member_id = v_nanny;
  perform pg_temp.check(v_text like 'Ada''s bath was due at %. Mrs Okafor and Mr Okafor have been told. Tick it off as soon as it''s done.',
    'the nanny gets a firmer push: ' || coalesce(v_text, 'none'));
  perform private.run_care_scheduler();
  perform pg_temp.check((select count(*) from public.notifications where household_id = v_house and kind = 'care_late') = 3,
    'no repeat late alerts');

  delete from public.care_log where household_id = v_house;
  delete from public.notifications where household_id = v_house;
  update public.households set notify_parents_care_late = false where id = v_house;
  insert into public.care_log (household_id, child_id, for_date, due_at, kind, title) values
    (v_house, v_ada, v_today, now() - interval '5 minutes', 'bath', 'Bath');
  perform private.run_care_scheduler();
  select count(*), max(body) into n, v_text from public.notifications where household_id = v_house and kind = 'care_late';
  perform pg_temp.check(n = 1 and v_text like '%. Tick it off as soon as it''s done.' and v_text not like '%been told%',
    'with parent alerts off, only the nanny hears: ' || coalesce(v_text, 'none'));

  -- Skipping
  perform pg_temp.act_as(mum);
  select id into v_id from public.care_log where household_id = v_house limit 1;
  perform public.skip_care(v_id, true);
  perform pg_temp.act_as(nanny);
  perform pg_temp.check(pg_temp.fails(format($$select public.tick_care(%L, true)$$, v_id)), 'a skipped item cannot be ticked');
  perform pg_temp.act_as(mum);
  perform public.skip_care(v_id, false);
  perform pg_temp.act_as(nanny);
  perform public.tick_care(v_id, true);
  perform pg_temp.act_as(mum);
  perform pg_temp.check(pg_temp.fails(format($$select public.skip_care(%L, true)$$, v_id)), 'a done item cannot be skipped');

  -- Weekly summary --------------------------------------------------------------------
  perform pg_temp.act_as_admin();
  -- Prep: Monday on time, Tuesday late, Wednesday missed.
  insert into public.prep_sessions (household_id, for_date, deadline_at, status, completed_at)
    values (v_house, v_week, '2026-10-04 19:00+00', 'complete', '2026-10-04 18:30+00') returning id into v_session;
  insert into public.prep_items (session_id, child_id, label, group_label, checked_at) values (v_session, v_ada, 'Uniform', 'Uniform', now());
  insert into public.prep_sessions (household_id, for_date, deadline_at, status, completed_at)
    values (v_house, v_week + 1, '2026-10-05 19:00+00', 'complete', '2026-10-05 19:30+00') returning id into v_session;
  insert into public.prep_items (session_id, child_id, label, group_label, checked_at) values (v_session, v_ada, 'Uniform', 'Uniform', now());
  insert into public.prep_sessions (household_id, for_date, deadline_at, status)
    values (v_house, v_week + 2, '2026-10-06 19:00+00', 'overdue') returning id into v_session;
  insert into public.prep_items (session_id, child_id, label, group_label) values (v_session, v_ada, 'Uniform', 'Uniform');

  -- Care: Ada lunch on time twice, late once, missed once; Tobi bath skipped.
  insert into public.care_log (household_id, child_id, for_date, due_at, kind, title, done_at, skipped_at) values
    (v_house, v_ada, v_week,     '2026-10-05 12:30+00', 'meal', 'Lunch', '2026-10-05 12:30:40+00', null),
    (v_house, v_ada, v_week + 1, '2026-10-06 12:30+00', 'meal', 'Lunch', '2026-10-06 12:10+00', null),
    (v_house, v_ada, v_week + 2, '2026-10-07 12:30+00', 'meal', 'Lunch', '2026-10-07 12:45+00', null),
    (v_house, v_ada, v_week + 3, '2026-10-08 12:30+00', 'meal', 'Lunch', null, null),
    (v_house, v_tobi, v_week + 3, '2026-10-08 18:30+00', 'bath', 'Bath', null, '2026-10-08 10:00+00');

  -- Tasks: one on time, one late, one still open.
  insert into public.tasks (household_id, created_by, assigned_to, title, due_at, done_at, created_at) values
    (v_house, v_mum, v_nanny, 'On time', '2026-10-06 17:00+00', '2026-10-06 16:00+00', '2026-10-05 08:00+00'),
    (v_house, v_mum, v_nanny, 'Late', '2026-10-07 17:00+00', '2026-10-07 18:00+00', '2026-10-05 08:00+00'),
    (v_house, v_mum, v_nanny, 'Open', '2026-10-08 17:00+00', null, '2026-10-05 08:00+00');

  perform pg_temp.act_as(mum);
  v_sum := public.weekly_summary('2026-10-08');  -- a Thursday: its week starts Monday 5 October
  perform pg_temp.check(v_sum ->> 'start' = '2026-10-05' and v_sum ->> 'end' = '2026-10-11', 'the week runs Monday to Sunday');
  perform pg_temp.check(v_sum -> 'prep' ->> 'on_time' = '1' and v_sum -> 'prep' ->> 'late' = '1' and v_sum -> 'prep' ->> 'missed' = '1'
                        and jsonb_array_length(v_sum -> 'prep' -> 'nights') = 7,
    'prep: on time, late and missed nights: ' || (v_sum -> 'prep')::text);
  perform pg_temp.check(v_sum -> 'care' ->> 'on_time' = '2' and v_sum -> 'care' ->> 'late' = '1'
                        and v_sum -> 'care' ->> 'missed' = '1' and v_sum -> 'care' ->> 'skipped' = '1',
    'care: ticked within the minute counts as on time, skipped is set aside: ' || (v_sum -> 'care')::text);
  perform pg_temp.check(v_sum -> 'care' -> 'trouble' -> 0 ->> 'title' = 'Lunch'
                        and jsonb_array_length(v_sum -> 'care' -> 'children') = 1,
    'what went wrong most, and children with nothing counted are left out');
  perform pg_temp.check(v_sum -> 'tasks' ->> 'on_time' = '1' and v_sum -> 'tasks' ->> 'late' = '1' and v_sum -> 'tasks' ->> 'open_overdue' = '1',
    'tasks: on time, late, still open');

  v_text := private.weekly_summary_text(v_sum);
  perform pg_temp.check(v_text = 'Evening prep was on time 1 of 3 nights. Daily care: 2 of 4 on time, 1 late, 1 not ticked. Tasks: 2 done, 1 late, 1 still open.',
    'Monday push text: ' || coalesce(v_text, 'none'));
  perform pg_temp.check(private.weekly_summary_text(private.week_summary(v_house, '2026-09-07')) is null,
    'an empty week sends nothing');

  perform pg_temp.act_as(nanny);
  perform pg_temp.check(pg_temp.fails($$select public.weekly_summary()$$), 'the nanny cannot see the weekly summary');
end $test$;

rollback;
