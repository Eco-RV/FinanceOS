-- FinanceOS · Paso 1 — cuentas de débito y tarjetas de crédito
--
-- Cómo aplicar:
--   a) SQL Editor de Supabase: pega y ejecuta este archivo, o
--   b) CLI: `supabase db push`
--
-- Todas las tablas usan RLS y quedan aisladas por usuario (auth.uid()).

create extension if not exists pgcrypto;

-- ─────────────────────────────  accounts  ─────────────────────────────
create table if not exists public.accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid()
                    references auth.users (id) on delete cascade,
  name            text not null,
  type            text not null default 'checking'
                    check (type in ('checking', 'savings', 'cash')),
  institution     text,
  currency        text not null default 'CRC'
                    check (currency in ('CRC', 'USD')),
  current_balance numeric(14, 2) not null default 0,
  archived        boolean not null default false,
  created_at      timestamptz not null default now()
);

alter table public.accounts enable row level security;

drop policy if exists "accounts_select_own" on public.accounts;
drop policy if exists "accounts_insert_own" on public.accounts;
drop policy if exists "accounts_update_own" on public.accounts;
drop policy if exists "accounts_delete_own" on public.accounts;

create policy "accounts_select_own" on public.accounts
  for select using (auth.uid() = user_id);
create policy "accounts_insert_own" on public.accounts
  for insert with check (auth.uid() = user_id);
create policy "accounts_update_own" on public.accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "accounts_delete_own" on public.accounts
  for delete using (auth.uid() = user_id);

create index if not exists accounts_user_idx
  on public.accounts (user_id) where not archived;

-- ───────────────────────────  credit_cards  ──────────────────────────
create table if not exists public.credit_cards (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid()
                    references auth.users (id) on delete cascade,
  name            text not null,
  institution     text,
  last_four       text check (last_four is null or last_four ~ '^\d{4}$'),
  credit_limit    numeric(14, 2) check (credit_limit is null or credit_limit >= 0),
  cutoff_day      smallint not null check (cutoff_day between 1 and 31),
  payment_due_day smallint not null check (payment_due_day between 1 and 31),
  current_balance numeric(14, 2) not null default 0,
  currency        text not null default 'CRC'
                    check (currency in ('CRC', 'USD')),
  archived        boolean not null default false,
  created_at      timestamptz not null default now()
);

alter table public.credit_cards enable row level security;

drop policy if exists "cards_select_own" on public.credit_cards;
drop policy if exists "cards_insert_own" on public.credit_cards;
drop policy if exists "cards_update_own" on public.credit_cards;
drop policy if exists "cards_delete_own" on public.credit_cards;

create policy "cards_select_own" on public.credit_cards
  for select using (auth.uid() = user_id);
create policy "cards_insert_own" on public.credit_cards
  for insert with check (auth.uid() = user_id);
create policy "cards_update_own" on public.credit_cards
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "cards_delete_own" on public.credit_cards
  for delete using (auth.uid() = user_id);

create index if not exists cards_user_idx
  on public.credit_cards (user_id) where not archived;
