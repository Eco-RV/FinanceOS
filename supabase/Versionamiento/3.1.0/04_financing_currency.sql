-- v3.1.0 · 04 — Financiamiento en otra moneda de la tarjeta (F10).
--
-- Antes la moneda del plan era la del límite de la tarjeta. Ahora se elige
-- (CRC o USD): una tarjeta con límite en colones puede tener un financiamiento
-- en dólares; sus cuotas van al saldo en dólares (T1) y el disponible lo
-- convierte con el último tipo de cambio (T2). Misma lógica que
-- create_financing_v3 con un parámetro más. create_financing_v3 queda sin uso.
--
-- Ejecutar DESPUÉS de 03_card_minimum_payments.sql. Idempotente.

create or replace function public.create_financing_v4(
  p_card_id uuid,
  p_description text,
  p_category text,
  p_principal numeric,
  p_annual_rate numeric,
  p_months integer,
  p_first_charge_on date,
  p_installments jsonb,
  p_currency text
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_currency text;
  v_financing_id uuid;
  v_count integer;
  v_distinct integer;
  v_principal_sum numeric(14, 2);
  v_bad integer;
begin
  -- F10 (3.1.0): la moneda la elige el usuario (CRC o USD; tarjeta bimoneda, T1).
  if not exists (select 1 from public.credit_cards where id = p_card_id and not archived) then
    raise exception 'Tarjeta no encontrada';
  end if;
  if p_currency not in ('CRC', 'USD') then
    raise exception 'Moneda no soportada: %', p_currency;
  end if;
  v_currency := p_currency;

  p_principal := round(p_principal, 2);

  select count(*), count(distinct i.no),
         coalesce(sum(round(i.amount, 2) - round(coalesce(i.interest, 0), 2)), 0)
    into v_count, v_distinct, v_principal_sum
    from jsonb_to_recordset(p_installments)
      as i(no int, occurred_on date, amount numeric, interest numeric);

  if v_count <> p_months or v_distinct <> p_months then
    raise exception 'Se esperaban % cuotas y llegaron %', p_months, v_count;
  end if;
  if v_principal_sum <> p_principal then
    raise exception 'Los abonos al capital suman % y el capital es %', v_principal_sum, p_principal;
  end if;

  select count(*) into v_bad
    from jsonb_to_recordset(p_installments)
      as i(no int, occurred_on date, amount numeric, interest numeric)
    where i.no is null or i.no < 1 or i.no > p_months
       or i.occurred_on is null or i.amount is null or i.amount <= 0
       or coalesce(i.interest, 0) < 0 or coalesce(i.interest, 0) >= i.amount;
  if v_bad > 0 then
    raise exception 'Hay cuotas inválidas';
  end if;

  insert into public.financings (
    card_id, description, category, total_amount, annual_rate, months, currency, first_charge_on
  ) values (
    p_card_id, p_description, p_category, p_principal, coalesce(p_annual_rate, 0),
    p_months, v_currency, p_first_charge_on
  ) returning id into v_financing_id;

  insert into public.transactions (
    type, amount, interest_amount, currency, occurred_on, category, note,
    card_id, financing_id, installment_no
  )
  select
    'expense', round(i.amount, 2), nullif(round(coalesce(i.interest, 0), 2), 0),
    v_currency, i.occurred_on, p_category,
    p_description || ' (cuota ' || i.no || '/' || p_months || ')',
    p_card_id, v_financing_id, i.no
  from jsonb_to_recordset(p_installments)
    as i(no int, occurred_on date, amount numeric, interest numeric);

  return v_financing_id;
end;
$$;
