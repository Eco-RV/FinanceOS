-- 3.2.0 · Fase 0.3 — Auditoría de aislamiento entre usuarios (SOLO LECTURA).
--
-- No cambia nada: son consultas. Correr en el SQL Editor de Supabase antes de
-- abrir el registro y después de cada SQL nuevo. Cada bloque dice qué
-- resultado se espera; cualquier fila de más es un hallazgo.
--
-- Revisión estática de supabase/Versionamiento (2026-10-21): las 30 tablas
-- de `public` activan RLS y tienen las 4 policies `auth.uid() = user_id`;
-- solo hay 2 funciones `security definer` (perfil al registrarse y canje de
-- invitación) y los buckets son `avatars` (público) y `receipts` (privado).

-- 1) Tablas de `public` SIN RLS.  Esperado: 0 filas.
select c.relname as tabla
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and not c.relrowsecurity
order by 1;

-- 2) Tablas con menos de 4 policies o sin policy de algún comando.
--    Esperado: 0 filas.
select c.relname as tabla,
       count(p.polname) as policies,
       string_agg(distinct p.polcmd::text, '' order by p.polcmd::text) as comandos
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public' and c.relkind in ('r', 'p')
group by c.relname
having count(p.polname) < 4
    or string_agg(distinct p.polcmd::text, '' order by p.polcmd::text) is distinct from 'adrw'
order by 1;

-- 3) Policies que NO filtran por el usuario (no mencionan auth.uid()).
--    Esperado: 0 filas en `public`.
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and coalesce(qual, '') not ilike '%auth.uid()%'
  and coalesce(with_check, '') not ilike '%auth.uid()%'
order by tablename, policyname;

-- 4) Funciones `security definer` en `public` (saltan RLS).
--    Esperado: exactamente handle_new_user_profile y redeem_family_invite,
--    las dos con search_path fijo (columna config no vacía).
select p.proname as funcion,
       p.proconfig as config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
order by 1;

-- 5) Vistas de `public` que NO son security_invoker (corren como su dueño y
--    saltan RLS).  Esperado: 0 filas (balance_derived y balance_drift lo son).
select c.relname as vista, c.reloptions
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'v'
  and not coalesce('security_invoker=true' = any (c.reloptions), false)
  and not coalesce('security_invoker=on' = any (c.reloptions), false)
order by 1;

-- 6) Buckets de Storage.  Esperado: avatars (public = true, por diseño: la
--    foto se muestra con su URL) y receipts (public = false).
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
order by id;

-- 7) Policies de Storage.  Esperado: cada una limita a la carpeta
--    `<auth.uid()>/` del bucket.
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;

-- 8) Filas sin dueño (user_id nulo) en las tablas con user_id.
--    Esperado: todas en 0. Genera una consulta por tabla; copiar y correr el
--    resultado.
select string_agg(
         format('select %L as tabla, count(*) as sin_dueno from public.%I where user_id is null', c.table_name, c.table_name),
         E'\nunion all\n' order by c.table_name
       ) || ';' as consulta
from information_schema.columns c
where c.table_schema = 'public' and c.column_name = 'user_id';
