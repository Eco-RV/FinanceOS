-- v2.0.0 · 01 — `current_balance` como proyección verificable.
--
-- G1: la verdad son los movimientos. Estas piezas permiten comprobar (y
-- reparar) que el saldo guardado coincide con lo que dicen los movimientos.
--
--   balance_derived     vista: saldo guardado vs. saldo derivado, por cuenta/tarjeta
--   balance_drift       vista: solo las filas que no coinciden
--   recompute_balances  función: reescribe current_balance desde los movimientos
--
-- Todo es `security invoker`: con la sesión del usuario solo ve/toca sus filas
-- (RLS). Ejecutado desde el SQL Editor (rol postgres) abarca a todos.
--
-- Ejecutar DESPUÉS de 00_opening_balance.sql.

create or replace view public.balance_derived
with (security_invoker = true) as
select
  'account'::text as target,
  a.id,
  a.user_id,
  a.currency,
  a.current_balance as stored,
  coalesce(sum(
    case
      when t.id is null or t.archived then 0
      when t.type = 'income' then t.amount
      when t.type = 'opening_balance' then t.amount
      when t.type in ('expense', 'card_payment') then -t.amount
      else 0
    end
  ), 0)::numeric(14, 2) as derived
from public.accounts a
left join public.transactions t on t.account_id = a.id
group by a.id

union all

select
  'card'::text as target,
  c.id,
  c.user_id,
  c.currency,
  c.current_balance as stored,
  coalesce(sum(
    case
      when t.id is null or t.archived then 0
      when t.type = 'expense' then t.amount
      when t.type = 'opening_balance' then t.amount
      when t.type = 'card_payment' then -t.amount
      else 0
    end
  ), 0)::numeric(14, 2) as derived
from public.credit_cards c
left join public.transactions t on t.card_id = c.id
group by c.id;

create or replace view public.balance_drift
with (security_invoker = true) as
select *, stored - derived as difference
from public.balance_derived
where stored <> derived;

-- Reescribe current_balance desde los movimientos. Devuelve cuántas filas cambió.
create or replace function public.recompute_balances()
returns integer
language plpgsql
security invoker
as $$
declare
  n_accounts integer;
  n_cards integer;
begin
  update public.accounts a
    set current_balance = d.derived
    from public.balance_derived d
    where d.target = 'account' and d.id = a.id and a.current_balance <> d.derived;
  get diagnostics n_accounts = row_count;

  update public.credit_cards c
    set current_balance = d.derived
    from public.balance_derived d
    where d.target = 'card' and d.id = c.id and c.current_balance <> d.derived;
  get diagnostics n_cards = row_count;

  return n_accounts + n_cards;
end;
$$;
