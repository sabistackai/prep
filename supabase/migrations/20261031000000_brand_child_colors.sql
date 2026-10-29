-- Brand theme: children use the brand data palette (docs/design/PREP-theme-spec.md, section 3).
alter table public.children alter column color set default '#F4B740';

-- Re-colour children still on the old lime default, in the palette order by sort.
with ordered as (
  select id, (row_number() over (partition by household_id order by sort, name) - 1) % 6 as n
  from public.children
  where lower(color) = '#84cc16'
)
update public.children c
   set color = (array['#F4B740', '#8E97CC', '#5BD1B3', '#FF8A5B', '#F2A7C3', '#7CC4F2'])[o.n + 1]
  from ordered o
 where o.id = c.id;
