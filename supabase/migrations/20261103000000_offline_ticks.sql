-- Week 3: offline ticking. Ticks made without signal are queued on the phone and sent
-- later with the time they were made, so "Ready at" shows when the nanny actually
-- ticked, not when the phone got signal back.

drop function public.tick_item(uuid, boolean);

-- p_at: when the tick was made (offline replays). Ignored if in the future or more
-- than 12 hours old, so a wrong phone clock can't push it far off.
create function public.tick_item(p_item_id uuid, p_checked boolean, p_at timestamptz default null)
returns public.prep_items
language plpgsql security definer set search_path = ''
as $$
declare
  v_item public.prep_items;
  v_at timestamptz := case when p_at between now() - interval '12 hours' and now() then p_at else now() end;
begin
  update public.prep_items i
     set checked_at = case when p_checked then coalesce(i.checked_at, v_at) end,
         checked_by = case when p_checked then coalesce(i.checked_by, private.my_member_id()) end
    from public.prep_sessions s
   where i.id = p_item_id and s.id = i.session_id
     and s.household_id = private.my_household_id()
  returning i.* into v_item;

  if v_item.id is null then
    raise exception 'item not found' using errcode = 'P0002';
  end if;
  return v_item;
end $$;

revoke execute on function public.tick_item(uuid, boolean, timestamptz) from public, anon;
grant execute on function public.tick_item(uuid, boolean, timestamptz) to authenticated;

-- Completed at = the last tick, not when the last tick reached the server.
create or replace function private.refresh_session_status(p_session uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_remaining int;
  v_last timestamptz;
begin
  select count(*) filter (where checked_at is null), max(checked_at) into v_remaining, v_last
  from public.prep_items where session_id = p_session;

  if v_remaining = 0 then
    update public.prep_sessions
       set status = 'complete', completed_at = coalesce(v_last, now())
     where id = p_session and status <> 'complete';
  else
    update public.prep_sessions
       set status = case when now() >= deadline_at then 'overdue'::public.session_status
                         else 'pending'::public.session_status end,
           completed_at = null
     where id = p_session and status = 'complete';
  end if;
end $$;
