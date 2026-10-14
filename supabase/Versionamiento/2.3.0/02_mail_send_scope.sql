-- v2.3.0 · 02 — Enviar avisos de cuota desde el Gmail conectado (F8).
--
-- La conexión de Gmail (1.3.0) solo pedía lectura. Para enviar avisos por
-- correo se pide también `gmail.send`; aquí se guarda qué permisos concedió
-- el usuario la última vez que conectó, para avisar si hay que reconectar.
--
-- Idempotente.

alter table public.mail_connections
  add column if not exists scopes text;
