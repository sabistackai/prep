-- Activity reminders no longer give a leave-by time, so the travel time setting goes.

-- Same as before, apart from the reminder wording.
create or replace function public.run_scheduler() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  h public.households;
  s public.prep_sessions;
  a public.activities;
  v_local timestamp;
  v_today date;
  v_released int := 0;
  v_overdue int := 0;
  v_child text;
  v_lead text;
begin
  for h in select * from public.households loop
    begin
      v_local := now() at time zone h.timezone;
      v_today := v_local::date;

      -- 1. Release tomorrow's prep between release time and the deadline.
      if v_local::time >= h.prep_release_time and v_local::time < h.prep_deadline_time
         and exists (select 1 from public.children where household_id = h.id)
         and not exists (select 1 from public.prep_sessions where household_id = h.id and for_date = v_today + 1) then
        if private.release_prep(h.id, v_today + 1) is not null then
          v_released := v_released + 1;
        end if;
      end if;

      -- 2. Nudge if nothing has been ticked by the nudge time.
      if h.prep_nudge_time is not null and v_local::time >= h.prep_nudge_time
         and v_local::time < h.prep_deadline_time then
        select * into s from public.prep_sessions
         where household_id = h.id and for_date = v_today + 1 and status = 'pending';
        if found and not exists (select 1 from public.prep_items where session_id = s.id and checked_at is not null) then
          perform private.notify_role(
            h.id, 'nanny', 'prep_nudge', 'prep_nudge:' || s.id,
            'Time to start tonight''s prep',
            format('Nothing is ticked yet. Prep for %s is due by %s.',
                   private.fmt_day(s.for_date), private.fmt_time(h.prep_deadline_time)),
            '/nanny');
        end if;
      end if;

      -- 4. Activity reminders, lead minutes before each of today's activities.
      for a in
        select * from public.activities
         where household_id = h.id and active and weekday = extract(isodow from v_today)
           and v_local::time >= start_time - make_interval(mins => h.activity_lead_minutes)
           and v_local::time < start_time
      loop
        select name into v_child from public.children where id = a.child_id;
        v_lead := format('%s: %s at %s.%s',
          v_child, a.title, private.fmt_time(a.start_time),
          case when cardinality(a.bring) > 0 then ' Bring ' || lower(private.join_names(a.bring)) || '.' else '' end);
        perform private.notify_role(h.id, 'nanny', 'activity', 'activity:' || a.id || ':' || v_today,
                                    a.title || ' soon', v_lead, '/nanny/alerts');
        if h.notify_parents_activities then
          perform private.notify_role(h.id, 'parent', 'activity', 'activity:' || a.id || ':' || v_today,
                                      a.title || ' soon', v_lead, '/parent');
        end if;
      end loop;
    exception when others then
      raise warning 'run_scheduler: household % skipped: %', h.id, sqlerrm;
    end;
  end loop;

  -- 3. Deadline: mark pending sessions overdue. Only recent misses are announced,
  --    so a scheduler outage doesn't send stale alerts later.
  for s in
    update public.prep_sessions set status = 'overdue'
     where status = 'pending' and now() >= deadline_at
    returning *
  loop
    v_overdue := v_overdue + 1;
    if now() - s.deadline_at < interval '2 hours' then
      begin
        perform private.notify_overdue(s.id);
      exception when others then
        raise warning 'run_scheduler: overdue alert for session % skipped: %', s.id, sqlerrm;
      end;
    end if;
  end loop;

  return jsonb_build_object('released', v_released, 'overdue', v_overdue);
end $$;

alter table public.households drop column leave_buffer_minutes;
