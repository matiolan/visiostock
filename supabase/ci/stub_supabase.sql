-- Solo para el pipeline (PostgreSQL limpio): reproduce lo mínimo de Supabase Auth que usan
-- esquema.sql y las pruebas SQL. Mismas firmas y misma forma de leer el JWT que Supabase.
-- No se ejecuta en producción.
do $$ begin
 if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
 if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key, email text);
create type auth.factor_status as enum ('unverified', 'verified');
create table auth.mfa_factors (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 factor_type text not null default 'totp',
 status auth.factor_status not null
);
create function auth.jwt() returns jsonb language sql stable as $$
 select coalesce(nullif(current_setting('request.jwt.claim', true), ''),
                 nullif(current_setting('request.jwt.claims', true), ''))::jsonb
$$;
create function auth.uid() returns uuid language sql stable as $$
 select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                 (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.jwt(), auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
