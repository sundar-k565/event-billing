-- Local PostgreSQL only. The auth schema preserves the existing business schema contracts.
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='waaat_app') then create role waaat_app login noinherit; end if;
end $$;
grant authenticated to waaat_app;
revoke create on schema public from public;
create schema auth;
revoke all on schema auth from public;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email=lower(trim(email))),
  password_hash text,
  raw_user_meta_data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table auth.sessions (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index sessions_expiry on auth.sessions(expires_at);
create index sessions_user on auth.sessions(user_id);
create table auth.login_attempts (
  email text primary key,
  failures integer not null default 0,
  window_start timestamptz not null default now()
);
create function auth.uid() returns uuid
language sql stable security definer set search_path=auth,pg_temp as $$
  select user_id from auth.sessions
  where token_hash=nullif(current_setting('app.session_hash',true),'') and expires_at>now()
$$;
revoke all on function auth.uid() from public;
grant usage on schema public,auth to authenticated,waaat_app;
grant execute on function auth.uid() to authenticated,waaat_app;
grant select(id,email,password_hash) on auth.users to waaat_app;
grant select,insert,delete on auth.sessions to waaat_app;
grant select,insert,update,delete on auth.login_attempts to waaat_app;
