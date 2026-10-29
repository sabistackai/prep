-- Shared helpers, prepended to every *_test.sql by scripts/test-db.mjs.
-- Each test file runs in its own transaction and ends with ROLLBACK.

begin;

create function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function pg_temp.act_as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

create function pg_temp.check(p_ok boolean, p_name text) returns void language plpgsql as $$
begin
  if p_ok then raise notice 'PASS  %', p_name;
  else raise exception 'FAIL  %', p_name;
  end if;
end $$;

-- True if the statement raises an error (permission denied, RLS violation, RPC refusal).
create function pg_temp.fails(p_sql text) returns boolean language plpgsql as $$
begin
  execute p_sql;
  return false;
exception when others then
  return true;
end $$;

-- Number of rows an UPDATE/DELETE touched.
create function pg_temp.affected(p_sql text) returns int language plpgsql as $$
declare n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
exception when insufficient_privilege then
  return 0;
end $$;

grant execute on all functions in schema pg_temp to authenticated, service_role;

create function pg_temp.act_as_server() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('role', 'service_role', true);
end $$;
grant execute on function pg_temp.act_as_server() to authenticated, service_role;
