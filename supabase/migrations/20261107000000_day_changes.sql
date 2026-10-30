-- Week 3: one-day changes entered by a parent ("Monday: Ada wears Sportswear, bring a
-- water bottle"). Stored as manual overrides, which the checklist already uses.
-- If that day's list has already gone out, it is rebuilt for those children (ticks
-- kept) and the nanny is told.

-- Rebuild a released list for some children and tell the nannies what changed.
create function private.apply_day_change(p_household uuid, p_date date, p_children uuid[], p_title text, p_body text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_session uuid;
begin
  select id into v_session from public.prep_sessions where household_id = p_household and for_date = p_date;
  if v_session is null then
    return;  -- not sent yet: the change is simply part of the list when it goes out
  end if;
  perform private.rebuild_session_items(v_session, p_children);
  perform private.notify_role(p_household, 'nanny', 'day_change', 'day_change:' || gen_random_uuid(),
                              p_title, p_body, '/nanny');
end $$;

create function public.save_day_change(
  p_on_date date, p_children uuid[], p_outfit_id uuid default null,
  p_extra_items text[] default '{}', p_note text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  h public.households;
  v_extras text[];
  v_note text := nullif(btrim(p_note), '');
  v_names text[];
  v_outfit text;
begin
  if not private.is_parent() then
    raise exception 'Only parents can change a day.' using errcode = '42501';
  end if;
  select * into h from public.households where id = private.my_household_id();

  select coalesce(array_agg(btrim(x) order by ord), '{}') into v_extras
  from unnest(p_extra_items) with ordinality as u(x, ord) where btrim(x) <> '';

  if p_on_date < (now() at time zone h.timezone)::date then
    raise exception 'That day has already passed.' using errcode = '23514';
  end if;
  if coalesce(cardinality(p_children), 0) = 0 then
    raise exception 'Pick at least one child.' using errcode = '23514';
  end if;
  if p_outfit_id is null and cardinality(v_extras) = 0 then
    raise exception 'Choose a different outfit or add something to pack.' using errcode = '23514';
  end if;
  if p_outfit_id is not null then
    select name into v_outfit from public.outfits where id = p_outfit_id and household_id = h.id;
    if v_outfit is null then
      raise exception 'That outfit doesn''t exist.' using errcode = '23514';
    end if;
  end if;

  select array_agg(name order by sort, name) into v_names
  from public.children where id = any (p_children) and household_id = h.id;
  if coalesce(cardinality(v_names), 0) <> cardinality(p_children) then
    raise exception 'Pick children from this household.' using errcode = '23514';
  end if;

  insert into public.overrides (child_id, on_date, outfit_id, extra_items, source, note)
  select c, p_on_date, p_outfit_id, v_extras, 'manual', v_note from unnest(p_children) as c
  on conflict (child_id, on_date, source) do update
    set outfit_id = excluded.outfit_id, extra_items = excluded.extra_items, note = excluded.note;

  perform private.apply_day_change(
    h.id, p_on_date, p_children,
    'Change for ' || private.fmt_day(p_on_date),
    concat_ws(' ',
      v_note || ':',
      case when v_outfit is not null
           then format('%s %s %s.', private.join_names(v_names),
                       case when cardinality(v_names) = 1 then 'wears' else 'wear' end, v_outfit) end,
      case when cardinality(v_extras) > 0
           then 'Also pack: ' || lower(private.join_names(v_extras)) || '.' end,
      'The checklist is updated.'));
end $$;

create function public.remove_day_change(p_override_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  o public.overrides;
  c public.children;
begin
  delete from public.overrides ov
   using public.children ch
   where ov.id = p_override_id and ch.id = ov.child_id
     and ch.household_id = private.my_household_id() and private.is_parent()
     and ov.source = 'manual'
  returning ov.* into o;
  if o.id is null then
    raise exception 'change not found' using errcode = 'P0002';
  end if;
  select * into c from public.children where id = o.child_id;

  perform private.apply_day_change(
    c.household_id, o.on_date, array[o.child_id],
    'Change cancelled for ' || private.fmt_day(o.on_date),
    format('%s is back to the usual routine. The checklist is updated.', c.name));
end $$;

revoke execute on function
  public.save_day_change(date, uuid[], uuid, text[], text), public.remove_day_change(uuid)
from public, anon;
grant execute on function
  public.save_day_change(date, uuid[], uuid, text[], text), public.remove_day_change(uuid)
to authenticated;
