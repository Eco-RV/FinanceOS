-- v2.1.0 · 01 — Préstamos bancarios con interés (F5, L1–L5).
--
-- Un préstamo es deuda con un banco: capital, tasa anual fija, N meses y fecha
-- de la primera cuota. El calendario de cuotas (sistema francés, cuota fija)
-- NO se guarda: lo calcula el dominio (`loanSchedule`,
-- src/domain/loans/loan.ts) a partir de estos datos, así que nunca puede
-- quedar desfasado.
--
-- Pagar una cuota crea un GASTO normal (`expense`) desde una cuenta de débito,
-- con `loan_id` + `installment_no`: el trigger de saldos lo trata como
-- cualquier gasto. El desembolso (opcional) es un INGRESO con `loan_id` y sin
-- `installment_no`. Así el préstamo no toca `current_balance` por sí solo:
-- la verdad siguen siendo los movimientos (G1).
--
-- Ejecutar DESPUÉS de todo 2.0.0. Idempotente.

create table if not exists public.loans (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid()
                      references auth.users (id) on delete cascade,
  name              text not null check (char_length(btrim(name)) between 1 and 60),
  lender            text check (lender is null or char_length(btrim(lender)) between 1 and 60),
  principal         numeric(14, 2) not null check (principal > 0),
  -- Tasa anual nominal en porcentaje (24 = 24 %); la mensual es anual / 12.
  annual_rate       numeric(7, 4) not null check (annual_rate >= 0 and annual_rate <= 100),
  months            smallint not null check (months between 1 and 480),
  currency          text not null default 'CRC' check (currency in ('CRC', 'USD')),
  first_payment_on  date not null,
  -- Cuenta desde la que se suele pagar (sugerencia del formulario de pago).
  account_id        uuid references public.accounts (id) on delete set null,
  archived          boolean not null default false,
  created_at        timestamptz not null default now()
);

alter table public.loans enable row level security;

drop policy if exists loans_select_own on public.loans;
drop policy if exists loans_insert_own on public.loans;
drop policy if exists loans_update_own on public.loans;
drop policy if exists loans_delete_own on public.loans;
create policy loans_select_own on public.loans
  for select using (auth.uid() = user_id);
create policy loans_insert_own on public.loans
  for insert with check (auth.uid() = user_id);
create policy loans_update_own on public.loans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy loans_delete_own on public.loans
  for delete using (auth.uid() = user_id);

create index if not exists loans_user_idx
  on public.loans (user_id) where not archived;

-- Pagos (installment_no = número de cuota) y desembolso (installment_no null).
-- `on delete cascade`: solo se elimina un préstamo sin cuotas pagadas (G5), así
-- que el cascade arrastra como mucho su desembolso.
alter table public.transactions
  add column if not exists loan_id uuid
    references public.loans (id) on delete cascade;

create index if not exists transactions_loan_idx
  on public.transactions (loan_id) where loan_id is not null and not archived;

-- L3: una cuota se paga una sola vez (protege contra doble clic o dos pestañas).
create unique index if not exists transactions_loan_installment_uidx
  on public.transactions (loan_id, installment_no)
  where loan_id is not null and installment_no is not null and not archived;

-- Un pago de cuota es un gasto; un desembolso, un ingreso. Ambos desde/hacia
-- una cuenta (no tarjeta).
alter table public.transactions
  drop constraint if exists transactions_loan_by_type;
alter table public.transactions
  add constraint transactions_loan_by_type check (
    loan_id is null
    or (
      account_id is not null and card_id is null
      and (
        (type = 'expense' and installment_no is not null)
        or (type = 'income' and installment_no is null)
      )
    )
  );
