-- v3.0.1 · 05 — Abonos extraordinarios (L7) y tasa variable (L8) de préstamos.
--
-- El calendario sigue sin guardarse: se deriva de los términos + estos
-- ajustes, en orden (tabla francesa por tramos).
--   prepayment  después de la cuota `after_installment`, `amount` al capital,
--               `mode` = 'term' (misma cuota, menos cuotas) o 'payment' (mismo
--               plazo, cuota menor). Su dinero sale de una cuenta como un gasto
--               con `loan_id` y SIN número de cuota (`transaction_id`).
--   rate        desde la cuota `from_installment`, nueva `annual_rate`.
-- Borrar el gasto del abono borra el ajuste (cascade). RLS + 4 policies.
--
-- Ejecutar DESPUÉS de 04_financing_currency.sql. Idempotente.

create table if not exists public.loan_adjustments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid()
                       references auth.users (id) on delete cascade,
  loan_id            uuid not null references public.loans (id) on delete cascade,
  kind               text not null check (kind in ('prepayment', 'rate')),
  after_installment  integer check (after_installment is null or after_installment >= 0),
  from_installment   integer check (from_installment is null or from_installment >= 1),
  amount             numeric(14, 2) check (amount is null or amount > 0),
  mode               text check (mode is null or mode in ('term', 'payment')),
  annual_rate        numeric(6, 3) check (annual_rate is null or (annual_rate >= 0 and annual_rate <= 100)),
  occurred_on        date not null,
  transaction_id     uuid references public.transactions (id) on delete cascade,
  archived           boolean not null default false,
  created_at         timestamptz not null default now(),
  constraint loan_adjustments_shape check (
    (kind = 'prepayment' and after_installment is not null and amount is not null and mode is not null)
    or (kind = 'rate' and from_installment is not null and annual_rate is not null)
  )
);

alter table public.loan_adjustments enable row level security;

drop policy if exists loan_adjustments_select_own on public.loan_adjustments;
drop policy if exists loan_adjustments_insert_own on public.loan_adjustments;
drop policy if exists loan_adjustments_update_own on public.loan_adjustments;
drop policy if exists loan_adjustments_delete_own on public.loan_adjustments;
create policy loan_adjustments_select_own on public.loan_adjustments
  for select using (auth.uid() = user_id);
create policy loan_adjustments_insert_own on public.loan_adjustments
  for insert with check (auth.uid() = user_id);
create policy loan_adjustments_update_own on public.loan_adjustments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy loan_adjustments_delete_own on public.loan_adjustments
  for delete using (auth.uid() = user_id);

create index if not exists loan_adjustments_user_idx
  on public.loan_adjustments (user_id) where not archived;
create index if not exists loan_adjustments_loan_idx
  on public.loan_adjustments (loan_id, created_at) where not archived;

-- L7: el gasto de un abono extraordinario lleva loan_id sin número de cuota.
alter table public.transactions
  drop constraint if exists transactions_loan_by_type;
alter table public.transactions
  add constraint transactions_loan_by_type check (
    loan_id is null
    or (
      account_id is not null and card_id is null
      and (
        type = 'expense'
        or (type = 'income' and installment_no is null)
      )
    )
  );
