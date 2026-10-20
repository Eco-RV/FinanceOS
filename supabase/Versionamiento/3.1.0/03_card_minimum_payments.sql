-- v3.1.0 · 03 — Pago mínimo de la tarjeta (T8).
--
-- Lo calcula el banco; el usuario lo digita del estado de cuenta. Uno por
-- tarjeta, fecha de corte y moneda. No toca saldos: solo dice cuánto falta
-- abonar para no caer en mora. RLS + 4 policies.
--
-- Ejecutar DESPUÉS de 02_insurance_debit_card.sql. Idempotente.

create table if not exists public.card_minimum_payments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
  card_id     uuid not null references public.credit_cards (id) on delete cascade,
  cutoff_on   date not null,
  currency    text not null default 'CRC' check (currency in ('CRC', 'USD')),
  amount      numeric(14, 2) not null check (amount > 0),
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (card_id, cutoff_on, currency)
);

alter table public.card_minimum_payments enable row level security;

drop policy if exists card_minimum_payments_select_own on public.card_minimum_payments;
drop policy if exists card_minimum_payments_insert_own on public.card_minimum_payments;
drop policy if exists card_minimum_payments_update_own on public.card_minimum_payments;
drop policy if exists card_minimum_payments_delete_own on public.card_minimum_payments;
create policy card_minimum_payments_select_own on public.card_minimum_payments
  for select using (auth.uid() = user_id);
create policy card_minimum_payments_insert_own on public.card_minimum_payments
  for insert with check (auth.uid() = user_id);
create policy card_minimum_payments_update_own on public.card_minimum_payments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy card_minimum_payments_delete_own on public.card_minimum_payments
  for delete using (auth.uid() = user_id);

create index if not exists card_minimum_payments_user_idx
  on public.card_minimum_payments (user_id) where not archived;
