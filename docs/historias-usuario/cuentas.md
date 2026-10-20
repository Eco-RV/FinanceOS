# Cuentas

> Ver convención general en [`README.md`](./README.md).

## Resumen

Cuentas de débito, ahorro o efectivo. Cada cuenta tiene un saldo que se
mantiene al día automáticamente a partir de los movimientos (gastos, ingresos
y pagos de tarjeta) que se le registran. El saldo no se edita a mano: se
corrige con el saldo inicial (C1) o desde Ajustes → Verificar saldos.

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
- Sus movimientos siguen en los listados de Gastos, Ingresos, Transferencias y
  en el detalle de tarjeta, con el origen como "<nombre> (desactivada)". Esas
  filas no se editan ni se eliminan hasta reactivar la cuenta.

### 4. Ver mis cuentas y mi liquidez total
Como usuario quiero ver todas mis cuentas con su saldo actual y un total en
colones, para tener una vista rápida de mi liquidez.

**Criterios de aceptación**
- Listado ordenado por fecha de creación (la más antigua primero).
- El total mostrado solo suma las cuentas en `CRC`; las cuentas en `USD` se
  listan pero no entran en ese total (ver *Reglas de negocio*).
- En mobile la misma información se ve como tarjetas apiladas en vez de tabla.

### 5. Ver el detalle de una cuenta (2.8.0)
Como usuario quiero tocar una cuenta y ver su saldo, su tarjeta de débito y
todos sus movimientos, para saber qué entró y qué salió de esa cuenta.

**Criterios de aceptación**
- Toda la fila de la lista abre el detalle (`/procesos/cuentas/<id>`); la
  lista muestra la tarjeta de débito bajo el nombre.
- El detalle muestra el saldo, la tarjeta de débito y los movimientos de la
  cuenta (como origen o destino), los más nuevos primero (todos, desde 3.1.0): gastos,
  ingresos, SINPE, transferencias (− si sale, + si entra), abonos a tarjeta
  (con el monto que salió de la cuenta, también si se convirtió) y el saldo
  inicial. Se editan y eliminan como en las demás listas.
- **Filtros y filas por página** (3.1.0): arriba del historial, siempre a la
  vista, **Buscar** (nota, categoría, destinatario o monto, sin importar
  tildes), **Tipo** (Gastos, Ingresos, Transferencias, Pagos de tarjeta,
  Saldo inicial) e **Incluir futuras**. Por defecto se ve solo
  hasta hoy; al marcarlo aparecen también los ingresos programados y todo lo que tiene fecha
  futura (M7). En "Más filtros" están Desde/Hasta. Se muestran 10 filas por página (5, 10, 20, 50 o todas;
  la elección se recuerda en este navegador) con los totales de lo filtrado.

### 6. Tarjeta de débito (2.8.0)
Como usuario quiero agregar la tarjeta de débito de mi cuenta bancaria, para
registrar los gastos que pago con ella.

**Criterios de aceptación**
- Desde el detalle de una cuenta corriente o de ahorro: **Agregar tarjeta de
  débito** con nombre y últimos 4 dígitos (opcionales). Las cuentas de
  efectivo no tienen tarjeta.
- Una cuenta tiene como máximo **una** tarjeta de débito activa (C3).
- Editar nombre y dígitos; **Eliminar** si no tiene gastos, si no
  **Desactivar** (G5); las desactivadas se pueden reactivar.
- Pagar con la tarjeta (gasto rápido → Débito) resta del saldo de su cuenta;
  el movimiento recuerda con qué tarjeta se pagó.

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

- No hay conversión de moneda entre cuentas de distinta divisa.
- Una cuenta tiene a lo sumo una meta de ahorro activa (A1, ver
  [`ahorros.md`](./ahorros.md)).

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
- **2026-10-17 (v2.8.0, en desarrollo)** — Detalle de cuenta con sus
  movimientos y tarjeta de débito por cuenta bancaria (C3).
- **2026-10-14 (v2.5.0, en desarrollo)** — Lista en filas separadas. Las
  cuentas de **efectivo** son el origen de los gastos "Efectivo" del
  formulario rápido; un gasto ya no se registra sobre una cuenta de débito
  (para eso están SINPE y Transferencias). En el Resumen, el disponible en
  débito se llama **Liquidez**.
- **2026-10-18 (v3.1.0, en desarrollo)** — Un gasto que deja la cuenta en
  negativo se permite con aviso (C2). Se corrige el resumen (el saldo ya no se
  edita a mano desde 2.0.0) y el pendiente de metas (existen desde 2.7.0).
- **2026-10-18 (v3.1.0, en desarrollo)** — El detalle de la cuenta trae todos
  los movimientos (antes, 500) con los mismos filtros y paginación que la
  tarjeta.
