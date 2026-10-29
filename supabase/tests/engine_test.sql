-- Prep engine checks: outfit resolution, checklist building, release, deadline,
-- notifications and rebuilds. Run with: npm run test:db

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'engine-mum@example.invalid'),
  ('00000000-0000-0000-0000-0000000000e2', 'engine-dad@example.invalid'),
  ('00000000-0000-0000-0000-0000000000e3', 'engine-nanny@example.invalid');

do $test$
declare
  mum   constant uuid := '00000000-0000-0000-0000-0000000000e1';
  nanny constant uuid := '00000000-0000-0000-0000-0000000000e3';
  v_house uuid;
  v_ada uuid;
  v_tobi uuid;
  v_uniform uuid;
  v_sports uuid;
  v_casual uuid;
  v_church uuid;
  v_monday constant date := '2026-11-02';   -- a Monday
  v_saturday constant date := '2026-11-07';
  v_session uuid;
  v_item uuid;
  v_text text;
  v_json jsonb;
  n int;
begin
  -- Household: two parents, one nanny, two children -----------------------------
  perform pg_temp.act_as(mum);
  v_house := public.create_household('Engine', 'Mrs Okafor', '+2348031111111');
  perform pg_temp.act_as_admin();
  insert into public.members (household_id, user_id, role, display_name, phone) values
    (v_house, '00000000-0000-0000-0000-0000000000e2', 'parent', 'Mr Okafor', '+2348032222222'),
    (v_house, nanny, 'nanny', 'Blessing', '+2348030000009');
  insert into public.children (household_id, name, class_name, sort) values (v_house, 'Ada', 'Primary 4', 0)
    returning id into v_ada;
  insert into public.children (household_id, name, class_name, sort) values (v_house, 'Tobi', 'JSS 2', 1)
    returning id into v_tobi;
  select id into v_uniform from public.outfits where household_id = v_house and name = 'Uniform';
  select id into v_sports from public.outfits where household_id = v_house and name = 'Sportswear';
  select id into v_casual from public.outfits where household_id = v_house and name = 'Casual';
  select id into v_church from public.outfits where household_id = v_house and name = 'Church clothes';

  -- Outfit resolution ---------------------------------------------------------------
  perform pg_temp.check(private.resolve_outfit(v_ada, v_monday) = v_uniform, 'routine gives Uniform on Monday');

  insert into public.holidays (household_id, starts_on, ends_on, label) values (v_house, v_monday, v_monday, 'Mid-term');
  perform pg_temp.check(private.resolve_outfit(v_ada, v_monday) = v_casual, 'holiday switches a school outfit to Casual');
  update public.weekly_routine set outfit_id = v_church where child_id = v_ada and weekday = 1;
  perform pg_temp.check(private.resolve_outfit(v_ada, v_monday) = v_church, 'holiday leaves a non-school outfit alone');
  update public.weekly_routine set outfit_id = v_uniform where child_id = v_ada and weekday = 1;
  delete from public.holidays where household_id = v_house;

  insert into public.overrides (child_id, on_date, outfit_id, extra_items, source, note)
  values (v_ada, v_monday, v_sports, '{"Water bottle"}', 'school_notice', 'Inter-House Sports Day');
  perform pg_temp.check(private.resolve_outfit(v_ada, v_monday) = v_sports, 'school notice override changes the outfit');
  insert into public.overrides (child_id, on_date, outfit_id, source) values (v_ada, v_monday, v_casual, 'manual');
  perform pg_temp.check(private.resolve_outfit(v_ada, v_monday) = v_casual, 'a manual override beats a school notice');
  delete from public.overrides where child_id = v_ada and source = 'manual';

  -- Checklist building ------------------------------------------------------------------
  select count(*) into n from private.desired_prep_items(v_house, v_monday) where child_id = v_ada;
  perform pg_temp.check(n = 5 + 1, 'Ada: 5 sportswear items plus the notice extra');
  select count(*) into n from private.desired_prep_items(v_house, v_monday)
   where child_id = v_ada and group_label = 'Inter-House Sports Day' and label = 'Water bottle';
  perform pg_temp.check(n = 1, 'override extras are grouped under the notice name');

  insert into public.activities (household_id, child_id, weekday, start_time, title, bring)
  values (v_house, v_tobi, 6, '08:00', 'Football academy', '{Boots,"Shin guards",Jersey,"Water bottle"}');
  select count(*) into n from private.desired_prep_items(v_house, v_saturday)
   where child_id = v_tobi and group_label = 'Football academy · 8:00 AM';
  perform pg_temp.check(n = 4, 'activity items are grouped as "Football academy · 8:00 AM"');
  select count(*) into n from private.desired_prep_items(v_house, v_saturday) where child_id = v_tobi;
  perform pg_temp.check(n = 1 + 4, 'Saturday: Casual outfit plus football kit');
  update public.activities set active = false where child_id = v_tobi;
  select count(*) into n from private.desired_prep_items(v_house, v_saturday) where child_id = v_tobi;
  perform pg_temp.check(n = 1, 'a paused activity adds nothing');
  update public.activities set active = true where child_id = v_tobi;

  -- Release -----------------------------------------------------------------------
  v_session := private.release_prep(v_house, v_monday);
  select count(*) into n from public.prep_items where session_id = v_session;
  perform pg_temp.check(n = 6 + 4, 'release snapshots both children''s items');
  perform pg_temp.check(
    (select deadline_at from public.prep_sessions where id = v_session) = '2026-11-01 19:00:00+00',
    'deadline is 8:00 PM Lagos time the evening before');
  select count(*), max(body) into n, v_text from public.notifications where dedupe_key = 'prep_release:' || v_session;
  perform pg_temp.check(n = 1, 'only the nanny is told the list is ready');
  perform pg_temp.check(v_text = 'Prep for Monday: 2 children, 10 items. Finish by 8:00 PM.', 'release message: ' || v_text);
  perform pg_temp.check(private.release_prep(v_house, v_monday) is null, 'releasing twice does nothing');
  select count(*) into n from public.notifications where kind = 'prep_release' and household_id = v_house;
  perform pg_temp.check(n = 1, 'no duplicate release notification');

  update public.weekly_routine set outfit_id = v_church where child_id = v_tobi and weekday = 1;
  select count(*) into n from public.prep_items where session_id = v_session and child_id = v_tobi;
  perform pg_temp.check(n = 4, 'later routine edits don''t change tonight''s snapshot');

  -- Nanny sees it -------------------------------------------------------------------
  perform pg_temp.act_as(nanny);
  select count(*) into n from public.prep_items where session_id = v_session;
  perform pg_temp.check(n = 10, 'nanny reads tonight''s items');
  v_json := public.prep_overview();
  perform pg_temp.check(v_json ? 'deadline_time' and v_json->>'deadline_time' = '8:00 PM', 'overview gives the deadline to the nanny');

  -- Rebuild keeps ticks ------------------------------------------------------------
  select id into v_item from public.prep_items where session_id = v_session and child_id = v_ada and label = 'Trainers';
  perform public.tick_item(v_item, true);
  perform pg_temp.check(pg_temp.fails(format($$select public.rebuild_prep_session(%L)$$, v_session)),
    'nanny cannot rebuild the list');
  perform pg_temp.act_as(mum);
  perform public.rebuild_prep_session(v_session);
  select count(*) into n from public.prep_items where session_id = v_session and child_id = v_tobi;
  perform pg_temp.check(n = 2, 'rebuild picks up the routine change (Church clothes: 2 items)');
  select count(*) into n from public.prep_items where id = v_item and checked_at is not null;
  perform pg_temp.check(n = 1, 'rebuild keeps items already ticked');

  -- All ready -----------------------------------------------------------------------
  perform pg_temp.act_as(nanny);
  perform public.tick_item(id, true) from public.prep_items where session_id = v_session;
  perform pg_temp.act_as_admin();
  select count(*), max(body) into n, v_text from public.notifications where dedupe_key = 'all_ready:' || v_session;
  perform pg_temp.check(n = 2, 'both parents are told everyone is ready');
  perform pg_temp.check(v_text like 'All 2 children are ready for Monday. Finished at %', 'all-ready message: ' || v_text);

  update public.households set notify_parents_all_ready = false where id = v_house;
  update public.prep_items set checked_at = null where id = v_item;
  update public.prep_items set checked_at = now() where id = v_item;
  select count(*) into n from public.notifications where kind = 'all_ready' and household_id = v_house;
  perform pg_temp.check(n = 2, 'no repeat all-ready after untick and re-tick');

  -- Deadline ------------------------------------------------------------------------
  v_session := private.release_prep(v_house, v_saturday);
  update public.prep_sessions set deadline_at = now() - interval '1 minute' where id = v_session;
  perform public.run_scheduler();
  perform pg_temp.check((select status from public.prep_sessions where id = v_session) = 'overdue',
    'unfinished prep is marked overdue at the deadline');
  select count(*) into n from public.notifications
   where dedupe_key = 'prep_overdue:' || v_session and channels = '{push,sms}';
  perform pg_temp.check(n = 2, 'both parents get push and SMS');
  select body into v_text from public.notifications n2 join public.members m on m.id = n2.member_id
   where n2.dedupe_key = 'prep_overdue:' || v_session and m.role = 'parent' limit 1;
  perform pg_temp.check(v_text = 'Prep for Saturday missed the 8:00 PM deadline. Ada: 1 item left. Tobi: 5 items left.',
    'parent overdue message: ' || v_text);
  select body into v_text from public.notifications n2 join public.members m on m.id = n2.member_id
   where n2.dedupe_key = 'prep_overdue:' || v_session and m.role = 'nanny';
  perform pg_temp.check(v_text = 'Ada and Tobi are not finished. Mrs Okafor and Mr Okafor have been notified.',
    'nanny overdue message: ' || v_text);
  perform public.run_scheduler();
  select count(*) into n from public.notifications where kind = 'prep_overdue' and household_id = v_house;
  perform pg_temp.check(n = 3, 'no duplicate overdue alerts on the next run');

  update public.households set sms_backup = false where id = v_house;
  v_session := private.release_prep(v_house, '2026-11-09');
  update public.prep_sessions set deadline_at = now() - interval '1 minute' where id = v_session;
  perform public.run_scheduler();
  select count(*) into n from public.notifications where dedupe_key = 'prep_overdue:' || v_session and 'sms' = any (channels);
  perform pg_temp.check(n = 0, 'no SMS when SMS backup is off');

  v_session := private.release_prep(v_house, '2026-11-10');
  update public.prep_sessions set deadline_at = now() - interval '3 hours' where id = v_session;
  perform public.run_scheduler();
  select count(*) into n from public.notifications where dedupe_key = 'prep_overdue:' || v_session;
  perform pg_temp.check(n = 0, 'stale misses (scheduler was down) are marked but not announced');

  -- Scheduler release window ---------------------------------------------------------
  delete from public.prep_sessions where household_id = v_house;
  update public.households set prep_release_time = '00:00', prep_deadline_time = '23:59', prep_nudge_time = '00:00'
   where id = v_house;
  perform public.run_scheduler();
  select count(*) into n from public.prep_sessions where household_id = v_house
     and for_date = (now() at time zone 'Africa/Lagos')::date + 1;
  perform pg_temp.check(n = 1 or (now() at time zone 'Africa/Lagos')::time >= '23:59',
    'scheduler releases tomorrow''s prep inside the window');
  select count(*) into n from public.notifications where kind = 'prep_nudge' and household_id = v_house;
  perform pg_temp.check(n = 1 or (now() at time zone 'Africa/Lagos')::time >= '23:59',
    'nudge goes out when nothing is ticked by the nudge time');
  perform public.run_scheduler();
  select count(*) into n from public.prep_sessions where household_id = v_house;
  perform pg_temp.check(n <= 1, 'scheduler does not release twice');

  -- Activity reminder --------------------------------------------------------------
  if (now() at time zone 'Africa/Lagos')::time between '01:00' and '22:30' then
    insert into public.activities (household_id, child_id, weekday, start_time, title, bring)
    values (v_house, v_tobi, extract(isodow from (now() at time zone 'Africa/Lagos'))::int,
            date_trunc('minute', (now() at time zone 'Africa/Lagos')::time + interval '40 minutes'),
            'Swimming', '{Goggles,Towel}');
    perform public.run_scheduler();
    select count(*), max(body) into n, v_text from public.notifications
     where kind = 'activity' and household_id = v_house and title = 'Swimming soon';
    perform pg_temp.check(n = 1, 'activity reminder goes to the nanny only (parents opted out)');
    perform pg_temp.check(v_text like 'Tobi: Swimming at % Leave by %. Bring goggles and towel.', 'activity message: ' || v_text);
  end if;

  -- PIN lockout tells parents --------------------------------------------------------
  insert into public.security_events (household_id, member_id, kind)
  select v_house, id, 'pin_paused' from public.members where household_id = v_house and role = 'nanny';
  select count(*), max(body) into n, v_text from public.notifications where kind = 'pin_paused' and household_id = v_house;
  perform pg_temp.check(n = 2, 'both parents are told about wrong PIN attempts');
  perform pg_temp.check(v_text = 'Someone entered the wrong PIN for Blessing 5 times. Sign-in is paused for 15 minutes.',
    'lockout message: ' || v_text);

  -- Test notification -----------------------------------------------------------------
  perform pg_temp.act_as(nanny);
  perform public.send_test_notification();
  perform pg_temp.act_as_admin();
  select count(*) into n from public.notifications n2 join public.members m on m.id = n2.member_id
   where n2.kind = 'test' and m.user_id = nanny;
  perform pg_temp.check(n = 1, 'test notification goes to the caller only');

  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
  perform pg_temp.check(pg_temp.fails('select public.run_scheduler()'), 'users cannot run the scheduler');
end
$test$;

rollback;
