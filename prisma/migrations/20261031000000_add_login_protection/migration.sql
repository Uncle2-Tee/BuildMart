create table if not exists public.login_protection (
  scope text not null,
  identifier text not null,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  request_count integer not null default 0 check (request_count >= 0),
  window_started_at timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (scope, identifier)
);

alter table public.login_protection enable row level security;
revoke all on public.login_protection from anon, authenticated;
grant all on public.login_protection to service_role;

create or replace function public.consume_login_ip_rate_limit(p_ip text)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_record public.login_protection%rowtype;
  window_seconds constant integer := 15 * 60;
  maximum_requests constant integer := 10;
begin
  insert into public.login_protection(scope, identifier)
  values ('ip', left(p_ip, 200))
  on conflict (scope, identifier) do nothing;

  select * into current_record
  from public.login_protection
  where scope = 'ip' and identifier = left(p_ip, 200)
  for update;

  if current_record.window_started_at <= now() - make_interval(secs => window_seconds) then
    update public.login_protection
    set request_count = 1, window_started_at = now(), updated_at = now()
    where scope = 'ip' and identifier = left(p_ip, 200);
    return query select true, 0;
  end if;

  if current_record.request_count >= maximum_requests then
    return query select false, greatest(1, ceil(extract(epoch from (
      current_record.window_started_at + make_interval(secs => window_seconds) - now()
    )))::integer);
    return;
  end if;

  update public.login_protection
  set request_count = request_count + 1, updated_at = now()
  where scope = 'ip' and identifier = left(p_ip, 200);
  return query select true, 0;
end;
$$;

create or replace function public.check_login_account_lockout(p_account_key text)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_record public.login_protection%rowtype;
begin
  select * into current_record
  from public.login_protection
  where scope = 'account' and identifier = left(p_account_key, 300)
  for update;

  if not found or current_record.locked_until is null or current_record.locked_until <= now() then
    return query select true, 0;
    return;
  end if;

  return query select false, greatest(1, ceil(extract(epoch from (
    current_record.locked_until - now()
  )))::integer);
end;
$$;

create or replace function public.record_login_failure(p_account_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_record public.login_protection%rowtype;
  failure_window constant interval := interval '15 minutes';
  maximum_failures constant integer := 5;
begin
  insert into public.login_protection(scope, identifier)
  values ('account', left(p_account_key, 300))
  on conflict (scope, identifier) do nothing;

  select * into current_record
  from public.login_protection
  where scope = 'account' and identifier = left(p_account_key, 300)
  for update;

  if current_record.window_started_at <= now() - failure_window then
    update public.login_protection
    set failed_attempts = 1,
        window_started_at = now(),
        locked_until = null,
        updated_at = now()
    where scope = 'account' and identifier = left(p_account_key, 300);
  else
    update public.login_protection
    set failed_attempts = failed_attempts + 1,
        locked_until = case
          when failed_attempts + 1 >= maximum_failures then now() + failure_window
          else locked_until
        end,
        updated_at = now()
    where scope = 'account' and identifier = left(p_account_key, 300);
  end if;
end;
$$;

create or replace function public.clear_login_failures(p_account_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.login_protection
  where scope = 'account' and identifier = left(p_account_key, 300);
end;
$$;

revoke all on function public.consume_login_ip_rate_limit(text) from public, anon, authenticated;
revoke all on function public.check_login_account_lockout(text) from public, anon, authenticated;
revoke all on function public.record_login_failure(text) from public, anon, authenticated;
revoke all on function public.clear_login_failures(text) from public, anon, authenticated;
grant execute on function public.consume_login_ip_rate_limit(text) to service_role;
grant execute on function public.check_login_account_lockout(text) to service_role;
grant execute on function public.record_login_failure(text) to service_role;
grant execute on function public.clear_login_failures(text) to service_role;

notify pgrst, 'reload schema';
