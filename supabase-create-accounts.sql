-- ============================================================
-- DO Crypto — Test & Admin Accounts
-- Run this in Supabase SQL Editor AFTER running supabase-schema.sql
-- Idempotent: safe to run multiple times
-- ============================================================
create extension if not exists pgcrypto;

-- ============================================================
-- Helper: create one auth user + identity + profile
-- ============================================================
create or replace function create_do_crypto_user(
  p_email    text,
  p_password text,
  p_role     text default 'user'
) returns void language plpgsql as $$
declare
  v_user_id uuid;
begin
  -- Skip if already exists
  if exists (select 1 from auth.users where email = p_email) then
    -- Just make sure role is correct on the profile
    update public.profiles p
    set role = p_role
    from auth.users u
    where u.email = p_email and p.id = u.id;
    return;
  end if;

  v_user_id := gen_random_uuid();

  -- 1. auth.users
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    '{}',
    false,
    now(),
    now()
  );

  -- 2. auth.identities  ← GoTrue requires this to find the user
  insert into auth.identities (
    id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    v_user_id::text,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', p_email),
    'email',
    now(), now(), now()
  );

  -- 3. profile — trigger may already have created it
  insert into public.profiles (id, email, role)
  values (v_user_id, p_email, p_role)
  on conflict (id) do update set role = excluded.role;
end;
$$;

-- ============================================================
-- Create accounts
-- ============================================================
select create_do_crypto_user('test@docrypto.ch',  'Test1234!',  'user');
select create_do_crypto_user('admin@docrypto.ch', 'Admin1234!', 'admin');

-- Cleanup helper function
drop function create_do_crypto_user(text, text, text);

-- ============================================================
-- Verify
-- ============================================================
select u.email, p.role, u.email_confirmed_at,
       (select count(*) from auth.identities i where i.user_id = u.id) as identities
from auth.users u
join public.profiles p on p.id = u.id
where u.email in ('test@docrypto.ch', 'admin@docrypto.ch');
