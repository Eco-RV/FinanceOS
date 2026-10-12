-- v2.2.0 · 00 — Arranque de 0 (regla M8).
--
-- Deja la app como recién empezada sin perder la historia:
--   1. Borra las cuotas PENDIENTES de los financiamientos (fecha > hoy): son
--      cargos programados que ya no aplican.
--   2. Archiva TODOS los movimientos activos (gastos, ingresos, abonos,
--      transferencias, saldos iniciales, cuotas ya cobradas, pagos de
--      préstamos…). Archivados no se ven en ninguna lista y el trigger de
--      saldos revierte su efecto. Se desligan de su financiamiento/préstamo
--      (`financing_id`/`loan_id` = null) para conservarlos al borrar el plan.
--   3. Borra financiamientos y préstamos (sus cuotas pendientes no existen
--      como movimientos: el calendario de un préstamo es un cálculo).
--   4. Crea el saldo inicial NUEVO de cada cuenta y tarjeta (por moneda), que
--      SÍ es visible: es el movimiento del arranque.
--   5. Deja constancia en `fresh_starts` (fecha y cuántos movimientos archivó).
--
-- Conserva: cuentas, tarjetas, bancos, categorías, conexión de correo,
-- reglas de comercio, pendientes por confirmar y tipos de cambio.
--
-- Todo en una sola función: o se hace completo o no se hace nada.
-- Ejecutar DESPUÉS de todo 2.1.0. Idempotente.

create table if not exists public.fresh_starts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid()
                       references auth.users (id) on delete cascade,
  started_on         date not null,
  archived_movements integer not null default 0,
  archived           boolean not null default false,
  created_at         timestamptz not null default now()
);

alter table public.fresh_starts enable row level security;

drop policy if exists fresh_starts_select_own on public.fresh_starts;
drop policy if exists fresh_starts_insert_own on public.fresh_starts;
drop policy if exists fresh_starts_update_own on public.fresh_starts;
drop policy if exists fresh_starts_delete_own on public.fresh_starts;
create policy fresh_starts_select_own on public.fresh_starts
  for select using (auth.uid() = user_id);
create policy fresh_starts_insert_own on public.fresh_starts
  for insert with check (auth.uid() = user_id);
create policy fresh_starts_update_own on public.fresh_starts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy fresh_starts_delete_own on public.fresh_starts
  for delete using (auth.uid() = user_id);

create index if not exists fresh_starts_user_idx
  on public.fresh_starts (user_id) where not archived;

-- p_openings: [{"account_id": "…", "amount": 125000.50},
--              {"card_id": "…", "currency": "USD", "amount": 80}, …]
-- (montos con signo, ≠ 0; los que son 0 no se mandan). La app valida que haya
-- uno por cuenta y tarjeta activa; aquí se valida la forma.
create or replace function public.fresh_start(
  p_today    date,
  p_on       date,
  p_openings jsonb
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_archived integer;
  o          jsonb;
begin
  if v_user is null then
    raise exception 'Sesión requerida';
  end if;
  if jsonb_typeof(coalesce(p_openings, '[]'::jsonb)) <> 'array' then
    raise exception 'p_openings debe ser una lista';
  end if;

  -- 1) Cuotas pendientes de financiamientos.
  delete from public.transactions
   where user_id = v_user
     and financing_id is not null
     and occurred_on > p_today
     and not archived;

  -- 2) Archivar todo lo activo (el trigger revierte cada saldo).
  update public.transactions
     set archived = true
   where user_id = v_user
     and not archived;
  get diagnostics v_archived = row_count;

  --    … y desligar del plan todo lo que se conserva (también lo ya archivado).
  update public.transactions
     set financing_id = null,
         loan_id = null
   where user_id = v_user
     and (financing_id is not null or loan_id is not null);

  -- 3) Planes.
  delete from public.financings where user_id = v_user;
  delete from public.loans where user_id = v_user;

  -- 4) Saldos iniciales nuevos (visibles).
  for o in select * from jsonb_array_elements(coalesce(p_openings, '[]'::jsonb))
  loop
    if (o->>'account_id') is not null then
      insert into public.transactions
        (type, amount, currency, occurred_on, category, note, account_id)
      select 'opening_balance', (o->>'amount')::numeric, a.currency, p_on,
             null, 'Saldo inicial (arranque de 0)', a.id
        from public.accounts a
       where a.id = (o->>'account_id')::uuid and not a.archived;
      if not found then
        raise exception 'Cuenta no encontrada o desactivada: %', o->>'account_id';
      end if;
    elsif (o->>'card_id') is not null then
      insert into public.transactions
        (type, amount, currency, occurred_on, category, note, card_id)
      select 'opening_balance', (o->>'amount')::numeric, o->>'currency', p_on,
             null, 'Saldo inicial (arranque de 0)', c.id
        from public.credit_cards c
       where c.id = (o->>'card_id')::uuid and not c.archived;
      if not found then
        raise exception 'Tarjeta no encontrada o desactivada: %', o->>'card_id';
      end if;
    else
      raise exception 'Cada saldo inicial es de una cuenta o de una tarjeta';
    end if;
  end loop;

  -- 5) Constancia.
  insert into public.fresh_starts (started_on, archived_movements)
  values (p_on, v_archived);

  return v_archived;
end;
$$;
