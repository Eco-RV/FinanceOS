-- v3.1.0 · 06 — Abono extraordinario al capital de un financiamiento (F11).
--
-- El abono sale de una cuenta como un gasto (lo crea la app, `transaction_id`).
-- `prepay_financing` reemplaza, de forma atómica, las cuotas PROGRAMADAS
-- (fecha > hoy) desde `p_from_no` por el plan nuevo que calculó el dominio, y
-- guarda las anteriores en `previous_installments` para poder deshacerlo.
-- `undo_financing_prepayment` vuelve al plan anterior (solo el último abono y
-- mientras ninguna cuota del plan nuevo haya llegado) y borra el gasto.
--
-- Ejecutar DESPUÉS de 05_loan_adjustments.sql. Idempotente.

create table if not exists public.financing_prepayments (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null default auth.uid()
                           references auth.users (id) on delete cascade,
  financing_id           uuid not null references public.financings (id) on delete cascade,
  amount                 numeric(14, 2) not null check (amount > 0),
  mode                   text not null check (mode in ('term', 'payment')),
  occurred_on            date not null,
  from_installment       integer not null check (from_installment >= 1),
  previous_installments  jsonb not null,
  previous_months        integer not null,
  transaction_id         uuid references public.transactions (id) on delete set null,
  archived               boolean not null default false,
  created_at             timestamptz not null default now()
);

alter table public.financing_prepayments enable row level security;

drop policy if exists financing_prepayments_select_own on public.financing_prepayments;
drop policy if exists financing_prepayments_insert_own on public.financing_prepayments;
drop policy if exists financing_prepayments_update_own on public.financing_prepayments;
drop policy if exists financing_prepayments_delete_own on public.financing_prepayments;
create policy financing_prepayments_select_own on public.financing_prepayments
  for select using (auth.uid() = user_id);
create policy financing_prepayments_insert_own on public.financing_prepayments
  for insert with check (auth.uid() = user_id);
create policy financing_prepayments_update_own on public.financing_prepayments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy financing_prepayments_delete_own on public.financing_prepayments
  for delete using (auth.uid() = user_id);

create index if not exists financing_prepayments_user_idx
  on public.financing_prepayments (user_id) where not archived;
create index if not exists financing_prepayments_financing_idx
  on public.financing_prepayments (financing_id, created_at) where not archived;

-- p_installments: [{"no": 4, "occurred_on": "2027-02-05", "amount": 56735.76, "interest": 4000}, ...]
create or replace function public.prepay_financing(
  p_financing_id uuid,
  p_today date,
  p_from_no integer,
  p_installments jsonb,
  p_amount numeric,
  p_mode text,
  p_occurred_on date,
  p_transaction_id uuid
) returns uuid
language plpgsql
security invoker
as $$
declare
  f public.financings%rowtype;
  v_previous jsonb;
  v_count integer;
  v_id uuid;
begin
  select * into f from public.financings
   where id = p_financing_id and not archived and cancelled_on is null;
  if not found then
    raise exception 'Financiamiento no encontrado o cancelado';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'no', installment_no, 'occurred_on', occurred_on,
           'amount', amount, 'interest', coalesce(interest_amount, 0)
         ) order by installment_no), '[]'::jsonb)
    into v_previous
    from public.transactions
   where financing_id = p_financing_id and not archived
     and installment_no >= p_from_no and occurred_on > p_today;

  if jsonb_array_length(v_previous) = 0 then
    raise exception 'El financiamiento no tiene cuotas programadas desde la %', p_from_no;
  end if;

  delete from public.transactions
   where financing_id = p_financing_id and not archived
     and installment_no >= p_from_no and occurred_on > p_today;

  insert into public.transactions (
    type, amount, interest_amount, currency, occurred_on, category, note,
    card_id, financing_id, installment_no
  )
  select 'expense', round(i.amount, 2), nullif(round(coalesce(i.interest, 0), 2), 0),
         f.currency, i.occurred_on, f.category,
         f.description || ' (cuota ' || i.no || '/' || (p_from_no - 1 + jsonb_array_length(p_installments)) || ')',
         f.card_id, f.id, i.no
    from jsonb_to_recordset(p_installments)
      as i(no int, occurred_on date, amount numeric, interest numeric);
  get diagnostics v_count = row_count;

  update public.financings set months = p_from_no - 1 + v_count where id = f.id;

  insert into public.financing_prepayments (
    financing_id, amount, mode, occurred_on, from_installment,
    previous_installments, previous_months, transaction_id
  ) values (
    f.id, round(p_amount, 2), p_mode, p_occurred_on, p_from_no,
    v_previous, f.months, p_transaction_id
  ) returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.undo_financing_prepayment(p_id uuid, p_today date)
returns void
language plpgsql
security invoker
as $$
declare
  p public.financing_prepayments%rowtype;
  f public.financings%rowtype;
  v_arrived integer;
begin
  select * into p from public.financing_prepayments where id = p_id and not archived;
  if not found then
    raise exception 'Abono no encontrado';
  end if;
  if exists (
    select 1 from public.financing_prepayments
     where financing_id = p.financing_id and not archived and created_at > p.created_at
  ) then
    raise exception 'Solo se deshace el último abono';
  end if;
  select * into f from public.financings where id = p.financing_id;

  select count(*) into v_arrived from public.transactions
   where financing_id = p.financing_id and not archived
     and installment_no >= p.from_installment and occurred_on <= p_today;
  if v_arrived > 0 then
    raise exception 'Ya llegaron cuotas del plan nuevo: no se puede deshacer';
  end if;

  delete from public.transactions
   where financing_id = p.financing_id and not archived and installment_no >= p.from_installment;

  insert into public.transactions (
    type, amount, interest_amount, currency, occurred_on, category, note,
    card_id, financing_id, installment_no
  )
  select 'expense', round(i.amount, 2), nullif(round(coalesce(i.interest, 0), 2), 0),
         f.currency, i.occurred_on, f.category,
         f.description || ' (cuota ' || i.no || '/' || p.previous_months || ')',
         f.card_id, f.id, i.no
    from jsonb_to_recordset(p.previous_installments)
      as i(no int, occurred_on date, amount numeric, interest numeric);

  update public.financings set months = p.previous_months where id = f.id;
  if p.transaction_id is not null then
    delete from public.transactions where id = p.transaction_id;
  end if;
  delete from public.financing_prepayments where id = p.id;
end;
$$;
