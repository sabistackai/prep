-- Push notifications only: SMS backup (Termii) is gone.

-- Deadline missed: parents get a push, nannies get a firmer push.
create or replace function private.notify_overdue(p_session uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  s public.prep_sessions;
  h public.households;
  v_detail text;
  v_names text[];
begin
  select * into s from public.prep_sessions where id = p_session;
  select * into h from public.households where id = s.household_id;

  select string_agg(format('%s: %s %s left', c.name, x.remaining,
                           case when x.remaining = 1 then 'item' else 'items' end), '. ' order by c.sort, c.name),
         array_agg(c.name order by c.sort, c.name)
    into v_detail, v_names
  from (select child_id, count(*) as remaining
        from public.prep_items where session_id = p_session and checked_at is null
        group by child_id) x
  join public.children c on c.id = x.child_id;

  perform private.notify_role(
    s.household_id, 'parent', 'prep_overdue', 'prep_overdue:' || p_session,
    'Prep isn''t finished',
    format('Prep for %s missed the %s deadline. %s.', private.fmt_day(s.for_date),
           private.fmt_time(h.prep_deadline_time), v_detail),
    '/parent');

  perform private.notify_role(
    s.household_id, 'nanny', 'prep_overdue', 'prep_overdue:' || p_session,
    'Prep is overdue',
    format('%s %s not finished. %s %s been notified.',
           private.join_names(v_names), case when cardinality(v_names) = 1 then 'is' else 'are' end,
           private.parent_names(s.household_id),
           case when (select count(*) from public.members
                      where household_id = s.household_id and role = 'parent') = 1 then 'has' else 'have' end),
    '/nanny');
end $$;

alter table public.households drop column sms_backup;

-- Parent phone numbers were only collected for SMS; nannies still sign in with theirs.
update public.members set phone = null where role = 'parent';
comment on column public.members.phone is 'E.164; nanny sign-in';
