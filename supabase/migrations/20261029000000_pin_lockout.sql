-- Per-phone lockout for nanny PIN sign-in.
-- 5 wrong PINs pause sign-in for 15 minutes; 10 in 24 hours lock it until a
-- parent issues a new setup link. A correct PIN resets the count.
--
-- Every attempt is counted as a failure BEFORE the password is checked, and
-- cleared on success, so parallel requests can't slip past the limit.

create table private.login_attempts (
  phone text primary key,                         -- E.164
  recent_failures int not null default 0,         -- since the last pause or success
  daily_failures int not null default 0,          -- within the current 24-hour window
  window_started_at timestamptz not null default now(),
  paused_until timestamptz,
  locked boolean not null default false,          -- cleared only by a new setup link
  updated_at timestamptz not null default now()
);

-- Lockouts, for parents to see (and, from Week 2, to be notified about).
create table public.security_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  member_id uuid references public.members on delete cascade,
  kind text not null check (kind in ('pin_paused', 'pin_locked')),
  created_at timestamptz not null default now()
);
create index on public.security_events (household_id, created_at desc);

alter table public.security_events enable row level security;
create policy "parents read security events" on public.security_events for select to authenticated
  using (household_id = (select private.my_household_id()) and (select private.is_parent()));
revoke all on public.security_events from anon;
revoke insert, update, delete on public.security_events from authenticated;

create function private.record_pin_event(p_phone text, p_kind text) returns void
language sql security definer set search_path = ''
as $$
  insert into public.security_events (household_id, member_id, kind)
  select household_id, id, p_kind from public.members where phone = p_phone and role = 'nanny';
$$;

-- Applies the limits to a row already locked FOR UPDATE; returns 'ok' | 'paused' | 'locked'.
create function private.apply_pin_limits(r private.login_attempts) returns text
language plpgsql security definer set search_path = ''
as $$
begin
  if r.locked then
    return 'locked';
  end if;
  if r.paused_until > now() then
    return 'paused';
  end if;
  if r.daily_failures >= 10 then
    update private.login_attempts set locked = true, paused_until = null, updated_at = now() where phone = r.phone;
    perform private.record_pin_event(r.phone, 'pin_locked');
    return 'locked';
  end if;
  if r.recent_failures >= 5 then
    update private.login_attempts
       set paused_until = now() + interval '15 minutes', recent_failures = 0, updated_at = now()
     where phone = r.phone;
    perform private.record_pin_event(r.phone, 'pin_paused');
    return 'paused';
  end if;
  return 'ok';
end $$;

-- Call before checking a PIN. 'ok' means go ahead (the attempt is already counted).
create function public.pin_attempt_start(p_phone text) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  r private.login_attempts;
  v_state text;
begin
  insert into private.login_attempts (phone) values (p_phone) on conflict (phone) do nothing;
  select * into r from private.login_attempts where phone = p_phone for update;

  if r.window_started_at < now() - interval '24 hours' and not r.locked then
    update private.login_attempts
       set daily_failures = 0, window_started_at = now()
     where phone = p_phone
    returning * into r;
  end if;

  v_state := private.apply_pin_limits(r);
  if v_state <> 'ok' then
    return v_state;
  end if;

  update private.login_attempts
     set recent_failures = recent_failures + 1, daily_failures = daily_failures + 1, updated_at = now()
   where phone = p_phone;
  return 'ok';
end $$;

-- Call after a wrong PIN, to report whether that attempt tipped the limit.
create function public.pin_attempt_failed(p_phone text) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  r private.login_attempts;
begin
  select * into r from private.login_attempts where phone = p_phone for update;
  if r.phone is null then
    return 'ok';
  end if;
  return private.apply_pin_limits(r);
end $$;

-- Call after a correct PIN, and when a parent issues a new setup link.
create function public.pin_attempts_reset(p_phone text) returns void
language sql security definer set search_path = ''
as $$
  delete from private.login_attempts where phone = p_phone;
$$;

-- Only the server (secret key) may call these.
revoke execute on function
  public.pin_attempt_start(text),
  public.pin_attempt_failed(text),
  public.pin_attempts_reset(text)
from public, anon, authenticated;

grant execute on function
  public.pin_attempt_start(text),
  public.pin_attempt_failed(text),
  public.pin_attempts_reset(text)
to service_role;

-- A new setup link also lifts any lockout on that nanny's phone.
create or replace function public.reset_nanny_setup(p_member_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
  v_phone text;
begin
  update public.members
     set setup_token = v_token, setup_token_expires_at = now() + interval '7 days'
   where id = p_member_id and role = 'nanny'
     and household_id = private.my_household_id() and private.is_parent()
  returning phone into v_phone;
  if not found then
    raise exception 'nanny not found' using errcode = 'P0002';
  end if;

  delete from private.login_attempts where phone = v_phone;
  return v_token;
end $$;
