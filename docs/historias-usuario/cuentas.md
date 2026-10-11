# Cuentas

> Ver convención general en [`README.md`](./README.md).

## Resumen

Cuentas de débito, ahorro o efectivo. Cada cuenta tiene un saldo que se
mantiene al día automáticamente a partir de los movimientos (gastos, ingresos
y pagos de tarjeta) que se le registran — de momento se edita a mano el saldo para ajustar.

## Historias de usuario

### 1. Crear una cuenta
Como usuario quiero registrar una cuenta (débito, ahorro o efectivo) con
nombre, tipo, institución opcional, moneda y saldo inicial, para empezar a
llevar el control de su saldo en la app.

**Criterios de aceptación**
- Campos: `name` (obligatorio), `type` (`checking`/`savings`/`cash`),
  `institution` (opcional, hasta 80 caracteres), `currency` (`CRC` o `USD`),
  **saldo inicial** (numérico con signo, puede ser 0 o negativo) y su
  **fecha**.
- El saldo inicial se guarda como un **movimiento** `opening_balance`
  ("Saldo inicial", regla C1), no como un número suelto. El saldo de la
  cuenta = saldo inicial + movimientos. Si es 0 no se crea el movimiento.

### 2. Editar una cuenta
Como usuario quiero editar los datos de una cuenta existente, para corregir
información o su saldo inicial.

**Criterios de aceptación**
- Se pueden cambiar nombre, tipo, institución, moneda y el saldo inicial
  (monto y fecha). El saldo actual **no** se edita a mano: cambiar el saldo
  inicial actualiza ese movimiento y el saldo se recalcula; ponerlo en 0
  elimina el movimiento.

### 3. Eliminar una cuenta
Como usuario quiero eliminar una cuenta que ya no uso, para que deje de
aparecer en mis listados.

**Criterios de aceptación**
- Es un borrado permanente (no hay papelera ni "archivar" expuesto en la
  interfaz todavía).
- Al borrar la cuenta se borran en cascada todos sus movimientos (gastos,
  ingresos y pagos de tarjeta hechos desde ella).
- Si alguno de esos movimientos era un pago de tarjeta, el saldo de la
  tarjeta correspondiente se reajusta automáticamente (revierte el efecto del
  pago) — conviene revisar el saldo de esa tarjeta después de borrar.

### 4. Ver mis cuentas y mi liquidez total
Como usuario quiero ver todas mis cuentas con su saldo actual y un total en
colones, para tener una vista rápida de mi liquidez.

**Criterios de aceptación**
- Listado ordenado por fecha de creación (la más antigua primero).
- El total mostrado solo suma las cuentas en `CRC`; las cuentas en `USD` se
  listan pero no entran en ese total (ver *Reglas de negocio*).
- En mobile la misma información se ve como tarjetas apiladas en vez de tabla.

## Reglas de negocio

- **La verdad son los movimientos** (G1). `current_balance` es una copia
  (proyección) que mantiene un trigger de Postgres en cada insert/update/delete
  de `transactions`; nunca se escribe a mano. En **Ajustes → Verificar
  saldos** se comprueba que coincida con los movimientos y se puede
  recalcular.
- El total de liquidez en la página de Cuentas, y la cobertura del dashboard,
  son **solo en CRC** — no hay conversión de moneda real en la app todavía.
- Solo existen tres tipos de cuenta (`checking`, `savings`, `cash`); no hay
  subtipos ni cuentas de inversión.

## Pendiente / fuera de alcance

- No hay "archivar" cuenta desde la interfaz (la columna `archived` existe en
  la base de datos y el trigger la respeta, pero ningún formulario la expone
  todavía — hoy la única acción destructiva disponible es el borrado
  permanente).
- No hay conversión de moneda entre cuentas de distinta divisa.
- Ahorros con metas (roadmap paso 4) todavía no existen como concepto propio;
  hoy una cuenta `savings` es solo una cuenta más sin objetivo asociado.

## Historial

- **2026-10-08 (v1.2.3)** — Primera versión de este documento, redactada a
  partir del comportamiento real de `src/app/(app)/procesos/cuentas/`.
- **2026-10-11 (v2.0.0, en desarrollo)** — El saldo inicial pasa a ser un
  movimiento `opening_balance` con fecha; el saldo actual ya no se edita a mano.
  Los saldos de apertura existentes se migran con
  `supabase/Versionamiento/2.0.0/02_migrate_opening_balances.sql`.
