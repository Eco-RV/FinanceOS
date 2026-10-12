-- v2.1.0 · 00 — Limpieza: borra el SP `create_financing` (1.2.2), sin uso.
--
-- Desde 2.0.0 la app calcula el plan de cuotas en el dominio
-- (`installmentSchedule`, src/domain/financing/installments.ts) y lo guarda con
-- `create_financing_v2` (2.0.0/03_create_financing_v2.sql). La función vieja
-- duplicaba la regla de reparto en SQL y ningún código la llama.
--
-- Requisito: haber corrido 2.0.0 completo (al menos 03_create_financing_v2.sql).
-- El script se niega a correr si `create_financing_v2` no existe, para no dejar
-- la app sin forma de crear financiamientos.
--
-- No toca datos: los financiamientos y cuotas ya creados quedan igual.
-- Idempotente: si ya se borró, no hace nada.

do $$
begin
  if to_regprocedure(
       'public.create_financing_v2(uuid, text, text, numeric, integer, date, jsonb)'
     ) is null then
    raise exception 'Falta create_financing_v2: corré primero supabase/Versionamiento/2.0.0/03_create_financing_v2.sql';
  end if;
end
$$;

drop function if exists public.create_financing(uuid, text, text, numeric, integer, date);
