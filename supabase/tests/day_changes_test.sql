-- One-day change checks: saving, checklist contents, rebuilding a list already sent,
-- the nanny's message, removing, and who may do it. Run with: npm run test:db

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'day-mum@example.invalid'),
  ('00000000-0000-0000-0000-0000000000c3', 'day-nanny@example.invalid'),
  ('00000000-0000-0000-0000-0000000000c5', 'day-other@example.invalid');

do $test$
declare
  mum   constant uuid := '00000000-0000-0000-0000-0000000000c1';
  nanny constant uuid := '00000000-0000-0000-0000-0000000000c3';
  other constant uuid := '00000000-0000-0000-0000-0000000000c5';
  v_day constant date := '2036-11-10';   -- a Monday: Uniform in the default routine
  v_house uuid;
  v_ada uuid;
  v_tobi uuid;
  v_sports uuid;
  v_session uuid;
  v_override uuid;
  v_text text;
  n int;
begin
  perform pg_temp.act_as(mum);
  v_house := public.create_household('Days', 'Mrs Okafor');
  perform pg_temp.act_as_admin();
  insert into public.members (household_id, user_id, role, display_name, phone)
    values (v_house, nanny, 'nanny', 'Blessing', '+2348030000049');
  insert into public.children (household_id, name, sort) values (v_house, 'Ada', 0) returning id into v_ada;
  insert into public.children (household_id, name, sort) values (v_house, 'Tobi', 1) returning id into v_tobi;
  select id into v_sports from public.outfits where household_id = v_house and name = 'Sportswear';

  -- Before the list goes out --------------------------------------------------------
  perform pg_temp.act_as(mum);
  perform public.save_day_change(v_day, array[v_ada, v_tobi], v_sports, array[' Water bottle ', '', 'House badge'],
                                 'Inter-house sports');
  perform pg_temp.act_as_admin();
  select count(*) into n from public.overrides where on_date = v_day and source = 'manual';
  perform pg_temp.check(n = 2, 'one change covers both children');
  select count(*) into n from public.notifications where kind = 'day_change' and household_id = v_house;
  perform pg_temp.check(n = 0, 'no message while the list has not gone out');

  v_session := private.release_prep(v_house, v_day);
  select count(*) into n from public.prep_items where session_id = v_session and child_id = v_ada and group_label = 'Sportswear';
  perform pg_temp.check(n = 5, 'the list uses the changed outfit');
  select string_agg(label, ', ' order by sort) into v_text from public.prep_items
   where session_id = v_session and child_id = v_ada and group_label = 'Inter-house sports';
  perform pg_temp.check(v_text = 'Water bottle, House badge', 'extras trimmed, blanks dropped, under the reason: ' || coalesce(v_text, 'none'));

  -- After the list went out: rebuild, keep ticks, tell the nanny ----------------------
  update public.prep_items set checked_at = now() where session_id = v_session and child_id = v_tobi and label = 'Trainers';
  perform pg_temp.act_as(mum);
  perform public.save_day_change(v_day, array[v_ada], null, array['Swimming goggles']);
  perform pg_temp.act_as_admin();
  select count(*) into n from public.prep_items where session_id = v_session and child_id = v_ada and group_label = 'Uniform';
  perform pg_temp.check(n = 4, 'Ada back in her usual outfit when the change keeps it');
  select count(*) into n from public.prep_items where session_id = v_session and child_id = v_ada and label = 'Swimming goggles';
  perform pg_temp.check(n = 1, 'Ada''s new extra is on the list');
  perform pg_temp.check((select checked_at from public.prep_items where session_id = v_session and child_id = v_tobi
                          and label = 'Trainers') is not null, 'Tobi''s list and ticks are left alone');
  select title || ' / ' || body into v_text from public.notifications where kind = 'day_change' and household_id = v_house;
  perform pg_temp.check(v_text = 'Change for Monday / Also pack: swimming goggles. The checklist is updated.',
    'nanny is told: ' || coalesce(v_text, 'none'));

  perform pg_temp.act_as(mum);
  perform public.save_day_change(v_day, array[v_tobi], v_sports, '{}', 'Sports day');
  perform pg_temp.act_as_admin();
  select body into v_text from public.notifications where kind = 'day_change' and household_id = v_house
   order by sent_at desc, body like 'Sports day%' desc limit 1;
  perform pg_temp.check(v_text = 'Sports day: Tobi wears Sportswear. The checklist is updated.',
    'outfit message: ' || coalesce(v_text, 'none'));

  -- Removing ----------------------------------------------------------------------------
  select id into v_override from public.overrides where child_id = v_ada and on_date = v_day;
  perform pg_temp.act_as(mum);
  perform public.remove_day_change(v_override);
  perform pg_temp.act_as_admin();
  select count(*) into n from public.prep_items where session_id = v_session and child_id = v_ada and label = 'Swimming goggles';
  perform pg_temp.check(n = 0, 'removing the change takes it off the list');
  select count(*) into n from public.notifications
   where kind = 'day_change' and body = 'Ada is back to the usual routine. The checklist is updated.';
  perform pg_temp.check(n = 1, 'and the nanny is told');

  -- Refusals ------------------------------------------------------------------------------
  perform pg_temp.act_as(mum);
  perform pg_temp.check(pg_temp.fails(format($$select public.save_day_change('2020-01-06', array[%L]::uuid[], %L)$$, v_ada, v_sports)),
    'a day in the past is refused');
  perform pg_temp.check(pg_temp.fails(format($$select public.save_day_change(%L, '{}'::uuid[], %L)$$, v_day, v_sports)),
    'no children is refused');
  perform pg_temp.check(pg_temp.fails(format($$select public.save_day_change(%L, array[%L]::uuid[])$$, v_day, v_ada)),
    'a change that changes nothing is refused');

  perform pg_temp.act_as(nanny);
  perform pg_temp.check(pg_temp.fails(format($$select public.save_day_change(%L, array[%L]::uuid[], %L)$$, v_day, v_ada, v_sports)),
    'a nanny cannot change a day');

  perform pg_temp.act_as_admin();
  select id into v_override from public.overrides where child_id = v_tobi and on_date = v_day;
  perform pg_temp.act_as(other);
  perform public.create_household('Other', 'Mr Other');
  perform pg_temp.check(pg_temp.fails(format($$select public.save_day_change(%L, array[%L]::uuid[], null, array['x'])$$, v_day, v_ada)),
    'another household''s child is refused');
  perform pg_temp.check(pg_temp.fails(format($$select public.remove_day_change(%L)$$, v_override)),
    'another household cannot remove a change');
end $test$;

rollback;
