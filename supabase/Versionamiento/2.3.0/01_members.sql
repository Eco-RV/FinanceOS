-- v2.3.0 · 01 — Miembros de la familia en financiamientos (F6–F8).
--
--   members                 catálogo: nombre, correo y teléfono (WhatsApp).
--   financing_shares        parte fija por cuota de cada miembro en un plan (F6).
--                           La parte del usuario es el resto de la cuota.
--   member_reimbursements   un miembro pagó su parte de una cuota (F7). Control
--                           interno: NO toca tarjetas ni cuentas.
--   member_notices          avisos enviados (correo o WhatsApp), uno por parte
--                           y quincena, para saber qué falta avisar (F8).
--
-- Todo con RLS por `auth.uid()` y el mismo patrón de 4 policies. Borrar un
-- financiamiento (o el Arranque de 0) arrastra en cascada sus partes,
-- reembolsos y avisos; un miembro con historia no se borra, se desactiva (G5).
--
-- Ejecutar DESPUÉS de 00_financing_interest.sql. Idempotente.

-- ─────────────────────────────  members  ─────────────────────────────

create table if not exists public.members (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  email       text check (email is null or char_length(email) between 3 and 120),
  -- Con código de país, solo dígitos (p. ej. 50688887777).
  phone       text check (phone is null or phone ~ '^[0-9]{8,15}$'),
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.members enable row level security;

drop policy if exists members_select_own on public.members;
drop policy if exists members_insert_own on public.members;
drop policy if exists members_update_own on public.members;
drop policy if exists members_delete_own on public.members;
create policy members_select_own on public.members
  for select using (auth.uid() = user_id);
create policy members_insert_own on public.members
  for insert with check (auth.uid() = user_id);
create policy members_update_own on public.members
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy members_delete_own on public.members
  for delete using (auth.uid() = user_id);

create index if not exists members_user_idx
  on public.members (user_id) where not archived;
create unique index if not exists members_user_name_uidx
  on public.members (user_id, lower(btrim(name))) where not archived;

-- ─────────────────────────────  financing_shares  ─────────────────────────────

create table if not exists public.financing_shares (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid()
                  references auth.users (id) on delete cascade,
  financing_id  uuid not null references public.financings (id) on delete cascade,
  member_id     uuid not null references public.members (id) on delete cascade,
  -- Monto fijo por cuota, en la moneda del financiamiento.
  amount        numeric(14, 2) not null check (amount > 0),
  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (financing_id, member_id)
);

alter table public.financing_shares enable row level security;

drop policy if exists financing_shares_select_own on public.financing_shares;
drop policy if exists financing_shares_insert_own on public.financing_shares;
drop policy if exists financing_shares_update_own on public.financing_shares;
drop policy if exists financing_shares_delete_own on public.financing_shares;
create policy financing_shares_select_own on public.financing_shares
  for select using (auth.uid() = user_id);
create policy financing_shares_insert_own on public.financing_shares
  for insert with check (auth.uid() = user_id);
create policy financing_shares_update_own on public.financing_shares
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy financing_shares_delete_own on public.financing_shares
  for delete using (auth.uid() = user_id);

create index if not exists financing_shares_user_idx
  on public.financing_shares (user_id) where not archived;
create index if not exists financing_shares_member_idx
  on public.financing_shares (member_id) where not archived;

-- ─────────────────────────────  member_reimbursements  ─────────────────────────────

create table if not exists public.member_reimbursements (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid()
                    references auth.users (id) on delete cascade,
  financing_id    uuid not null references public.financings (id) on delete cascade,
  member_id       uuid not null references public.members (id) on delete cascade,
  installment_no  smallint not null check (installment_no >= 1),
  amount          numeric(14, 2) not null check (amount > 0),
  paid_on         date not null,
  channel         text not null default 'sinpe'
                    check (channel in ('sinpe', 'efectivo', 'transferencia', 'otro')),
  note            text check (note is null or char_length(note) <= 120),
  archived        boolean not null default false,
  created_at      timestamptz not null default now(),
  -- F7: una parte se reembolsa una sola vez (choque → 23505).
  unique (financing_id, member_id, installment_no)
);

alter table public.member_reimbursements enable row level security;

drop policy if exists member_reimbursements_select_own on public.member_reimbursements;
drop policy if exists member_reimbursements_insert_own on public.member_reimbursements;
drop policy if exists member_reimbursements_update_own on public.member_reimbursements;
drop policy if exists member_reimbursements_delete_own on public.member_reimbursements;
create policy member_reimbursements_select_own on public.member_reimbursements
  for select using (auth.uid() = user_id);
create policy member_reimbursements_insert_own on public.member_reimbursements
  for insert with check (auth.uid() = user_id);
create policy member_reimbursements_update_own on public.member_reimbursements
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy member_reimbursements_delete_own on public.member_reimbursements
  for delete using (auth.uid() = user_id);

create index if not exists member_reimbursements_user_idx
  on public.member_reimbursements (user_id) where not archived;
create index if not exists member_reimbursements_member_idx
  on public.member_reimbursements (member_id) where not archived;

-- ─────────────────────────────  member_notices  ─────────────────────────────

create table if not exists public.member_notices (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid()
                    references auth.users (id) on delete cascade,
  financing_id    uuid not null references public.financings (id) on delete cascade,
  member_id       uuid not null references public.members (id) on delete cascade,
  installment_no  smallint not null check (installment_no >= 1),
  -- Quincenas que faltaban al avisar (1, 2, 3; 0 = ya había vencido).
  quincenas       smallint not null check (quincenas between 0 and 3),
  channel         text not null check (channel in ('email', 'whatsapp')),
  sent_at         timestamptz not null default now(),
  archived        boolean not null default false
);

alter table public.member_notices enable row level security;

drop policy if exists member_notices_select_own on public.member_notices;
drop policy if exists member_notices_insert_own on public.member_notices;
drop policy if exists member_notices_update_own on public.member_notices;
drop policy if exists member_notices_delete_own on public.member_notices;
create policy member_notices_select_own on public.member_notices
  for select using (auth.uid() = user_id);
create policy member_notices_insert_own on public.member_notices
  for insert with check (auth.uid() = user_id);
create policy member_notices_update_own on public.member_notices
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy member_notices_delete_own on public.member_notices
  for delete using (auth.uid() = user_id);

create index if not exists member_notices_user_idx
  on public.member_notices (user_id) where not archived;
create index if not exists member_notices_financing_idx
  on public.member_notices (financing_id, member_id, installment_no) where not archived;
