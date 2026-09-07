-- FinanceOS · Paso 2.1 — categorías configurables de gastos e ingresos
--
-- Cómo aplicar:
--   a) SQL Editor de Supabase: pega y ejecuta este archivo, o
--   b) CLI: `supabase db push`
--
-- Los movimientos guardan la categoría como texto libre (`transactions.category`),
-- así que renombrar o borrar una categoría no toca el historial.

create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid()
               references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('expense', 'income')),
  name       text not null check (char_length(btrim(name)) between 1 and 40),
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

drop policy if exists "categories_select_own" on public.categories;
drop policy if exists "categories_insert_own" on public.categories;
drop policy if exists "categories_update_own" on public.categories;
drop policy if exists "categories_delete_own" on public.categories;

create policy "categories_select_own" on public.categories
  for select using (auth.uid() = user_id);
create policy "categories_insert_own" on public.categories
  for insert with check (auth.uid() = user_id);
create policy "categories_update_own" on public.categories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "categories_delete_own" on public.categories
  for delete using (auth.uid() = user_id);

create index if not exists categories_user_idx
  on public.categories (user_id) where not archived;

create unique index if not exists categories_unique_name
  on public.categories (user_id, kind, lower(name)) where not archived;
