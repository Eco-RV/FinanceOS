-- v3.3.0 · 00 — Outlook como proveedor de correo y mantenimiento de Bancos.
--
--   mail_connections  acepta 'outlook' (Microsoft Graph, cuentas personales)
--                     y queda UNA conexión por usuario: conectar otro
--                     proveedor reemplaza la anterior. Guarda el resultado
--                     de la última lectura (`last_result`) y el último error.
--   banks             `last_parsed_at`: último aviso que el formato entendió;
--                     `last_ignored_at`: último correo de sus remitentes que
--                     no entendió (si es más nuevo, la plantilla pudo cambiar).
--
-- Ejecutar DESPUÉS de todo 3.2.0. Idempotente.

-- ─────────────────────────────  mail_connections  ─────────────────────────────

alter table public.mail_connections
  drop constraint if exists mail_connections_provider_check;
alter table public.mail_connections
  add constraint mail_connections_provider_check
  check (provider in ('gmail', 'outlook'));

-- Una sola conexión por usuario (antes: una por proveedor).
alter table public.mail_connections
  drop constraint if exists mail_connections_user_id_provider_key;
create unique index if not exists mail_connections_one_per_user
  on public.mail_connections (user_id);

alter table public.mail_connections
  add column if not exists last_result jsonb,
  add column if not exists last_error text,
  add column if not exists last_error_at timestamptz;

-- ─────────────────────────────  banks  ─────────────────────────────

alter table public.banks
  add column if not exists last_parsed_at timestamptz,
  add column if not exists last_ignored_at timestamptz;
