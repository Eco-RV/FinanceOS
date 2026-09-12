-- v1.2.2 — Financiamientos de tarjeta de crédito (tasa 0, sin intereses).
--
-- Un financiamiento reparte un monto total en N cuotas mensuales iguales,
-- generadas de una sola vez como movimientos `expense` normales (ver
-- 01_create_financing_function.sql). El total impacta `credit_cards.current_balance`
-- desde el día en que se crea (vía el trigger `transactions_balance_sync` ya
-- existente, que no distingue fechas futuras), igual que un banco bloquea el
-- cupo completo aunque cobre por cuotas.
--
-- Ejecutar ANTES de 01_create_financing_function.sql.

create table if not exists public.financings (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid()
                     references auth.users (id) on delete cascade,
  card_id          uuid not null references public.credit_cards (id) on delete cascade,
  description      text not null
                     check (char_length(btrim(description)) between 1 and 80),
  category         text,
  total_amount     numeric(14, 2) not null check (total_amount > 0),
  months           smallint not null check (months between 2 and 48),
  currency         text not null check (currency in ('CRC', 'USD')),
  first_charge_on  date not null,
  archived         boolean not null default false,
  created_at       timestamptz not null default now()
);

alter table public.financings enable row level security;

create policy financings_select_own on public.financings
  for select using (auth.uid() = user_id);
create policy financings_insert_own on public.financings
  for insert with check (auth.uid() = user_id);
create policy financings_update_own on public.financings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy financings_delete_own on public.financings
  for delete using (auth.uid() = user_id);

create index if not exists financings_user_idx
  on public.financings (user_id) where not archived;
create index if not exists financings_card_idx
  on public.financings (card_id) where not archived;

-- Vincula cada cuota generada con su plan de financiamiento. Nullable: los
-- movimientos normales (gastos, ingresos, pagos) no tocan estas columnas.
alter table public.transactions
  add column if not exists financing_id uuid
    references public.financings (id) on delete cascade,
  add column if not exists installment_no smallint;

create index if not exists transactions_financing_idx
  on public.transactions (financing_id) where not archived;
