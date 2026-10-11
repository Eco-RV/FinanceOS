-- v2.0.0 · 05 — Transferencias entre cuentas propias y SINPE.
--
-- Transferencia (regla M2): tipo nuevo `transfer`. Sale de `account_id` y entra
-- a `to_account_id`, ambas cuentas propias y DISTINTAS. No es gasto ni ingreso:
-- no lleva categoría obligatoria y no suma en los totales de gastos. La regla
-- "misma moneda" la valida la app (dominio), igual que en los abonos.
--   transfer -> account.current_balance    -= amount  (origen)
--               to_account.current_balance += amount  (destino)
--
-- SINPE: es un GASTO (`expense`) desde una cuenta de débito, con
-- `channel = 'sinpe'` y destinatario/teléfono opcionales. Categoría obligatoria
-- como todo gasto (la exige la app).
--
-- Ejecutar ANTES de desplegar el código que lo usa. Es idempotente.

alter table public.transactions
  add column if not exists to_account_id uuid
    references public.accounts (id) on delete cascade,
  add column if not exists channel text,
  add column if not exists counterparty_name text,
  add column if not exists counterparty_phone text;

alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions
  add constraint transactions_type_check
    check (type in ('expense', 'income', 'card_payment', 'opening_balance', 'transfer'));

alter table public.transactions drop constraint if exists transactions_fk_by_type;
alter table public.transactions
  add constraint transactions_fk_by_type check (
    (type in ('expense', 'opening_balance')
       and ((account_id is not null) <> (card_id is not null)))
    or (type = 'income'
       and account_id is not null and card_id is null)
    or (type = 'card_payment'
       and account_id is not null and card_id is not null)
    or (type = 'transfer'
       and account_id is not null and to_account_id is not null
       and card_id is null and account_id <> to_account_id)
  );

-- `to_account_id` solo en transferencias.
alter table public.transactions drop constraint if exists transactions_to_account_check;
alter table public.transactions
  add constraint transactions_to_account_check
    check (to_account_id is null or type = 'transfer');

-- SINPE: solo gastos desde una cuenta.
alter table public.transactions drop constraint if exists transactions_channel_check;
alter table public.transactions
  add constraint transactions_channel_check check (
    channel is null
    or (channel = 'sinpe' and type = 'expense' and account_id is not null)
  );

alter table public.transactions drop constraint if exists transactions_counterparty_check;
alter table public.transactions
  add constraint transactions_counterparty_check check (
    (counterparty_name is null or char_length(counterparty_name) <= 80)
    and (counterparty_phone is null or counterparty_phone ~ '^[0-9]{8}$')
  );

create index if not exists transactions_to_account_idx
  on public.transactions (to_account_id, occurred_on desc)
  where not archived and to_account_id is not null;

-- Trigger de saldos con el tipo nuevo.
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
      update public.credit_cards
        set current_balance = current_balance + dir * t.amount
        where id = t.card_id;
    end if;

  elsif t.type = 'income' then
    update public.accounts
      set current_balance = current_balance + dir * t.amount
      where id = t.account_id;

  elsif t.type = 'card_payment' then
    update public.accounts
      set current_balance = current_balance - dir * t.amount
      where id = t.account_id;
    update public.credit_cards
      set current_balance = current_balance - dir * t.amount
      where id = t.card_id;

  elsif t.type = 'opening_balance' then
    if t.account_id is not null then
      update public.accounts
        set current_balance = current_balance + dir * t.amount
        where id = t.account_id;
    else
      update public.credit_cards
        set current_balance = current_balance + dir * t.amount
        where id = t.card_id;
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

-- Saldo derivado: el destino de una transferencia también suma. Se reescribe la
-- vista sobre una lista de "efectos" por cuenta/tarjeta (misma regla que
-- `balanceEffects` en src/domain/ledger/movement.ts).
create or replace view public.balance_derived
with (security_invoker = true) as
with effects as (
  select t.account_id as id,
    case
      when t.type in ('income', 'opening_balance') then t.amount
      when t.type in ('expense', 'card_payment', 'transfer') then -t.amount
      else 0
    end as delta
  from public.transactions t
  where not t.archived and t.account_id is not null
  union all
  select t.to_account_id, t.amount
  from public.transactions t
  where not t.archived and t.type = 'transfer'
  union all
  select t.card_id,
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
  'card'::text, c.id, c.user_id, c.currency,
  c.current_balance,
  coalesce((select sum(e.delta) from effects e where e.id = c.id), 0)::numeric(14, 2)
from public.credit_cards c;
