-- v2.8.0 · 00 — Corte por tarjeta: las compras del día de corte pasan al siguiente.
--
-- Algunos bancos (BAC) arman el estado de cuenta por la fecha en que la compra
-- se PROCESA, no por la fecha de compra: lo que se compra el mismo día del corte
-- normalmente se procesa después y cae en el corte siguiente. Con esta opción
-- (regla T3), el pago de contado suma solo los movimientos con fecha ANTERIOR
-- al día de corte; los del día de corte quedan como consumo sin cortar.
--
-- Ejecutar ANTES de desplegar el código 2.8.0 (después de todo 2.7.0).
-- Idempotente.

alter table public.credit_cards
  add column if not exists cutoff_day_rolls_over boolean not null default false;

comment on column public.credit_cards.cutoff_day_rolls_over is
  'T3 (2.8.0): true = los movimientos con fecha del día de corte entran al corte siguiente.';
