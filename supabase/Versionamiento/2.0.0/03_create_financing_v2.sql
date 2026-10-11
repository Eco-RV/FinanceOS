-- v2.0.0 · 03 — Financiamiento con cuotas calculadas por el dominio.
--
-- Antes, `create_financing` (1.2.2) calculaba el reparto y las fechas de las
-- cuotas en SQL, duplicando la regla. Ahora la app calcula el plan con
-- `installmentSchedule` (src/domain/financing/installments.ts) y esta función
-- solo lo guarda de forma atómica, validando que:
--   - la tarjeta exista y sea del usuario (RLS),
--   - haya exactamente `p_months` cuotas, numeradas 1..N,
--   - la suma de las cuotas sea exactamente el total.
--
-- `p_installments`: [{"no": 1, "occurred_on": "2026-10-31", "amount": 33333.33}, ...]
--
-- El SP viejo `create_financing` se deja por compatibilidad; se puede borrar
-- en una versión posterior.
--
-- Ejecutar ANTES de desplegar el código 2.0.0.

create or replace function public.create_financing_v2(
  p_card_id uuid,
  p_description text,
  p_category text,
  p_total_amount numeric,
  p_months integer,
  p_first_charge_on date,
  p_installments jsonb
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_currency text;
  v_financing_id uuid;
  v_count integer;
  v_sum numeric(14, 2);
  v_bad integer;
begin
  select currency into v_currency
    from public.credit_cards
    where id = p_card_id and not archived;

  if v_currency is null then
    raise exception 'Tarjeta no encontrada';
  end if;

  p_total_amount := round(p_total_amount, 2);

  select count(*), coalesce(sum(round(i.amount, 2)), 0)
    into v_count, v_sum
    from jsonb_to_recordset(p_installments) as i(no int, occurred_on date, amount numeric);

  if v_count <> p_months then
    raise exception 'Se esperaban % cuotas y llegaron %', p_months, v_count;
  end if;
  if v_sum <> p_total_amount then
    raise exception 'Las cuotas suman % y el total es %', v_sum, p_total_amount;
  end if;

  select count(*) into v_bad
    from jsonb_to_recordset(p_installments) as i(no int, occurred_on date, amount numeric)
    where i.no is null or i.no < 1 or i.no > p_months
       or i.occurred_on is null or i.amount is null or i.amount <= 0;
  if v_bad > 0 then
    raise exception 'Hay cuotas inválidas';
  end if;

  insert into public.financings (
    card_id, description, category, total_amount, months, currency, first_charge_on
  ) values (
    p_card_id, p_description, p_category, p_total_amount, p_months, v_currency, p_first_charge_on
  ) returning id into v_financing_id;

  insert into public.transactions (
    type, amount, currency, occurred_on, category, note,
    card_id, financing_id, installment_no
  )
  select
    'expense', round(i.amount, 2), v_currency, i.occurred_on, p_category,
    p_description || ' (cuota ' || i.no || '/' || p_months || ')',
    p_card_id, v_financing_id, i.no
  from jsonb_to_recordset(p_installments) as i(no int, occurred_on date, amount numeric);

  return v_financing_id;
end;
$$;
