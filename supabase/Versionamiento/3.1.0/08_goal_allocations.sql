-- v3.1.0 · 08 — Varias metas por cuenta con apartados (A4).
--
-- Se quita "una meta activa por cuenta" (A1 de 2.7.0). Con varias metas en la
-- misma cuenta, cada una tiene lo que se le apartó (`allocated`); lo demás
-- queda libre. Con una sola meta, lo ahorrado sigue siendo el saldo.
--
-- Ejecutar DESPUÉS de 07_variable_plans.sql. Idempotente.

drop index if exists public.savings_goals_account_unique;

alter table public.savings_goals
  add column if not exists allocated numeric(14, 2) not null default 0
    check (allocated >= 0);

create index if not exists savings_goals_account_idx
  on public.savings_goals (account_id) where account_id is not null and not archived;
