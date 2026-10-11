-- v2.0.0 · 00 — Nuevo tipo de movimiento `opening_balance` ("Saldo inicial").
--
-- Regla C1 (docs/dominio/reglas.md): cada cuenta y tarjeta arranca con un saldo
-- inicial oficial que es un MOVIMIENTO, no un número digitado en
-- `current_balance`. Así "la verdad son los movimientos" (G1) se cumple y el
-- saldo guardado pasa a ser solo una proyección verificable.
--
-- Efecto en saldos (igual que `balanceEffects` en src/domain/ledger/movement.ts):
--   opening_balance + account -> account.current_balance += amount
--   opening_balance + card    -> card.current_balance    += amount   (deuda)
-- Es el único tipo con monto CON SIGNO (sobregiro inicial o saldo a favor).
--
-- Ejecutar ANTES de desplegar el código 2.0.0. Es idempotente.

-- 1) Quitar los checks viejos de `type` y `amount` (nombres generados por
--    Postgres al crear la tabla; se buscan por definición por si difieren).
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.transactions'::regclass
      and contype = 'c'
      and conname <> 'transactions_fk_by_type'
      and (
        pg_get_constraintdef(oid) ilike '%type%card_payment%'
        or pg_get_constraintdef(oid) ilike '%amount > %'
      )
  loop
    execute format('alter table public.transactions drop constraint %I', c.conname);
  end loop;
end;
$$;

alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions drop constraint if exists transactions_amount_check;
alter table public.transactions drop constraint if exists transactions_fk_by_type;

-- 2) Checks nuevos.
alter table public.transactions
  add constraint transactions_type_check
    check (type in ('expense', 'income', 'card_payment', 'opening_balance'));

alter table public.transactions
  add constraint transactions_amount_check
    check ((type = 'opening_balance' and amount <> 0) or amount > 0);

-- Qué FK es obligatoria según el tipo:
--   expense          -> exactamente una de (account_id, card_id)
--   income           -> solo account_id
--   card_payment     -> ambas (cuenta origen + tarjeta destino)
--   opening_balance  -> exactamente una de (account_id, card_id)
alter table public.transactions
  add constraint transactions_fk_by_type check (
    (type in ('expense', 'opening_balance')
       and ((account_id is not null) <> (card_id is not null)))
    or (type = 'income'
       and account_id is not null and card_id is null)
    or (type = 'card_payment'
       and account_id is not null and card_id is not null)
  );

-- 3) Un solo saldo inicial activo por cuenta y por tarjeta.
create unique index if not exists transactions_opening_account_uidx
  on public.transactions (account_id)
  where type = 'opening_balance' and not archived and account_id is not null;
create unique index if not exists transactions_opening_card_uidx
  on public.transactions (card_id)
  where type = 'opening_balance' and not archived and card_id is not null;

-- 4) Trigger de saldos con el tipo nuevo (misma función, se reemplaza).
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
  end if;
end;
$$;
