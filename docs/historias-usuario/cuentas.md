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

### 3. Eliminar o desactivar una cuenta
Como usuario quiero quitar de mis listados una cuenta que ya no uso, sin
perder la historia de lo que pasó en ella.

**Criterios de aceptación**
- Regla G5: si la cuenta **no tiene movimientos** (su saldo inicial no
  cuenta), se puede **eliminar** de forma permanente — p. ej. una cuenta
  creada por error.
- Si **tiene movimientos** (gastos, ingresos, abonos o transferencias, como
  origen o destino), el botón es **Desactivar**: la cuenta y su historia se
  conservan, deja de ofrecerse para registrar y de contar en el resumen. Si
  todavía tiene saldo, la confirmación lo avisa.
- Eliminar una cuenta con movimientos se rechaza con un mensaje que guía a
  desactivarla.
- Las cuentas desactivadas aparecen en una sección plegable "Desactivadas" al
  final de la página, desde donde se **activan** de nuevo (o se eliminan, si
  no tienen movimientos).
- Regla G4: sobre una cuenta desactivada no se registran movimientos ni se
  edita; hay que activarla primero.

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

- Los movimientos de una cuenta desactivada siguen en los listados de
  Gastos/Ingresos/Transferencias, pero su origen se muestra como "—".
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
- **2026-10-12 (v2.1.0, en desarrollo)** — Eliminar vs. desactivar (G5): una
  cuenta con movimientos ya no se borra en cascada; se desactiva y se puede
  reactivar. Sobre una desactivada no se registra (G4).
