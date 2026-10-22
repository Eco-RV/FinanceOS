-- v3.2.0 · 01 — Buzón de comentarios (B1–B6).
--
--   feedback_posts     una publicación del usuario: tipo (experiencia, duda,
--                      mejora, deseo), título, estado (B3), captura opcional y
--                      marcas de actividad y lectura de cada lado (B5).
--   feedback_messages  la conversación: el primer mensaje es el texto de la
--                      publicación; después responden el usuario o el admin.
--
-- Es PRIVADO (B2): cada usuario ve solo lo suyo; el admin (app_metadata.role =
-- 'admin', ver 02_feedback_admin.sql) ve todo y responde. Es la única parte de
-- la app que un usuario distinto del dueño puede leer, por eso las policies
-- llevan `public.is_app_admin()` además de `auth.uid() = user_id`.
-- `feedback_messages` no se edita ni se borra (solo select e insert); cae en
-- cascada con su publicación.
--
-- Bucket PRIVADO `feedback` para las capturas (B4): carpeta por usuario,
-- JPG/PNG/WebP de hasta 5 MB; el admin también las puede ver.
--
-- Ejecutar DESPUÉS de todo 3.1.0. Idempotente.

-- ─────────────────────────────  admin  ─────────────────────────────

-- El rol viene en el JWT (app_metadata no la puede cambiar el usuario).
create or replace function public.is_app_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

-- ─────────────────────────────  feedback_posts  ─────────────────────────────

create table if not exists public.feedback_posts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid()
                       references auth.users (id) on delete cascade,
  -- B2: siempre con nombre (el del perfil o, si no hay, el correo).
  author_name        text not null check (char_length(btrim(author_name)) between 1 and 80),
  kind               text not null check (kind in ('experiencia', 'duda', 'mejora', 'deseo')),
  title              text not null check (char_length(btrim(title)) between 3 and 120),
  status             text not null default 'recibido'
                       check (status in ('recibido', 'en_revision', 'en_planes', 'hecho', 'no_por_ahora')),
  attachment_path    text,
  -- B5: última actividad y última lectura de cada lado.
  user_activity_at   timestamptz not null default now(),
  admin_activity_at  timestamptz,
  user_read_at       timestamptz not null default now(),
  admin_read_at      timestamptz,
  created_at         timestamptz not null default now()
);

alter table public.feedback_posts enable row level security;

drop policy if exists feedback_posts_select on public.feedback_posts;
drop policy if exists feedback_posts_insert on public.feedback_posts;
drop policy if exists feedback_posts_update on public.feedback_posts;
drop policy if exists feedback_posts_delete on public.feedback_posts;
create policy feedback_posts_select on public.feedback_posts
  for select using (auth.uid() = user_id or public.is_app_admin());
-- Una publicación nueva siempre entra como "recibido".
create policy feedback_posts_insert on public.feedback_posts
  for insert with check (auth.uid() = user_id and status = 'recibido');
create policy feedback_posts_update on public.feedback_posts
  for update using (auth.uid() = user_id or public.is_app_admin())
  with check (auth.uid() = user_id or public.is_app_admin());
create policy feedback_posts_delete on public.feedback_posts
  for delete using (auth.uid() = user_id);

create index if not exists feedback_posts_user_idx
  on public.feedback_posts (user_id, user_activity_at desc);
create index if not exists feedback_posts_status_idx
  on public.feedback_posts (status, user_activity_at desc);

-- B3/B2: el usuario no cambia el estado ni las marcas del admin; el admin no
-- cambia el contenido ni las marcas del usuario. Un cambio de estado cuenta
-- como actividad del admin (el usuario lo ve como no leído).
create or replace function public.feedback_posts_guard()
returns trigger
language plpgsql
as $$
begin
  new.id := old.id;
  new.user_id := old.user_id;
  new.created_at := old.created_at;
  if public.is_app_admin() and old.user_id <> auth.uid() then
    new.author_name := old.author_name;
    new.kind := old.kind;
    new.title := old.title;
    new.attachment_path := old.attachment_path;
    new.user_activity_at := old.user_activity_at;
    new.user_read_at := old.user_read_at;
    if new.status is distinct from old.status then
      new.admin_activity_at := now();
    end if;
  elsif not public.is_app_admin() then
    new.status := old.status;
    new.admin_activity_at := old.admin_activity_at;
    new.admin_read_at := old.admin_read_at;
  end if;
  return new;
end;
$$;

drop trigger if exists feedback_posts_guard on public.feedback_posts;
create trigger feedback_posts_guard
  before update on public.feedback_posts
  for each row execute function public.feedback_posts_guard();

-- ─────────────────────────────  feedback_messages  ─────────────────────────────

create table if not exists public.feedback_messages (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.feedback_posts (id) on delete cascade,
  -- Quien escribió (el dueño de la publicación o el admin).
  user_id     uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
  from_admin  boolean not null default false,
  body        text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at  timestamptz not null default now()
);

alter table public.feedback_messages enable row level security;

drop policy if exists feedback_messages_select on public.feedback_messages;
drop policy if exists feedback_messages_insert on public.feedback_messages;
create policy feedback_messages_select on public.feedback_messages
  for select using (
    public.is_app_admin()
    or exists (select 1 from public.feedback_posts p where p.id = post_id and p.user_id = auth.uid())
  );
-- El dueño escribe en lo suyo; el admin escribe como admin.
create policy feedback_messages_insert on public.feedback_messages
  for insert with check (
    auth.uid() = user_id
    and (
      (not from_admin and exists (select 1 from public.feedback_posts p where p.id = post_id and p.user_id = auth.uid()))
      or (from_admin and public.is_app_admin())
    )
  );

create index if not exists feedback_messages_post_idx
  on public.feedback_messages (post_id, created_at);

-- B5: cada mensaje marca la actividad de su lado y que quien escribe ya leyó.
create or replace function public.feedback_messages_touch()
returns trigger
language plpgsql
as $$
begin
  if new.from_admin then
    update public.feedback_posts
       set admin_activity_at = new.created_at, admin_read_at = new.created_at
     where id = new.post_id;
  else
    update public.feedback_posts
       set user_activity_at = new.created_at, user_read_at = new.created_at
     where id = new.post_id;
  end if;
  return new;
end;
$$;

drop trigger if exists feedback_messages_touch on public.feedback_messages;
create trigger feedback_messages_touch
  after insert on public.feedback_messages
  for each row execute function public.feedback_messages_touch();

-- B5: sin leer, para el punto del menú (lo propio) y la bandeja (admin).
create or replace function public.feedback_unread()
returns table (mine integer, inbox integer)
language sql
stable
as $$
  select
    (count(*) filter (
      where user_id = auth.uid()
        and admin_activity_at is not null
        and admin_activity_at > user_read_at
    ))::integer as mine,
    (count(*) filter (
      where public.is_app_admin()
        and user_id <> auth.uid()
        and (admin_read_at is null or user_activity_at > admin_read_at)
    ))::integer as inbox
  from public.feedback_posts
$$;

-- ─────────────────────────────  capturas (B4)  ─────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback', 'feedback', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "feedback_select_own_or_admin" on storage.objects;
create policy "feedback_select_own_or_admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'feedback'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_app_admin())
  );

drop policy if exists "feedback_insert_own" on storage.objects;
create policy "feedback_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'feedback' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "feedback_delete_own" on storage.objects;
create policy "feedback_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'feedback' and (storage.foldername(name))[1] = auth.uid()::text);
