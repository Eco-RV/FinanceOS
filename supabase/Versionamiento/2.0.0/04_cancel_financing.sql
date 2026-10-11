-- v2.0.0 · 04 — Eliminar un financiamiento sin tocar las cuotas ya cobradas (F4).
--
-- Antes, borrar un financiamiento borraba (cascade) TODAS sus cuotas, pasadas y
-- futuras, y revertía el saldo completo. Ahora:
--   - se borran solo las cuotas con fecha POSTERIOR a `p_today` (las futuras);
--   - las cuotas con fecha <= `p_today` se conservan (ya ocurrieron) y quedan
--     ligadas al plan; si el usuario quiere quitarlas, lo hace a mano;
--   - el plan queda marcado `cancelled_on = p_today`;
--   - si no quedó ninguna cuota, el plan se borra completo.
-- `p_today` lo manda la app (el "hoy" de Costa Rica lo decide el dominio).
--
-- El trigger de saldos revierte solo lo de las cuotas borradas.
--
-- Ejecutar ANTES de desplegar el código que lo usa.

alter table public.financings
  add column if not exists cancelled_on date;

create or replace function public.cancel_financing(p_financing_id uuid, p_today date)
returns text
language plpgsql
security invoker
as $$
declare
  v_card_id uuid;
  v_kept integer;
begin
  select card_id into v_card_id
    from public.financings
    where id = p_financing_id;

  if v_card_id is null then
    raise exception 'Financiamiento no encontrado';
  end if;

  delete from public.transactions
    where financing_id = p_financing_id
      and occurred_on > p_today;

  select count(*) into v_kept
    from public.transactions
    where financing_id = p_financing_id;

  if v_kept = 0 then
    delete from public.financings where id = p_financing_id;
    return 'deleted';
  end if;

  update public.financings
    set cancelled_on = p_today
    where id = p_financing_id;
  return 'cancelled';
end;
$$;
