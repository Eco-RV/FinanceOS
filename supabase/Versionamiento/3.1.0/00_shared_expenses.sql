-- v3.1.0 · 00 — Gastos compartidos (X1–X6).
--
--   shared_expenses          un gasto (movimiento `expense`) que el usuario pagó
--                            completo y divide entre personas. Guarda el total, la
--                            moneda y la fecha límite de cobro (X3).
--   shared_expense_parts     la parte fija de cada persona (miembro). Cuando paga,
--                            guarda fecha, medio, nota y el ingreso opcional que
--                            se registró en una cuenta (X4).
--   shared_expense_notices   avisos enviados (correo o WhatsApp) por persona y
--                            tramo de quincenas (X5; 4 = más de 3 quincenas).
--
-- Compartir NO toca saldos: el gasto ya los afectó por el total (X1). Borrar el
-- movimiento borra el compartido en cascada (la app lo impide mientras esté
-- compartido, X6). Todo lleva RLS por `auth.uid()` con el patrón de 4 policies.
--
-- Ejecutar DESPUÉS de todo 3.0.0. Idempotente.

-- ─────────────────────────────  shared_expenses  ─────────────────────────────

create table if not exists public.shared_expenses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid()
                    references auth.users (id) on delete cascade,
  transaction_id  uuid not null references public.transactions (id) on delete cascade,
  description     text not null check (char_length(btrim(description)) between 1 and 80),
  currency        text not null default 'CRC' check (currency in ('CRC', 'USD')),
  total_amount    numeric(14, 2) not null check (total_amount > 0),
  due_on          date not null,
  archived        boolean not null default false,
  created_at      timestamptz not null default now()
);

alter table public.shared_expenses enable row level security;

drop policy if exists shared_expenses_select_own on public.shared_expenses;
drop policy if exists shared_expenses_insert_own on public.shared_expenses;
drop policy if exists shared_expenses_update_own on public.shared_expenses;
drop policy if exists shared_expenses_delete_own on public.shared_expenses;
create policy shared_expenses_select_own on public.shared_expenses
  for select using (auth.uid() = user_id);
create policy shared_expenses_insert_own on public.shared_expenses
  for insert with check (auth.uid() = user_id);
create policy shared_expenses_update_own on public.shared_expenses
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy shared_expenses_delete_own on public.shared_expenses
  for delete using (auth.uid() = user_id);

create index if not exists shared_expenses_user_idx
  on public.shared_expenses (user_id) where not archived;
-- X1: un movimiento se comparte una sola vez. Un choque da el error 23505.
create unique index if not exists shared_expenses_transaction_uidx
  on public.shared_expenses (transaction_id) where not archived;

-- ─────────────────────────────  shared_expense_parts  ─────────────────────────────

create table if not exists public.shared_expense_parts (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null default auth.uid()
                           references auth.users (id) on delete cascade,
  shared_expense_id      uuid not null references public.shared_expenses (id) on delete cascade,
  member_id              uuid not null references public.members (id) on delete cascade,
  -- En la moneda del gasto. La parte del usuario es el resto (X2).
  amount                 numeric(14, 2) not null check (amount > 0),
  paid_on                date,
  channel                text check (channel is null or channel in ('sinpe', 'efectivo', 'transferencia', 'otro')),
  note                   text check (note is null or char_length(note) <= 120),
  -- X4: el ingreso registrado al cobrar (opcional).
  income_transaction_id  uuid references public.transactions (id) on delete set null,
  archived               boolean not null default false,
  created_at             timestamptz not null default now(),
  unique (shared_expense_id, member_id),
  -- Pagada = tiene fecha y medio. Sin pagar = no tiene nada de eso.
  constraint shared_expense_parts_payment check (
    (paid_on is null and channel is null and income_transaction_id is null)
    or (paid_on is not null and channel is not null)
  )
);

alter table public.shared_expense_parts enable row level security;

drop policy if exists shared_expense_parts_select_own on public.shared_expense_parts;
drop policy if exists shared_expense_parts_insert_own on public.shared_expense_parts;
drop policy if exists shared_expense_parts_update_own on public.shared_expense_parts;
drop policy if exists shared_expense_parts_delete_own on public.shared_expense_parts;
create policy shared_expense_parts_select_own on public.shared_expense_parts
  for select using (auth.uid() = user_id);
create policy shared_expense_parts_insert_own on public.shared_expense_parts
  for insert with check (auth.uid() = user_id);
create policy shared_expense_parts_update_own on public.shared_expense_parts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy shared_expense_parts_delete_own on public.shared_expense_parts
  for delete using (auth.uid() = user_id);

create index if not exists shared_expense_parts_user_idx
  on public.shared_expense_parts (user_id) where not archived;
create index if not exists shared_expense_parts_member_idx
  on public.shared_expense_parts (member_id) where not archived;
create index if not exists shared_expense_parts_income_idx
  on public.shared_expense_parts (income_transaction_id) where income_transaction_id is not null;

-- ─────────────────────────────  shared_expense_notices  ─────────────────────────────

create table if not exists public.shared_expense_notices (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid()
                       references auth.users (id) on delete cascade,
  shared_expense_id  uuid not null references public.shared_expenses (id) on delete cascade,
  member_id          uuid not null references public.members (id) on delete cascade,
  -- 0 = venció, 1 a 3 = quincenas, 4 = más de 3 (X5).
  quincenas          smallint not null check (quincenas between 0 and 4),
  channel            text not null check (channel in ('email', 'whatsapp')),
  sent_at            timestamptz not null default now(),
  archived           boolean not null default false
);

alter table public.shared_expense_notices enable row level security;

drop policy if exists shared_expense_notices_select_own on public.shared_expense_notices;
drop policy if exists shared_expense_notices_insert_own on public.shared_expense_notices;
drop policy if exists shared_expense_notices_update_own on public.shared_expense_notices;
drop policy if exists shared_expense_notices_delete_own on public.shared_expense_notices;
create policy shared_expense_notices_select_own on public.shared_expense_notices
  for select using (auth.uid() = user_id);
create policy shared_expense_notices_insert_own on public.shared_expense_notices
  for insert with check (auth.uid() = user_id);
create policy shared_expense_notices_update_own on public.shared_expense_notices
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy shared_expense_notices_delete_own on public.shared_expense_notices
  for delete using (auth.uid() = user_id);

create index if not exists shared_expense_notices_user_idx
  on public.shared_expense_notices (user_id) where not archived;
create index if not exists shared_expense_notices_part_idx
  on public.shared_expense_notices (shared_expense_id, member_id);
