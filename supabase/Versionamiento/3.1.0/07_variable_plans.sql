-- v3.1.0 · 07 — Planes con monto variable (P7): salario variable, luz, agua…
--
--   plans.variable          el monto del plan es un estimado.
--   transactions.estimated  la ocurrencia entró con el estimado y falta
--                           confirmar el monto real (Planes → Por confirmar).
-- materialize_plan (2.8.0) + `estimated`. Misma firma: el código anterior sigue
-- funcionando (sin la clave, queda en false).
--
-- Ejecutar DESPUÉS de 06_financing_prepayments.sql. Idempotente.

alter table public.plans
  add column if not exists variable boolean not null default false;

alter table public.transactions
  add column if not exists estimated boolean not null default false;

create index if not exists transactions_estimated_idx
  on public.transactions (user_id) where estimated and not archived;

create or replace function public.materialize_plan(
  p_plan_id uuid,
  p_through date,
  p_rows    jsonb
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer := 0;
  r       jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sesión requerida';
  end if;
  if not exists (select 1 from public.plans where id = p_plan_id and not archived) then
    raise exception 'Plan no encontrado o pausado';
  end if;

  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    insert into public.transactions
      (type, amount, currency, occurred_on, category, note, account_id, card_id,
       debit_card_id, plan_id, estimated)
    values (
      r->>'type',
      (r->>'amount')::numeric,
      r->>'currency',
      (r->>'occurred_on')::date,
      nullif(r->>'category', ''),
      nullif(r->>'note', ''),
      nullif(r->>'account_id', '')::uuid,
      nullif(r->>'card_id', '')::uuid,
      nullif(r->>'debit_card_id', '')::uuid,
      p_plan_id,
      coalesce((r->>'estimated')::boolean, false)
    )
    on conflict (plan_id, occurred_on) where plan_id is not null do nothing;
    if found then
      v_count := v_count + 1;
    end if;
  end loop;

  update public.plans
     set generated_through = greatest(coalesce(generated_through, p_through), p_through)
   where id = p_plan_id;

  return v_count;
end;
$$;
