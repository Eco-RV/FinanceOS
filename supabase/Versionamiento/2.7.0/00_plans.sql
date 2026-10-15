-- v2.7.0 · 00 — Planes recurrentes: salario, suscripción y seguro de tarjeta.
--
-- Un plan genera movimientos periódicos (P1, P2, T9). Para no inflar los
-- saldos de hoy con plata que todavía no entra o sale (M7), los movimientos
-- NO se crean por adelantado: la app registra cada ocurrencia cuando llega su
-- fecha (al abrirla) con `materialize_plan`, y las futuras solo se calculan.
-- `generated_through` = última fecha ya registrada; nunca se vuelve a generar
-- antes de ella (tampoco tras un Arranque de 0 ni al borrar una a mano).
--
-- P3: eliminar un plan no deja cargos futuros (no existen) y conserva los ya
-- ocurridos (`transactions.plan_id` pasa a null).
--
-- Ejecutar ANTES de desplegar el código 2.7.0 (después de todo 2.6.0).
-- Idempotente.

create table if not exists public.plans (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid()
                      references auth.users (id) on delete cascade,
  kind              text not null check (kind in ('salary', 'subscription', 'insurance')),
  name              text not null check (char_length(name) between 1 and 60),
  amount            numeric(14, 2) not null check (amount > 0),
  currency          text not null default 'CRC' check (currency in ('CRC', 'USD')),
  frequency         text not null default 'monthly'
                      check (frequency in ('weekly', 'biweekly', 'semimonthly', 'monthly')),
  starts_on         date not null,
  ends_on           date,
  account_id        uuid references public.accounts (id) on delete set null,
  card_id           uuid references public.credit_cards (id) on delete set null,
  category          text check (category is null or char_length(category) <= 40),
  note              text check (note is null or char_length(note) <= 200),
  generated_through date,
  archived          boolean not null default false,
  created_at        timestamptz not null default now(),
  constraint plans_dates check (ends_on is null or ends_on >= starts_on),
  -- P2/T9: suscripción y seguro son mensuales.
  constraint plans_monthly_charges check (kind = 'salary' or frequency = 'monthly'),
  -- P1: salario → cuenta. T9: seguro → tarjeta de crédito. P2: suscripción →
  -- tarjeta de crédito o cuenta de débito, no ambas. (La FK puede quedar en
  -- null si se borra la cuenta/tarjeta: el plan se pausa en la app.)
  constraint plans_target check (
    case kind
      when 'salary' then card_id is null
      when 'insurance' then account_id is null
      else not (account_id is not null and card_id is not null)
    end
  )
);

alter table public.plans enable row level security;

drop policy if exists plans_select_own on public.plans;
drop policy if exists plans_insert_own on public.plans;
drop policy if exists plans_update_own on public.plans;
drop policy if exists plans_delete_own on public.plans;
create policy plans_select_own on public.plans
  for select using (auth.uid() = user_id);
create policy plans_insert_own on public.plans
  for insert with check (auth.uid() = user_id);
create policy plans_update_own on public.plans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy plans_delete_own on public.plans
  for delete using (auth.uid() = user_id);

create index if not exists plans_user_idx on public.plans (user_id) where not archived;

-- Movimientos de un plan.
alter table public.transactions
  add column if not exists plan_id uuid references public.plans (id) on delete set null;

-- Una ocurrencia por plan y fecha (incluye archivadas: nunca se duplica).
create unique index if not exists transactions_plan_occurrence_unique
  on public.transactions (plan_id, occurred_on)
  where plan_id is not null;

-- Registra las ocurrencias ya llegadas de un plan y avanza `generated_through`,
-- de forma atómica. p_rows: [{"type":"income","amount":…,"currency":"CRC",
-- "occurred_on":"2026-10-15","category":"Salario","note":"…",
-- "account_id":"…"|null,"card_id":"…"|null}, …] (las calcula el dominio).
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
      (type, amount, currency, occurred_on, category, note, account_id, card_id, plan_id)
    values (
      r->>'type',
      (r->>'amount')::numeric,
      r->>'currency',
      (r->>'occurred_on')::date,
      nullif(r->>'category', ''),
      nullif(r->>'note', ''),
      nullif(r->>'account_id', '')::uuid,
      nullif(r->>'card_id', '')::uuid,
      p_plan_id
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
