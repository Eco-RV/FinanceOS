-- v3.0.0 · 03 — Progreso en la Academia de la Constelación.
--
-- Una fila por usuario y lección con el mejor puntaje del quiz (0–100).
--
-- Ejecutar ANTES de desplegar el código 3.0.0 (después de 02_). Idempotente.

create table if not exists public.academy_progress (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid()
                  references auth.users (id) on delete cascade,
  lesson_key    text not null
                  check (lesson_key in ('wallet', 'blockchain', 'usdc', 'enviar-sin-miedo', 'boveda')),
  score         integer not null check (score between 0 and 100),
  completed_at  timestamptz not null default now(),
  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (user_id, lesson_key)
);

alter table public.academy_progress enable row level security;

drop policy if exists academy_progress_select_own on public.academy_progress;
drop policy if exists academy_progress_insert_own on public.academy_progress;
drop policy if exists academy_progress_update_own on public.academy_progress;
drop policy if exists academy_progress_delete_own on public.academy_progress;

create policy academy_progress_select_own on public.academy_progress
  for select using (auth.uid() = user_id);
create policy academy_progress_insert_own on public.academy_progress
  for insert with check (auth.uid() = user_id);
create policy academy_progress_update_own on public.academy_progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy academy_progress_delete_own on public.academy_progress
  for delete using (auth.uid() = user_id);

create index if not exists academy_progress_user_idx
  on public.academy_progress (user_id) where not archived;
