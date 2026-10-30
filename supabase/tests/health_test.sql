-- "Notifications may be off" checks. Run with: npm run test:db

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'health-mum@example.invalid'),
  ('00000000-0000-0000-0000-0000000000d3', 'health-nanny@example.invalid');

do $test$
declare
  mum   constant uuid := '00000000-0000-0000-0000-0000000000d1';
  nanny constant uuid := '00000000-0000-0000-0000-0000000000d3';
  v_house uuid;
  v_nanny uuid;
  v_sub uuid;
  v_json jsonb;
begin
  perform pg_temp.act_as(mum);
  v_house := public.create_household('Health', 'Mrs Okafor');
  perform pg_temp.act_as_admin();
  insert into public.members (household_id, user_id, role, display_name, phone)
    values (v_house, nanny, 'nanny', 'Blessing', '+2348030000029') returning id into v_nanny;
  insert into public.members (household_id, role, display_name, phone)
    values (v_house, 'nanny', 'Not set up yet', '+2348030000039');

  perform pg_temp.act_as(mum);
  v_json := public.notification_health();
  perform pg_temp.check(jsonb_array_length(v_json) = 1 and v_json->0->>'status' = 'off' and v_json->0->>'name' = 'Blessing',
    'a set-up nanny with no device is flagged off (not one still waiting for setup): ' || v_json::text);

  perform pg_temp.act_as_admin();
  insert into public.push_subscriptions (member_id, endpoint, p256dh, auth, created_at)
    values (v_nanny, 'https://push.example/h1', 'k', 'a', now() - interval '2 hours') returning id into v_sub;
  perform pg_temp.act_as(mum);
  perform pg_temp.check(public.notification_health() = '[]', 'a device and nothing sent yet: no warning');

  perform pg_temp.act_as_admin();
  insert into public.notifications (household_id, member_id, kind, dedupe_key, title, body, sent_at)
    values (v_house, v_nanny, 'test', 'h:1', 't', 'b', now() - interval '1 hour');
  perform pg_temp.act_as(mum);
  v_json := public.notification_health();
  perform pg_temp.check(v_json->0->>'status' = 'failing', 'the last notification reached no device: failing');

  perform pg_temp.act_as_admin();
  update public.push_subscriptions set last_ok_at = now() - interval '59 minutes' where id = v_sub;
  perform pg_temp.act_as(mum);
  perform pg_temp.check(public.notification_health() = '[]', 'it reached the phone: no warning');

  perform pg_temp.act_as_admin();
  insert into public.notifications (household_id, member_id, kind, dedupe_key, title, body, sent_at)
    values (v_house, v_nanny, 'test', 'h:2', 't', 'b', now() - interval '5 minutes');
  perform pg_temp.act_as(mum);
  perform pg_temp.check(public.notification_health() = '[]', 'one sent 5 minutes ago is still within its retry time');

  perform pg_temp.act_as_admin();
  update public.notifications set sent_at = now() - interval '30 minutes' where dedupe_key = 'h:2';
  perform pg_temp.act_as(mum);
  perform pg_temp.check(public.notification_health()->0->>'status' = 'failing', 'a later one that never arrived: failing');

  perform pg_temp.act_as_admin();
  insert into public.push_subscriptions (member_id, endpoint, p256dh, auth)
    values (v_nanny, 'https://push.example/h2', 'k', 'a');
  perform pg_temp.act_as(mum);
  perform pg_temp.check(public.notification_health() = '[]', 'turning notifications on again clears it');

  perform pg_temp.act_as_admin();
  delete from public.push_subscriptions where member_id = v_nanny;
  perform pg_temp.act_as(nanny);
  perform pg_temp.check(public.notification_health() = '[]', 'only parents see the warning');
end $test$;

rollback;
