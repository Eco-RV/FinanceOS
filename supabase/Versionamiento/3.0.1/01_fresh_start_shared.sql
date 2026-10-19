-- v3.0.1 · 01 — Arranque de 0 (M8) también borra los gastos compartidos.
--
-- Misma función que `2.2.0/00_fresh_start.sql` con un paso más (2b): borra
-- `shared_expenses` (y en cascada sus partes y avisos). Los movimientos del
-- gasto y de los cobros se archivan como todos los demás.
--
-- Ejecutar DESPUÉS de 00_shared_expenses.sql. Idempotente.

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

  -- 2b) Gastos compartidos (3.0.1): sus movimientos quedan archivados; el
  --     reparto, los cobros y los avisos se borran (los miembros se conservan).
  delete from public.shared_expenses where user_id = v_user;

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
