-- v2.0.0 · 02 — Convierte el saldo de apertura digitado a mano en movimientos.
--
-- Hasta 1.3.0, `current_balance` = saldo de apertura (digitado en el
-- formulario) + deltas de los movimientos. Este script crea, por cada cuenta y
-- tarjeta cuya diferencia `guardado − derivado` no sea 0, UN movimiento
-- `opening_balance` por esa diferencia, fechado el día anterior a su primer
-- movimiento (o el día en que se creó, si no tiene movimientos), con la nota
-- "Saldo inicial (migrado 2.0.0)". Al final recalcula los saldos: quedan
-- IGUALES que antes, pero ahora explicados por movimientos.
--
-- Ejecutar DESPUÉS de 01_balance_projection.sql. Es idempotente: si se corre
-- otra vez, no hay diferencias y no inserta nada.
--
-- Revisión sugerida al terminar: en cada tarjeta, la línea "Saldo inicial"
-- cuenta como cargo en su fecha. Si su fecha cae antes del último corte, entra
-- en el pago de contado; ajustá fecha o monto desde "Editar tarjeta" si no
-- corresponde.

with diffs as (
  select d.id, a.user_id, a.currency, a.created_at, d.stored - d.derived as diff
  from public.balance_derived d
  join public.accounts a on a.id = d.id
  where d.target = 'account' and d.stored <> d.derived
)
insert into public.transactions
  (user_id, type, amount, currency, occurred_on, note, account_id)
select
  x.user_id,
  'opening_balance',
  x.diff,
  x.currency,
  coalesce(
    (select min(t.occurred_on) - 1 from public.transactions t where t.account_id = x.id),
    (x.created_at at time zone 'America/Costa_Rica')::date
  ),
  'Saldo inicial (migrado 2.0.0)',
  x.id
from diffs x
where not exists (
  select 1 from public.transactions o
  where o.account_id = x.id and o.type = 'opening_balance' and not o.archived
);

with diffs as (
  select d.id, c.user_id, c.currency, c.created_at, d.stored - d.derived as diff
  from public.balance_derived d
  join public.credit_cards c on c.id = d.id
  where d.target = 'card' and d.stored <> d.derived
)
insert into public.transactions
  (user_id, type, amount, currency, occurred_on, note, card_id)
select
  x.user_id,
  'opening_balance',
  x.diff,
  x.currency,
  coalesce(
    (select min(t.occurred_on) - 1 from public.transactions t where t.card_id = x.id),
    (x.created_at at time zone 'America/Costa_Rica')::date
  ),
  'Saldo inicial (migrado 2.0.0)',
  x.id
from diffs x
where not exists (
  select 1 from public.transactions o
  where o.card_id = x.id and o.type = 'opening_balance' and not o.archived
);

-- El trigger sumó el saldo inicial otra vez al guardado; se recalcula todo
-- desde los movimientos para dejarlo exacto.
select public.recompute_balances() as filas_recalculadas;

-- Debe devolver 0 filas.
select * from public.balance_drift;
