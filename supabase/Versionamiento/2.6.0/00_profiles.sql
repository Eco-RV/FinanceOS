-- v2.6.0 · 00 — Perfil del usuario y preferencias de la app.
--
-- Datos opcionales del usuario fuera de `auth.users`: nombre, usuario (@),
-- país, foto y preferencias de la app (jsonb, para sumar ajustes sin migrar).
-- Una fila por usuario (la llave es el propio `user_id`, por eso no lleva
-- `archived` ni índice parcial como las tablas del dominio financiero).
--
-- Al registrarse alguien, un trigger crea su perfil con el nombre que dio en
-- el formulario (`raw_user_meta_data.full_name`). Los usuarios que ya existían
-- reciben su fila vacía al correr este archivo.
--
-- Ejecutar ANTES de desplegar el código 2.6.0 (después de todo 2.5.0).
-- Idempotente.

create table if not exists public.profiles (
  user_id     uuid primary key default auth.uid()
              references auth.users (id) on delete cascade,
  full_name   text check (full_name is null or char_length(full_name) between 1 and 80),
  username    text check (username is null or username ~ '^[a-z0-9](?:[a-z0-9._]{1,28}[a-z0-9])$'),
  country     text check (country is null or country ~ '^[A-Z]{2}$'),
  avatar_url  text check (avatar_url is null or char_length(avatar_url) <= 500),
  preferences jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- U1: el usuario (@) es único sin importar mayúsculas. Choque → 23505.
create unique index if not exists profiles_username_unique
  on public.profiles (lower(username))
  where username is not null;

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (user_id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (user_id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles
  for delete using (user_id = auth.uid());

-- updated_at automático.
create or replace function public.profiles_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.profiles_touch();

-- Perfil al registrarse. `security definer` porque corre en el insert de
-- auth.users (sin sesión del usuario); solo escribe la fila de ese usuario.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(btrim(new.raw_user_meta_data ->> 'full_name'), '');
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, left(v_name, 80))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

-- Usuarios que ya existían.
insert into public.profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;
