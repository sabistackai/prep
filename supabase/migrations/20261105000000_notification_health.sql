-- Week 3: "Blessing's notifications may be off". For parents: each set-up nanny whose
-- phone can't be reached.
--   'off'     - no device has notifications turned on
--   'failing' - the latest notification sent to them (over 10 minutes ago, so retries
--               have had their chance) reached none of their devices, and no device
--               was turned on since
-- A quiet day with nothing sent never raises a warning.
create function public.notification_health() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'member_id', m.id, 'name', m.display_name, 'status', h.status, 'last_ok_at', h.last_ok_at)
         order by m.created_at), '[]'::jsonb)
  from public.members m
  cross join lateral (
    select max(s.last_ok_at) as last_ok_at,
           max(greatest(s.created_at, coalesce(s.last_ok_at, '-infinity'))) as last_good,
           count(s.id) as devices,
           (select max(n.sent_at) from public.notifications n
             where n.member_id = m.id and n.sent_at < now() - interval '10 minutes') as last_sent
    from public.push_subscriptions s where s.member_id = m.id
  ) x
  cross join lateral (
    select case when x.devices = 0 then 'off'
                when x.last_sent is not null and x.last_good < x.last_sent then 'failing'
           end as status, x.last_ok_at
  ) h
  where private.is_parent()
    and m.household_id = private.my_household_id()
    and m.role = 'nanny' and m.user_id is not null
    and h.status is not null
$$;

revoke execute on function public.notification_health() from public, anon;
grant execute on function public.notification_health() to authenticated;
