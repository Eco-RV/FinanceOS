# Gastos

> Ver convención general en [`README.md`](./README.md).

## Resumen

Registro de gastos, ya sea pagados desde una cuenta de débito o cargados a
una tarjeta de crédito. Comparte formulario y lista con Ingresos y con los
pagos de tarjeta (`TransactionForm` / `TransactionList`).

## Historias de usuario

### 1. Registrar un gasto
Como usuario quiero registrar un gasto indicando monto, fecha, categoría,
una nota opcional y si salió de una cuenta o fue un cargo a una tarjeta, para
llevar el detalle de en qué se me va el dinero.

**Criterios de aceptación**
- Campos: `amount` (> 0), `occurred_on` (fecha), `category` (obligatoria para
  gastos), `note` (opcional, hasta 200 caracteres), `origin`
  (`account:<id>` o `card:<id>`).
- La moneda del movimiento se copia automáticamente de la cuenta o tarjeta
  elegida como origen; el usuario no la escribe.
- Al guardar, el saldo de la cuenta (resta) o el saldo de la tarjeta (suma,
  más deuda) se ajusta automáticamente vía trigger — la action no toca el
  saldo directamente.

### 2. Elegir categoría
Como usuario quiero elegir la categoría del gasto entre las que configuré en
Ajustes, para poder clasificar mis gastos a mi manera.

**Criterios de aceptación**
- Si el usuario no tiene categorías propias de tipo `expense` configuradas,
  se le ofrece la lista sugerida (`EXPENSE_CATEGORIES` en `schema.ts`:
  Comida, Transporte, Servicios, Vivienda, Salud, Entretenimiento, Compras,
  Educación, Suscripciones, Otros).
- La categoría viaja como texto libre en el movimiento: renombrar o borrar
  una categoría en Ajustes **no** actualiza los movimientos históricos que ya
  la usaban.

### 3. Editar o eliminar un gasto
Como usuario quiero poder corregir o borrar un gasto que registré mal, para
que el saldo de la cuenta o tarjeta quede correcto.

**Criterios de aceptación**
- Editar o borrar revierte/reaplica el efecto sobre el saldo automáticamente
  (trigger), sin que el usuario tenga que ajustar nada a mano.

### 4. Ver mis gastos
Como usuario quiero ver el listado de todos mis gastos, ordenado por fecha
más reciente primero, con su categoría y origen visibles.

**Criterios de aceptación**
- Si todavía no hay ninguna cuenta ni tarjeta creada, en vez del listado se
  muestra un mensaje guiando a crear una primero (no se puede registrar un
  gasto sin un origen posible).

### 5. Registrar un gasto desde cualquier pantalla
Como usuario quiero poder abrir el formulario de "nuevo gasto" desde
cualquier página de la app (no solo desde Gastos), para registrar algo al
momento sin tener que navegar.

**Criterios de aceptación**
- Existe un botón flotante (FAB) global de "Nuevo gasto" disponible en todo
  el grupo `(app)`.

### 6. Registrar un SINPE
Como usuario quiero registrar un pago por SINPE Móvil indicando a quién se lo
hice y a qué teléfono, para saber después a quién le pagué y en qué.

**Criterios de aceptación**
- Botón "Nuevo SINPE" en Gastos. Es un **gasto** (regla S1): sale de una
  **cuenta de débito** (no de tarjeta), con **categoría obligatoria**.
- Campos extra opcionales: destinatario (hasta 80 caracteres) y teléfono (8
  dígitos; se aceptan espacios, guiones y el prefijo +506, que se quitan).
- En la lista de gastos aparece como "<cuenta> · SINPE a <nombre> · <teléfono>".
- Se edita y elimina como cualquier gasto; el saldo de la cuenta se ajusta igual.

## Reglas de negocio

- Un gasto puede tener como origen una cuenta **o** una tarjeta — no ambas ni
  ninguna.
- `category` es texto libre guardado en el movimiento, no una referencia a
  `categories`.
- Un SINPE es un gasto con `channel = 'sinpe'`; solo desde cuenta (S1).
- Una transferencia entre cuentas propias **no** es gasto y no aparece aquí
  (ver [`transferencias.md`](./transferencias.md)).

## Pendiente / fuera de alcance

- No hay gastos recurrentes/automáticos (fuera de las cuotas que genera un
  financiamiento sobre tarjeta, ver [`tarjetas.md`](./tarjetas.md)).
- No hay adjuntar comprobantes/recibos.


## Historial

- **2026-10-08 (v1.2.3)** — Primera versión de este documento, redactada a
  partir de `src/app/(app)/procesos/gastos/page.tsx` y
  `src/app/(app)/procesos/_transactions/`.
- **2026-10-11 (v2.0.0, en desarrollo)** — SINPE como gasto desde cuenta con
  destinatario y teléfono (`05_transfers_and_sinpe.sql`).
