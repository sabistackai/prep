-- Week 3: phone setup guide. A test notification sent a couple of minutes later, so it
-- can be checked with PREP closed and the phone locked: the case battery savers on
-- Tecno, Infinix and itel phones break.

create table private.scheduled_tests (
  member_id uuid primary key references public.members on delete cascade,  -- one pending test each
  due_at timestamptz not null
);

drop function public.send_test_notification();

-- Test notification for the caller's own devices, now or in p_delay_minutes (1-10).
create function public.send_test_notification(p_delay_minutes int default 0) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_member uuid := private.my_member_id();
begin
  if v_member is null then
    raise exception 'not a member' using errcode = '42501';
  end if;
  if p_delay_minutes > 0 then
    insert into private.scheduled_tests (member_id, due_at)
    values (v_member, now() + make_interval(mins => least(p_delay_minutes, 10)))
    on conflict (member_id) do update set due_at = excluded.due_at;
    return;
  end if;
  perform private.notify(v_member, 'test', 'test:' || gen_random_uuid(),
                         'PREP notifications are working',
                         'You''ll get reminders like this on this phone.', '/');
end $$;

revoke execute on function public.send_test_notification(int) from public, anon;
grant execute on function public.send_test_notification(int) to authenticated;

-- pg_cron, every minute.
create function private.send_scheduled_tests() returns int
language plpgsql security definer set search_path = ''
as $$
declare
  t private.scheduled_tests;
  n int := 0;
begin
  for t in delete from private.scheduled_tests where due_at <= now() returning * loop
    perform private.notify(t.member_id, 'test', 'test:' || gen_random_uuid(),
                           'PREP test: it works with the phone locked',
                           'Reminders will reach this phone even when PREP is closed.', '/');
    n := n + 1;
  end loop;
  return n;
end $$;

select cron.schedule('prep-scheduled-tests', '* * * * *', 'select private.send_scheduled_tests()');
