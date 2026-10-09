-- v1.3.0 — Importación de gastos desde correos bancarios.
--
-- Cuatro tablas nuevas + un vínculo opcional tarjeta → banco:
--   banks                  bancos que el usuario quiere monitorear (remitentes + parser)
--   mail_connections       conexión OAuth con el correo (refresh token CIFRADO desde la app)
--   pending_transactions   bandeja: lo que se leyó del correo, antes de confirmar
--   merchant_rules         comercio → categoría (se aprende al aprobar un pendiente)
--
-- Misma convención que el resto: RLS por auth.uid(), 4 policies, índice parcial
-- `where not archived`. La ruta /api/sync-mail corre con service role (sin
-- auth.uid()), por eso inserta `user_id` de forma explícita.
--
-- Ejecutar a mano en el SQL Editor de Supabase, en orden de numeración.

-- ─────────────────────────────  banks  ─────────────────────────────

create table if not exists public.banks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid()
                  references auth.users (id) on delete cascade,
  name          text not null
                  check (char_length(btrim(name)) between 1 and 60),
  -- Remitentes de las notificaciones, en minúsculas (p. ej. notificacionbac@baccredomatic.cr).
  sender_emails text[] not null
                  check (cardinality(sender_emails) between 1 and 10),
  -- Clave del parser registrado en src/lib/mail/parsers (p. ej. 'bac').
  parser_key    text not null check (char_length(btrim(parser_key)) between 1 and 40),
  enabled       boolean not null default true,
  archived      boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table public.banks enable row level security;

create policy banks_select_own on public.banks
  for select using (auth.uid() = user_id);
create policy banks_insert_own on public.banks
  for insert with check (auth.uid() = user_id);
create policy banks_update_own on public.banks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy banks_delete_own on public.banks
  for delete using (auth.uid() = user_id);

create index if not exists banks_user_idx
  on public.banks (user_id) where not archived;

-- Una tarjeta puede apuntar a su banco para desambiguar si dos bancos
-- comparten los mismos últimos 4 dígitos. `institution` (texto libre) se mantiene.
alter table public.credit_cards
  add column if not exists bank_id uuid
    references public.banks (id) on delete set null;

-- ─────────────────────────────  mail_connections  ─────────────────────────────

create table if not exists public.mail_connections (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid()
                       references auth.users (id) on delete cascade,
  provider           text not null default 'gmail' check (provider in ('gmail')),
  email              text not null,
  -- AES-256-GCM (clave MAIL_TOKEN_KEY en el servidor): nunca texto plano.
  refresh_token_enc  text not null,
  last_synced_at     timestamptz,
  created_at         timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.mail_connections enable row level security;

create policy mail_connections_select_own on public.mail_connections
  for select using (auth.uid() = user_id);
create policy mail_connections_insert_own on public.mail_connections
  for insert with check (auth.uid() = user_id);
create policy mail_connections_update_own on public.mail_connections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy mail_connections_delete_own on public.mail_connections
  for delete using (auth.uid() = user_id);

-- ─────────────────────────────  pending_transactions  ─────────────────────────────

create table if not exists public.pending_transactions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid()
                      references auth.users (id) on delete cascade,
  bank_id           uuid references public.banks (id) on delete set null,
  -- Id del mensaje en el proveedor: garantiza que releer el correo no duplica.
  source_message_id text not null,
  merchant          text not null,
  amount            numeric(14, 2) not null check (amount > 0),
  currency          text not null check (currency in ('CRC', 'USD')),
  occurred_on       date not null,
  last_four         text check (last_four is null or last_four ~ '^\d{4}$'),
  auth_code         text,
  reference         text,
  -- Tarjeta casada por last_four (null si no hubo coincidencia única).
  card_id           uuid references public.credit_cards (id) on delete set null,
  suggested_category text,
  status            text not null default 'pending'
                      check (status in ('pending', 'approved', 'rejected')),
  transaction_id    uuid references public.transactions (id) on delete set null,
  archived          boolean not null default false,
  created_at        timestamptz not null default now(),
  unique (user_id, source_message_id)
);

alter table public.pending_transactions enable row level security;

create policy pending_transactions_select_own on public.pending_transactions
  for select using (auth.uid() = user_id);
create policy pending_transactions_insert_own on public.pending_transactions
  for insert with check (auth.uid() = user_id);
create policy pending_transactions_update_own on public.pending_transactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy pending_transactions_delete_own on public.pending_transactions
  for delete using (auth.uid() = user_id);

create index if not exists pending_transactions_user_status_idx
  on public.pending_transactions (user_id, status) where not archived;

-- ─────────────────────────────  merchant_rules  ─────────────────────────────

create table if not exists public.merchant_rules (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid()
               references auth.users (id) on delete cascade,
  -- Comercio normalizado (minúsculas, sin sufijos de sucursal): clave de búsqueda.
  merchant_key text not null check (char_length(btrim(merchant_key)) between 1 and 80),
  category     text not null check (char_length(btrim(category)) between 1 and 40),
  archived     boolean not null default false,
  created_at   timestamptz not null default now()
);

alter table public.merchant_rules enable row level security;

create policy merchant_rules_select_own on public.merchant_rules
  for select using (auth.uid() = user_id);
create policy merchant_rules_insert_own on public.merchant_rules
  for insert with check (auth.uid() = user_id);
create policy merchant_rules_update_own on public.merchant_rules
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy merchant_rules_delete_own on public.merchant_rules
  for delete using (auth.uid() = user_id);

create unique index if not exists merchant_rules_user_key_uidx
  on public.merchant_rules (user_id, merchant_key) where not archived;
