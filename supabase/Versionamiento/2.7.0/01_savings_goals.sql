-- v2.7.0 · 01 — Ahorros y metas.
--
-- Una meta tiene un objetivo (monto, moneda y fecha opcional) y se liga a una
-- cuenta (normalmente de ahorro). Lo ahorrado es el saldo de esa cuenta; los
-- aportes son transferencias hacia ella (no se guardan aparte). Una cuenta
-- tiene como máximo una meta activa (S1).
--
-- Ejecutar DESPUÉS de 00_plans.sql. Idempotente.

create table if not exists public.savings_goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid()
                  references auth.users (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 60),
  target_amount numeric(14, 2) not null check (target_amount > 0),
  currency      text not null default 'CRC' check (currency in ('CRC', 'USD')),
  target_date   date,
  account_id    uuid references public.accounts (id) on delete set null,
  icon          text check (icon is null or icon ~ '^[a-z][a-z0-9-]{0,39}$'),
  archived      boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table public.savings_goals enable row level security;

drop policy if exists savings_goals_select_own on public.savings_goals;
drop policy if exists savings_goals_insert_own on public.savings_goals;
drop policy if exists savings_goals_update_own on public.savings_goals;
drop policy if exists savings_goals_delete_own on public.savings_goals;
create policy savings_goals_select_own on public.savings_goals
  for select using (auth.uid() = user_id);
create policy savings_goals_insert_own on public.savings_goals
  for insert with check (auth.uid() = user_id);
create policy savings_goals_update_own on public.savings_goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy savings_goals_delete_own on public.savings_goals
  for delete using (auth.uid() = user_id);

create index if not exists savings_goals_user_idx
  on public.savings_goals (user_id) where not archived;

-- S1: una meta activa por cuenta. Choque → 23505.
create unique index if not exists savings_goals_account_unique
  on public.savings_goals (account_id)
  where account_id is not null and not archived;
