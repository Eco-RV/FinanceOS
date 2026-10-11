-- v2.0.0 · 06 — Tarjeta bimoneda (T1, T2) y tipo de cambio manual.
--
-- Una tarjeta lleva un saldo por moneda:
--   credit_cards.current_balance  -> saldo en CRC
--   credit_cards.usd_balance      -> saldo en USD   (columna nueva)
-- Cada cargo, abono o saldo inicial de tarjeta va al saldo de SU moneda
-- (`transactions.currency`). `credit_cards.currency` pasa a ser la MONEDA DEL
-- LÍMITE (normalmente CRC). El disponible = límite − saldos convertidos con el
-- tipo de cambio que el usuario digita en Ajustes (tabla `exchange_rates`).
--
-- Migración: en las tarjetas con moneda USD, el saldo que hoy está en
-- `current_balance` (que era en dólares) se mueve a `usd_balance`, y al final se
-- recalcula todo desde los movimientos.
--
-- Ejecutar ANTES de desplegar el código que lo usa. Es idempotente.

alter table public.credit_cards
  add column if not exists usd_balance numeric(14, 2) not null default 0;

comment on column public.credit_cards.currency is 'Moneda del límite de crédito (2.0.0).';
comment on column public.credit_cards.current_balance is 'Saldo en CRC (proyección de los movimientos en CRC).';
comment on column public.credit_cards.usd_balance is 'Saldo en USD (proyección de los movimientos en USD).';

-- Saldo inicial: uno por tarjeta Y moneda.
drop index if exists public.transactions_opening_card_uidx;
create unique index if not exists transactions_opening_card_currency_uidx
  on public.transactions (card_id, currency)
  where type = 'opening_balance' and not archived and card_id is not null;

-- Trigger: en tarjetas, el saldo de la moneda del movimiento.
create or replace function public._tx_card_apply(p_card_id uuid, p_currency text, p_delta numeric)
returns void
language plpgsql
security invoker
as $$
begin
  if p_currency = 'USD' then
    update public.credit_cards set usd_balance = usd_balance + p_delta where id = p_card_id;
  else
    update public.credit_cards set current_balance = current_balance + p_delta where id = p_card_id;
  end if;
end;
$$;

create or replace function public._tx_apply(t public.transactions, dir int)
returns void
language plpgsql
security invoker
as $$
begin
  if t.archived then
    return;
  end if;

  if t.type = 'expense' then
    if t.account_id is not null then
      update public.accounts
        set current_balance = current_balance - dir * t.amount
        where id = t.account_id;
    else
      perform public._tx_card_apply(t.card_id, t.currency, dir * t.amount);
    end if;

  elsif t.type = 'income' then
    update public.accounts
      set current_balance = current_balance + dir * t.amount
      where id = t.account_id;

  elsif t.type = 'card_payment' then
    update public.accounts
      set current_balance = current_balance - dir * t.amount
      where id = t.account_id;
    perform public._tx_card_apply(t.card_id, t.currency, -dir * t.amount);

  elsif t.type = 'opening_balance' then
    if t.account_id is not null then
      update public.accounts
        set current_balance = current_balance + dir * t.amount
        where id = t.account_id;
    else
      perform public._tx_card_apply(t.card_id, t.currency, dir * t.amount);
    end if;

  elsif t.type = 'transfer' then
    update public.accounts
      set current_balance = current_balance - dir * t.amount
      where id = t.account_id;
    update public.accounts
      set current_balance = current_balance + dir * t.amount
      where id = t.to_account_id;
  end if;
end;
$$;

-- Saldo derivado: las tarjetas tienen una fila por moneda (CRC y USD); la
-- columna `currency` de la vista es la moneda del SALDO.
drop view if exists public.balance_drift;
drop view if exists public.balance_derived;

create view public.balance_derived
with (security_invoker = true) as
with effects as (
  select t.account_id as id, null::text as currency,
    case
      when t.type in ('income', 'opening_balance') then t.amount
      when t.type in ('expense', 'card_payment', 'transfer') then -t.amount
      else 0
    end as delta
  from public.transactions t
  where not t.archived and t.account_id is not null
  union all
  select t.to_account_id, null, t.amount
  from public.transactions t
  where not t.archived and t.type = 'transfer'
  union all
  select t.card_id, t.currency,
    case
      when t.type in ('expense', 'opening_balance') then t.amount
      when t.type = 'card_payment' then -t.amount
      else 0
    end
  from public.transactions t
  where not t.archived and t.card_id is not null
)
select
  'account'::text as target, a.id, a.user_id, a.currency,
  a.current_balance as stored,
  coalesce((select sum(e.delta) from effects e where e.id = a.id), 0)::numeric(14, 2) as derived
from public.accounts a
union all
select
  'card'::text, c.id, c.user_id, 'CRC'::text,
  c.current_balance,
  coalesce((select sum(e.delta) from effects e where e.id = c.id and e.currency = 'CRC'), 0)::numeric(14, 2)
from public.credit_cards c
union all
select
  'card'::text, c.id, c.user_id, 'USD'::text,
  c.usd_balance,
  coalesce((select sum(e.delta) from effects e where e.id = c.id and e.currency = 'USD'), 0)::numeric(14, 2)
from public.credit_cards c;

create view public.balance_drift
with (security_invoker = true) as
select *, stored - derived as difference
from public.balance_derived
where stored <> derived;

create or replace function public.recompute_balances()
returns integer
language plpgsql
security invoker
as $$
declare
  n_accounts integer;
  n_crc integer;
  n_usd integer;
begin
  update public.accounts a
    set current_balance = d.derived
    from public.balance_derived d
    where d.target = 'account' and d.id = a.id and a.current_balance <> d.derived;
  get diagnostics n_accounts = row_count;

  update public.credit_cards c
    set current_balance = d.derived
    from public.balance_derived d
    where d.target = 'card' and d.currency = 'CRC' and d.id = c.id
      and c.current_balance <> d.derived;
  get diagnostics n_crc = row_count;

  update public.credit_cards c
    set usd_balance = d.derived
    from public.balance_derived d
    where d.target = 'card' and d.currency = 'USD' and d.id = c.id
      and c.usd_balance <> d.derived;
  get diagnostics n_usd = row_count;

  return n_accounts + n_crc + n_usd;
end;
$$;

-- Tipo de cambio manual (T2): colones por 1 dólar, uno por fecha.
create table if not exists public.exchange_rates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
  rate_on     date not null,
  usd_crc     numeric(12, 4) not null check (usd_crc > 0),
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (user_id, rate_on)
);

alter table public.exchange_rates enable row level security;

drop policy if exists exchange_rates_select_own on public.exchange_rates;
drop policy if exists exchange_rates_insert_own on public.exchange_rates;
drop policy if exists exchange_rates_update_own on public.exchange_rates;
drop policy if exists exchange_rates_delete_own on public.exchange_rates;

create policy exchange_rates_select_own on public.exchange_rates
  for select using (auth.uid() = user_id);
create policy exchange_rates_insert_own on public.exchange_rates
  for insert with check (auth.uid() = user_id);
create policy exchange_rates_update_own on public.exchange_rates
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy exchange_rates_delete_own on public.exchange_rates
  for delete using (auth.uid() = user_id);

create index if not exists exchange_rates_user_idx
  on public.exchange_rates (user_id, rate_on desc) where not archived;

-- Migración de datos: deja cada saldo de tarjeta en su columna de moneda.
select public.recompute_balances() as filas_recalculadas;

-- Debe devolver 0 filas.
select * from public.balance_drift;
