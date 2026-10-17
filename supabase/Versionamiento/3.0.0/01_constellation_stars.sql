-- v3.0.0 · 01 — Agenda de la Constelación: apodo, emoji y parentesco por dirección.
--
-- Lo personal NUNCA va a la cadena (K2): en el contrato `family` solo hay
-- direcciones y roles. Cada usuario guarda SUS apodos (D3): nadie ve cómo lo
-- nombra otro. Una estrella se puede ligar a un Miembro de cobros (D13).
--
-- Ejecutar ANTES de desplegar el código 3.0.0 (después de 00_). Idempotente.

create table if not exists public.constellation_stars (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid()
                  references auth.users (id) on delete cascade,
  address       text not null check (address ~ '^G[A-Z2-7]{55}$'),
  nickname      text not null check (char_length(nickname) between 1 and 40),
  emoji         text check (emoji is null or char_length(emoji) <= 8),
  relationship  text check (relationship is null or char_length(relationship) <= 30),
  member_id     uuid references public.members (id) on delete set null,
  archived      boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table public.constellation_stars enable row level security;

drop policy if exists constellation_stars_select_own on public.constellation_stars;
drop policy if exists constellation_stars_insert_own on public.constellation_stars;
drop policy if exists constellation_stars_update_own on public.constellation_stars;
drop policy if exists constellation_stars_delete_own on public.constellation_stars;

create policy constellation_stars_select_own on public.constellation_stars
  for select using (auth.uid() = user_id);
create policy constellation_stars_insert_own on public.constellation_stars
  for insert with check (auth.uid() = user_id);
create policy constellation_stars_update_own on public.constellation_stars
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy constellation_stars_delete_own on public.constellation_stars
  for delete using (auth.uid() = user_id);

create index if not exists constellation_stars_user_idx
  on public.constellation_stars (user_id) where not archived;

-- Una dirección aparece una vez en la agenda de cada usuario (choque → 23505).
create unique index if not exists constellation_stars_address_uidx
  on public.constellation_stars (user_id, address) where not archived;
