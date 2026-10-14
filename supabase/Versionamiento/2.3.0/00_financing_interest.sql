-- v2.3.0 · 00 — Financiamiento con interés sobre tarjeta (F5) y edición (F9).
--
-- Un financiamiento ahora puede tener tasa anual. Las cuotas las sigue
-- calculando el dominio (`financingSchedule`, src/domain/financing/plan.ts):
--   - tasa 0: partes iguales con el residuo en la última (como hasta ahora);
--   - con tasa: tabla de amortización francesa, la misma de los préstamos.
-- Cada cuota es UN `expense` por el monto completo (interés + capital), con su
-- interés en `transactions.interest_amount`. El trigger de saldos suma el plan
-- completo al guardar; la app resta del saldo y del disponible el interés de
-- las cuotas que todavía no llegan (solo el capital cuenta desde el día 1).
--
-- `financings.total_amount` pasa a significar "capital financiado" (en tasa 0
-- es lo mismo que el total de la compra, así que los planes viejos no cambian).
--
-- Ejecutar ANTES de desplegar el código 2.3.0. Idempotente.

alter table public.financings
  add column if not exists annual_rate numeric(7, 4) not null default 0
    check (annual_rate >= 0 and annual_rate <= 100);

-- F1: de 2 a 72 cuotas (antes 2 a 48).
alter table public.financings drop constraint if exists financings_months_check;
alter table public.financings
  add constraint financings_months_check check (months between 2 and 72);

comment on column public.financings.total_amount is
  'Capital financiado. En tasa 0 es el total de la compra.';

alter table public.transactions
  add column if not exists interest_amount numeric(14, 2);

alter table public.transactions drop constraint if exists transactions_interest_amount_check;
alter table public.transactions
  add constraint transactions_interest_amount_check
    check (interest_amount is null or (interest_amount >= 0 and interest_amount < amount));

-- Guarda el plan que calculó el dominio, de forma atómica, validando que:
--   - la tarjeta exista, esté activa y sea del usuario (RLS);
--   - haya exactamente `p_months` cuotas, numeradas 1..N;
--   - los abonos al capital (monto − interés) sumen exactamente el capital.
-- `p_installments`: [{"no": 1, "occurred_on": "2026-11-05", "amount": 56735.76, "interest": 12000}, ...]
create or replace function public.create_financing_v3(
  p_card_id uuid,
  p_description text,
  p_category text,
  p_principal numeric,
  p_annual_rate numeric,
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
  v_distinct integer;
  v_principal_sum numeric(14, 2);
  v_bad integer;
begin
  select currency into v_currency
    from public.credit_cards
    where id = p_card_id and not archived;

  if v_currency is null then
    raise exception 'Tarjeta no encontrada';
  end if;

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

-- F9: editar descripción y categoría de un financiamiento y de sus cuotas
-- (no archivadas). Los términos (capital, tasa, meses, fecha) no se editan.
create or replace function public.update_financing(
  p_financing_id uuid,
  p_description text,
  p_category text
) returns void
language plpgsql
security invoker
as $$
declare
  v_months integer;
begin
  update public.financings
     set description = p_description,
         category = p_category
   where id = p_financing_id
  returning months into v_months;

  if v_months is null then
    raise exception 'Financiamiento no encontrado';
  end if;

  update public.transactions
     set category = p_category,
         note = p_description || ' (cuota ' || installment_no || '/' || v_months || ')'
   where financing_id = p_financing_id
     and not archived;
end;
$$;

-- `create_financing_v2` (2.0.0) queda mientras se despliega 2.3.0; se puede
-- borrar en la versión siguiente.
