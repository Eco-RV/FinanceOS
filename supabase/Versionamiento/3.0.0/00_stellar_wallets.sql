-- v3.0.0 · 00 — Wallet de Stellar ligada al usuario (Constelación familiar).
--
-- Guarda SOLO la dirección pública `G…` de la wallet de cada usuario (nunca
-- llaves: K2 y regla de oro). Sirve para que la familia encuentre a cada
-- estrella y para canjear invitaciones. Una activa por usuario y una dirección
-- no se liga a dos usuarios.
--
-- Ejecutar ANTES de desplegar el código 3.0.0 (después de todo 2.9.0).
-- Idempotente.

create table if not exists public.stellar_wallets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
  address     text not null check (address ~ '^G[A-Z2-7]{55}$'),
  connector   text not null default 'cavos' check (connector in ('cavos', 'extension')),
  network     text not null default 'testnet' check (network = 'testnet'),
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.stellar_wallets enable row level security;

drop policy if exists stellar_wallets_select_own on public.stellar_wallets;
drop policy if exists stellar_wallets_insert_own on public.stellar_wallets;
drop policy if exists stellar_wallets_update_own on public.stellar_wallets;
drop policy if exists stellar_wallets_delete_own on public.stellar_wallets;

create policy stellar_wallets_select_own on public.stellar_wallets
  for select using (auth.uid() = user_id);
create policy stellar_wallets_insert_own on public.stellar_wallets
  for insert with check (auth.uid() = user_id);
create policy stellar_wallets_update_own on public.stellar_wallets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy stellar_wallets_delete_own on public.stellar_wallets
  for delete using (auth.uid() = user_id);

create index if not exists stellar_wallets_user_idx
  on public.stellar_wallets (user_id) where not archived;

-- Una wallet activa por usuario.
create unique index if not exists stellar_wallets_user_active_uidx
  on public.stellar_wallets (user_id) where not archived;

-- Una dirección activa pertenece a un solo usuario (choque → 23505).
create unique index if not exists stellar_wallets_address_active_uidx
  on public.stellar_wallets (address) where not archived;
