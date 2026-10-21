-- v3.2.0 · 02 — Quién es admin del buzón de comentarios.
--
-- El rol va en `app_metadata` (el usuario no la puede cambiar desde la app) y
-- llega en el JWT, que es donde lo leen las policies (`public.is_app_admin()`)
-- y la app (`getUser().isAdmin`).
--
-- 1. Cambiar el correo de abajo por el de la cuenta admin y correr.
-- 2. Cerrar sesión y volver a entrar en la app (el JWT nuevo trae el rol).
--
-- Ejecutar DESPUÉS de 01_feedback.sql.

update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
 where email = 'CAMBIAR@correo.com';

-- Comprobar (debe salir una fila con role = admin):
select email, raw_app_meta_data ->> 'role' as role
  from auth.users
 where raw_app_meta_data ->> 'role' = 'admin';

-- Quitar el rol (si hiciera falta):
-- update auth.users set raw_app_meta_data = raw_app_meta_data - 'role' where email = 'CAMBIAR@correo.com';
