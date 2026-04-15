-- ============================================================
-- DO Crypto — Supabase Schema
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================

-- Enable UUID extension (already enabled on most Supabase projects)
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- profiles
-- Mirrors auth.users; populated by the trigger below.
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  role        text not null default 'user' check (role in ('user', 'admin')),
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------
-- wallets
-- One row per wallet address per user.
-- satoshi_challenge_amount: the micro-ETH amount the user must send
-- is_verified: true once the on-chain check passes
-- ------------------------------------------------------------
create table if not exists public.wallets (
  id                        uuid primary key default uuid_generate_v4(),
  user_id                   uuid not null references public.profiles(id) on delete cascade,
  address                   text not null,
  satoshi_challenge_amount  numeric(18, 8),          -- e.g. 0.00012300
  is_verified               boolean not null default false,
  verified_at               timestamptz,
  created_at                timestamptz not null default now(),
  unique (user_id, address)
);

alter table public.wallets enable row level security;

create policy "Users can view own wallets"
  on public.wallets for select
  using (auth.uid() = user_id);

create policy "Users can insert own wallets"
  on public.wallets for insert
  with check (auth.uid() = user_id);

create policy "Users can update own wallets"
  on public.wallets for update
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- transactions  (for future send/receive history)
-- ------------------------------------------------------------
create table if not exists public.transactions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  wallet_id   uuid references public.wallets(id),
  tx_hash     text,
  amount      text not null,
  token       text not null default 'ETH',
  chain_id    integer not null default 11155111,
  direction   text not null check (direction in ('in', 'out')),
  status      text not null default 'pending' check (status in ('pending', 'confirmed', 'failed')),
  created_at  timestamptz not null default now()
);

alter table public.transactions enable row level security;

create policy "Users can view own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

create policy "Users can insert own transactions"
  on public.transactions for insert
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- staking_positions  (mock data, future DeFi integration)
-- ------------------------------------------------------------
create table if not exists public.staking_positions (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  protocol     text not null,
  token        text not null default 'ETH',
  amount       text not null,
  apy_at_stake numeric(6, 2) not null,
  started_at   timestamptz not null default now(),
  status       text not null default 'active' check (status in ('active', 'unstaked'))
);

alter table public.staking_positions enable row level security;

create policy "Users can view own staking positions"
  on public.staking_positions for select
  using (auth.uid() = user_id);

create policy "Users can insert own staking positions"
  on public.staking_positions for insert
  with check (auth.uid() = user_id);
