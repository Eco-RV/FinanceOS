-- v2.8.0 · 02 — Abono a tarjeta en otra moneda, con tipo de cambio (M5).
--
-- Antes un abono (`card_payment`) bajaba el saldo de la tarjeta en la moneda
-- de la CUENTA, sin conversión. Desde 2.8.0 el abono puede ir al saldo en la
-- otra moneda de la tarjeta (p. ej. pagar en dólares una suscripción cobrada
-- en USD desde una cuenta en colones). La app convierte con el último tipo de
-- cambio digitado (Ajustes → Tipo de cambio) y guarda:
--   amount, currency  -> lo que baja la DEUDA de la tarjeta (en esa moneda)
--   account_amount    -> lo que sale de la CUENTA (en la moneda de la cuenta)
--   exchange_rate     -> colones por dólar usados en la conversión
-- Sin `account_amount` (abono en la misma moneda) todo sigue igual: la cuenta
-- baja `amount`.
--
-- Ejecutar ANTES de desplegar el código 2.8.0 (después de 01_). Idempotente.
-- Al final recalcula los saldos y verifica que no haya diferencias.

alter table public.transactions
  add column if not exists account_amount numeric(14, 2),
  add column if not exists exchange_rate numeric(12, 4);

alter table public.transactions drop constraint if exists transactions_exchange_check;
alter table public.transactions
  add constraint transactions_exchange_check check (
    (account_amount is null and exchange_rate is null)
    or (type = 'card_payment' and account_amount > 0 and exchange_rate > 0)
  );

comment on column public.transactions.account_amount is
  'M5 (2.8.0): abono en otra moneda: monto que sale de la cuenta, en su moneda.';
comment on column public.transactions.exchange_rate is
  'M5 (2.8.0): colones por dólar usados para convertir el abono.';

-- Trigger: el abono baja la cuenta por account_amount (si lo hay).
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
      set current_balance = current_balance - dir * coalesce(t.account_amount, t.amount)
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

-- Saldo derivado con la misma regla (la cuenta baja account_amount en un abono).
drop view if exists public.balance_drift;
drop view if exists public.balance_derived;

create view public.balance_derived
with (security_invoker = true) as
with effects as (
  select t.account_id as id, null::text as currency,
    case
      when t.type in ('income', 'opening_balance') then t.amount
      when t.type = 'card_payment' then -coalesce(t.account_amount, t.amount)
      when t.type in ('expense', 'transfer') then -t.amount
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

-- Sin abonos convertidos todavía, no cambia nada; debe devolver 0 filas.
select * from public.balance_drift;
