-- v3.0.1 · 02 — Un seguro también se cobra a una tarjeta de débito (T9).
--
-- Antes (2.7.0) un seguro iba solo a una tarjeta de crédito (`account_id` en
-- null). Ahora también puede ir a la tarjeta de débito de una cuenta: guarda
-- `debit_card_id` y el `account_id` de esa tarjeta, sin `card_id`. Los
-- movimientos ya salen con `debit_card_id` (`materialize_plan`, 2.8.0).
--
-- Ejecutar DESPUÉS de 01_fresh_start_shared.sql. Idempotente.

alter table public.plans drop constraint if exists plans_target;
alter table public.plans
  add constraint plans_target check (
    case kind
      when 'salary' then card_id is null
      -- T9: crédito (sin cuenta) o débito (cuenta + tarjeta de débito).
      when 'insurance' then not (account_id is not null and card_id is not null)
                            and (account_id is null or debit_card_id is not null)
      else not (account_id is not null and card_id is not null)
    end
  );
