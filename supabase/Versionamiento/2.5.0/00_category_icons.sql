-- v2.5.0 · 00 — Íconos de categoría.
--
-- Cada categoría puede llevar un ícono del kit de la app (clave estable, p. ej.
-- 'utensils'; lista en src/lib/category-icon-keys.ts). Null = la app sugiere
-- uno por el nombre. A las categorías que ya existen se les asigna uno por
-- defecto según el nombre (mismas reglas que defaultIconFor).
--
-- Idempotente: solo llena las que todavía no tienen ícono.

alter table public.categories
  add column if not exists icon text
    check (icon is null or icon ~ '^[a-z][a-z0-9-]{0,39}$');

update public.categories
set icon = case
  when n ~ 'comida|restaur|almuerzo|cena|desayuno|aliment' then 'utensils'
  when n ~ 'cafe|cafeteria' then 'coffee'
  when n ~ 'super|mercado|abarrot|despensa' then 'shopping-cart'
  when n ~ 'compra|ropa|tienda' then 'shopping-bag'
  when n ~ 'transporte|uber|taxi|bus|peaje|parqueo' then 'car'
  when n ~ 'gasolina|combustible' then 'fuel'
  when n ~ 'viaje|vacacion|vuelo' then 'plane'
  when n ~ 'vivienda|casa|alquiler|hogar|renta' then 'home'
  when n ~ 'servicio|luz|electric' then 'zap'
  when n ~ 'agua' then 'droplets'
  when n ~ 'internet|wifi' then 'wifi'
  when n ~ 'telefono|celular|plan' then 'smartphone'
  when n ~ 'salud|medic|doctor|hospital' then 'heart-pulse'
  when n ~ 'farmacia' then 'pill'
  when n ~ 'gimnasio|gym|deporte' then 'dumbbell'
  when n ~ 'educacion|universidad|colegio|curso|escuela' then 'graduation-cap'
  when n ~ 'libro' then 'book-open'
  when n ~ 'entreten|cine|ocio' then 'film'
  when n ~ 'juego' then 'gamepad'
  when n ~ 'musica' then 'music'
  when n ~ 'suscrip|streaming|netflix|spotify' then 'repeat'
  when n ~ 'belleza|cuidado|personal' then 'sparkles'
  when n ~ 'regalo' then 'gift'
  when n ~ 'mascota|perro|gato|veterin' then 'paw-print'
  when n ~ 'bebe|hijo|ninos' then 'baby'
  when n ~ 'familia' then 'users'
  when n ~ 'mantenim|reparac' then 'wrench'
  when n ~ 'seguro' then 'shield'
  when n ~ 'impuesto|tramite' then 'receipt'
  when n ~ 'banco|comision' then 'landmark'
  when n ~ 'tarjeta' then 'credit-card'
  when n ~ 'ahorro' then 'piggy-bank'
  when n ~ 'salario|sueldo|trabajo' then 'briefcase'
  when n ~ 'freelance|proyecto' then 'laptop'
  when n ~ 'reembolso|cobro' then 'hand-coins'
  when n ~ 'interes' then 'percent'
  when n ~ 'inversion|dividend' then 'trending-up'
  when n ~ 'prestamo' then 'banknote'
  else 'tag'
end
from (
  select id as cid,
         lower(translate(name, 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')) as n
  from public.categories
) as c
where public.categories.id = c.cid
  and public.categories.icon is null;
