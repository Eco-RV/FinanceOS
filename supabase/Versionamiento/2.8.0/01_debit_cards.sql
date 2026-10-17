-- v2.8.0 · 01 — Tarjetas de débito.
--
-- Una tarjeta de débito pertenece a una cuenta bancaria (corriente o ahorro) y
-- como máximo hay UNA activa por cuenta (regla C3). No tiene saldo propio: un
-- gasto con la tarjeta de débito es un gasto de su cuenta (`account_id`) que
-- además recuerda con qué tarjeta se pagó (`transactions.debit_card_id`).
-- Un plan (gasto fijo) también se puede pagar con una tarjeta de débito
-- (`plans.debit_card_id`, junto con la cuenta de esa tarjeta en `account_id`).
--
-- Ejecutar ANTES de desplegar el código 2.8.0 (después de 00_). Idempotente.

create table if not exists public.debit_cards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
  account_id  uuid not null references public.accounts (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 40),
  last_four   text check (last_four is null or last_four ~ '^[0-9]{4}$'),
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.debit_cards enable row level security;

drop policy if exists debit_cards_select_own on public.debit_cards;
drop policy if exists debit_cards_insert_own on public.debit_cards;
drop policy if exists debit_cards_update_own on public.debit_cards;
drop policy if exists debit_cards_delete_own on public.debit_cards;

create policy debit_cards_select_own on public.debit_cards
  for select using (auth.uid() = user_id);
create policy debit_cards_insert_own on public.debit_cards
  for insert with check (auth.uid() = user_id);
create policy debit_cards_update_own on public.debit_cards
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy debit_cards_delete_own on public.debit_cards
  for delete using (auth.uid() = user_id);

create index if not exists debit_cards_user_idx
  on public.debit_cards (user_id) where not archived;

-- C3: una tarjeta de débito activa por cuenta (choque → 23505).
create unique index if not exists debit_cards_account_active_uidx
  on public.debit_cards (account_id) where not archived;

-- Con qué tarjeta de débito se pagó un gasto de cuenta.
alter table public.transactions
  add column if not exists debit_card_id uuid
    references public.debit_cards (id) on delete set null;

alter table public.transactions drop constraint if exists transactions_debit_card_check;
alter table public.transactions
  add constraint transactions_debit_card_check check (
    debit_card_id is null
    or (type = 'expense' and account_id is not null and card_id is null)
  );

create index if not exists transactions_debit_card_idx
  on public.transactions (debit_card_id)
  where debit_card_id is not null;

-- Plan pagado con tarjeta de débito (la cuenta de la tarjeta va en account_id).
alter table public.plans
  add column if not exists debit_card_id uuid
    references public.debit_cards (id) on delete set null;

-- materialize_plan (2.7.0) + debit_card_id. Misma firma: el código 2.7.0 sigue
-- funcionando (sin la clave, queda en null).
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
       debit_card_id, plan_id)
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
