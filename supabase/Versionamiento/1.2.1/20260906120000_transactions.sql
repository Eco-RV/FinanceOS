-- FinanceOS · Paso 2 — movimientos (gastos, ingresos, pagos de tarjeta)
--
-- Cómo aplicar:
--   a) SQL Editor de Supabase: pega y ejecuta este archivo, o
--   b) CLI: `supabase db push`
--
-- Cada movimiento ajusta el saldo de la cuenta y/o tarjeta involucrada
-- mediante el trigger `transactions_balance_sync`.

-- ─────────────────────────────  transactions  ────────────────────────────
create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
  type        text not null
                check (type in ('expense', 'income', 'card_payment')),
  amount      numeric(14, 2) not null check (amount > 0),
  currency    text not null default 'CRC'
                check (currency in ('CRC', 'USD')),
  occurred_on date not null
                default (now() at time zone 'America/Costa_Rica')::date,
  category    text,
  note        text,
  account_id  uuid references public.accounts (id) on delete cascade,
  card_id     uuid references public.credit_cards (id) on delete cascade,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),

  -- Qué FK es obligatoria según el tipo:
  --   expense       -> exactamente una de (account_id, card_id)
  --   income        -> solo account_id
  --   card_payment  -> ambas (cuenta origen + tarjeta destino)
  constraint transactions_fk_by_type check (
    (type = 'expense'
       and ((account_id is not null) <> (card_id is not null)))
    or (type = 'income'
       and account_id is not null and card_id is null)
    or (type = 'card_payment'
       and account_id is not null and card_id is not null)
  )
);

alter table public.transactions enable row level security;

drop policy if exists "transactions_select_own" on public.transactions;
drop policy if exists "transactions_insert_own" on public.transactions;
drop policy if exists "transactions_update_own" on public.transactions;
drop policy if exists "transactions_delete_own" on public.transactions;

create policy "transactions_select_own" on public.transactions
  for select using (auth.uid() = user_id);
create policy "transactions_insert_own" on public.transactions
  for insert with check (auth.uid() = user_id);
create policy "transactions_update_own" on public.transactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "transactions_delete_own" on public.transactions
  for delete using (auth.uid() = user_id);

create index if not exists transactions_user_idx
  on public.transactions (user_id) where not archived;
create index if not exists transactions_account_idx
  on public.transactions (account_id, occurred_on desc) where not archived;
create index if not exists transactions_card_idx
  on public.transactions (card_id, occurred_on desc) where not archived;

-- ───────────────  sincronización de saldos (trigger)  ────────────────
-- Convención de signo (dir = +1 al aplicar, -1 al revertir):
--   expense  + account  -> account.current_balance -= amount
--   expense  + card     -> card.current_balance    += amount   (más deuda)
--   income   + account  -> account.current_balance += amount
--   card_payment        -> account.current_balance -= amount
--                          card.current_balance    -= amount
-- Filas archived no afectan ningún saldo (archivar revierte, desarchivar reaplica).
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
  end if;
end;
$$;

create or replace function public.apply_transaction_balance()
returns trigger
language plpgsql
security invoker
as $$
begin
  if tg_op = 'INSERT' then
    perform public._tx_apply(new, 1);
    return new;
  elsif tg_op = 'DELETE' then
    perform public._tx_apply(old, -1);
    return old;
  else -- UPDATE: revierte el estado anterior y aplica el nuevo
    perform public._tx_apply(old, -1);
    perform public._tx_apply(new, 1);
    return new;
  end if;
end;
$$;

drop trigger if exists transactions_balance_sync on public.transactions;
create trigger transactions_balance_sync
  after insert or update or delete on public.transactions
  for each row execute function public.apply_transaction_balance();
