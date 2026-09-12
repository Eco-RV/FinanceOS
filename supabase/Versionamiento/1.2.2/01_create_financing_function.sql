-- v1.2.2 — Stored procedure que crea un financiamiento y sus N cuotas de forma
-- atómica (o se crean todas las filas, o ninguna). Se invoca desde la app vía
-- `supabase.rpc('create_financing', {...})`.
--
-- Ejecutar DESPUÉS de 00_financings_schema.sql.
--
-- security invoker: corre con los privilegios y el RLS del usuario autenticado
-- que llama, igual que `apply_transaction_balance` en
-- supabase/migrations/20260906120000_transactions.sql. No hay forma de crear
-- un financiamiento sobre una tarjeta ajena: el `select ... from credit_cards`
-- solo devuelve una fila si la tarjeta es del usuario (por su propia RLS), y los
-- inserts en `financings`/`transactions` quedan sujetos a las policies de cada
-- tabla (que exigen `user_id = auth.uid()`, poblado por el default de columna).

create or replace function public.create_financing(
  p_card_id uuid,
  p_description text,
  p_category text,
  p_total_amount numeric,
  p_months integer,
  p_first_charge_on date
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_currency text;
  v_financing_id uuid;
  v_cents bigint;
  v_base bigint;
  v_remainder bigint;
  v_amount numeric(14, 2);
  v_day integer;
  v_year integer;
  v_month0 integer;
  v_last_day integer;
  v_target date;
begin
  select currency into v_currency
    from public.credit_cards
    where id = p_card_id and not archived;

  if v_currency is null then
    raise exception 'Tarjeta no encontrada';
  end if;

  p_total_amount := round(p_total_amount, 2);

  insert into public.financings (
    card_id, description, category, total_amount, months, currency, first_charge_on
  ) values (
    p_card_id, p_description, p_category, p_total_amount, p_months, v_currency, p_first_charge_on
  ) returning id into v_financing_id;

  -- Reparto en centavos enteros para que la suma de las cuotas cierre exacto
  -- al total (el residuo, si lo hay, se lo lleva la última cuota).
  v_cents := round(p_total_amount * 100)::bigint;
  v_base := v_cents / p_months;
  v_remainder := v_cents - v_base * p_months;

  v_day := extract(day from p_first_charge_on)::int;

  for i in 0 .. (p_months - 1) loop
    -- Mismo "clamp de día en mes corto" que `clampDay` en src/lib/cards.ts,
    -- para que el día de cobro mensual coincida con el día de la compra.
    v_year := extract(year from p_first_charge_on)::int;
    v_month0 := extract(month from p_first_charge_on)::int - 1 + i;
    v_year := v_year + v_month0 / 12;
    v_month0 := v_month0 % 12;
    v_last_day := extract(day from (
      make_date(v_year, v_month0 + 1, 1) + interval '1 month - 1 day'
    ))::int;
    v_target := make_date(v_year, v_month0 + 1, least(v_day, v_last_day));

    v_amount := (v_base + case when i = p_months - 1 then v_remainder else 0 end) / 100.0;

    insert into public.transactions (
      type, amount, currency, occurred_on, category, note,
      card_id, financing_id, installment_no
    ) values (
      'expense', v_amount, v_currency, v_target, p_category,
      p_description || ' (cuota ' || (i + 1) || '/' || p_months || ')',
      p_card_id, v_financing_id, i + 1
    );
  end loop;

  return v_financing_id;
end;
$$;
