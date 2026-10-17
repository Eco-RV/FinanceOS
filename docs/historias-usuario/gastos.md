# Gastos

> Ver convención general en [`README.md`](./README.md).

## Resumen

Registro de gastos: cargos a una tarjeta de crédito, pagos en efectivo y
pagos por SINPE desde una cuenta de débito. Desde 2.5.0 el gasto con tarjeta
o en efectivo usa un formulario rápido propio (`ExpenseForm`); SINPE,
ingresos y pagos de tarjeta siguen con `TransactionForm`. La lista es
compartida (`TransactionList`).

## Historias de usuario

### 1. Registrar un gasto
Como usuario quiero registrar un gasto rápido —monto, categoría y cómo lo
pagué— para llevar el detalle de en qué se me va el dinero sin perder tiempo
en el día a día.

**Criterios de aceptación**
- El formulario va en este orden (2.5.0):
  1. **Monto** (> 0) en un solo campo grande, con un botón de moneda que
     alterna **CRC / USD**. Se aceptan coma o punto como decimal.
  2. **Categoría** (obligatoria): cuadrícula de botones con el ícono de cada
     categoría, cómoda para el dedo.
  3. **Cómo pagaste** (2.8.0: **Crédito · Débito · SINPE · Efectivo**; por
     defecto Crédito):
     - Crédito: carrusel tipo billetera (Android/iPhone) con las tarjetas
       activas dibujadas como tarjetas. Siempre empieza en la **primera**
       (a la izquierda). Se cambia con las **flechas** ‹ ›, tocando una
       tarjeta, con la rueda del ratón o deslizando con el dedo; la elegida
       queda al centro. No se arrastra con el cursor. El cargo va en la moneda
       elegida (bimoneda, T1).
     - Débito (2.8.0): las tarjetas de débito activas cuya cuenta es de la
       moneda elegida, con el nombre de la cuenta y su saldo. El gasto sale
       de esa cuenta y recuerda la tarjeta. Si no hay, se invita a agregarla
       en su cuenta.
     - SINPE (2.8.0): las cuentas bancarias (corriente o ahorro) de la moneda
       elegida, más destinatario y teléfono opcionales (historia 6).
     - Efectivo: las cuentas de tipo **Efectivo** de la moneda elegida (si hay
       una sola, queda elegida). Si no hay, se invita a crearla en Cuentas.
  4. **Más opciones** (botón +): despliega **fecha** (por defecto hoy) y
     **nota** opcional (hasta 200 caracteres).
- Un gasto desde una cuenta bancaria va por **Débito** o **SINPE**. Al editar
  un gasto viejo hecho desde una cuenta, esa cuenta se sigue ofreciendo.
- En débito, SINPE y efectivo la moneda del movimiento la manda la cuenta.
- Al guardar aparece al centro una confirmación animada "Gasto registrado"
  con el monto (no tapa el botón flotante).
- Al guardar, el saldo de la cuenta (resta) o el saldo de la tarjeta (suma,
  más deuda) se ajusta automáticamente vía trigger — la action no toca el
  saldo directamente.

### 2. Elegir categoría
Como usuario quiero elegir la categoría del gasto entre las que configuré en
Ajustes, con su ícono, para poder clasificar mis gastos a mi manera y
reconocerlas de un vistazo.

**Criterios de aceptación**
- Cada categoría tiene un ícono del kit de la app (2.5.0, ver Ajustes →
  Categorías). Sin ícono guardado se usa uno sugerido por el nombre.
- Si el usuario no tiene categorías propias de tipo `expense` configuradas,
  se le ofrece la lista sugerida (`EXPENSE_CATEGORIES` en `schema.ts`:
  Comida, Transporte, Servicios, Vivienda, Salud, Entretenimiento, Compras,
  Educación, Suscripciones, Otros).
- La categoría viaja como texto libre en el movimiento: renombrar una
  categoría en Ajustes **no** actualiza los movimientos históricos que ya la
  usaban.
- Regla G5: una categoría que ya usa algún gasto no se elimina, se
  **desactiva** (deja de ofrecerse). Regla G4: un gasto nuevo no puede usar
  una categoría desactivada; al editar un gasto viejo se puede conservar la
  que ya tenía. Las desactivadas se reactivan desde Ajustes → Categorías.
  "Cargar categorías sugeridas" no revive las desactivadas.

### 3. Editar o eliminar un gasto
Como usuario quiero poder corregir o borrar un gasto que registré mal, para
que el saldo de la cuenta o tarjeta quede correcto.

**Criterios de aceptación**
- Editar o borrar revierte/reaplica el efecto sobre el saldo automáticamente
  (trigger), sin que el usuario tenga que ajustar nada a mano.

### 4. Ver mis gastos
Como usuario quiero ver el listado de mis gastos, ordenado por fecha más
reciente primero, con su categoría y origen visibles, y poder filtrarlo.

**Criterios de aceptación**
- Filtros (2.5.0): texto (nota, categoría, destinatario), desde / hasta,
  categoría y origen (cada tarjeta, cada cuenta o "Solo SINPE"); botón
  "Limpiar".
- Las cuotas de financiamientos con fecha futura **no** se muestran por
  defecto; "Ver cuotas programadas" las incluye.
- Se ve cuántos gastos coinciden y su total por moneda.
- Filas por página: 5, 10, 20, 50 o todas, con paginación.
- Se puede llegar ya filtrado por la URL (`?desde=`, `?hasta=`,
  `?categoria=`), como desde el gráfico del Resumen.
- Cada gasto es una fila separada (card) con el ícono de su categoría.
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
- Pestaña **SINPE** del gasto rápido (botón + en cualquier pantalla); el
  botón "Nuevo SINPE" de Gastos abre ese mismo formulario ya en SINPE
  (2.8.0). Es un **gasto** (regla S1): sale de una **cuenta bancaria** (no de
  tarjeta ni de efectivo), con **categoría obligatoria**.
- Campos extra opcionales: destinatario (hasta 80 caracteres) y teléfono (8
  dígitos; se aceptan espacios, guiones y el prefijo +506, que se quitan).
- En la lista de gastos aparece como "<cuenta> · SINPE a <nombre> · <teléfono>".
- Se edita y elimina como cualquier gasto; el saldo de la cuenta se ajusta igual.

### 7. Ver todos los financiamientos
Como usuario quiero, desde Gastos, ir a una pantalla con todos mis
financiamientos activos de todas las tarjetas.

**Criterios de aceptación**
- Botón "Financiamientos" a la izquierda de "Nuevo SINPE" (2.5.0) →
  `/procesos/financiamientos`: cantidad, próximas cuotas y cuotas por
  cobrar; cada fila abre el detalle del financiamiento.

## Reglas de negocio

- Un gasto puede tener como origen una cuenta **o** una tarjeta — no ambas ni
  ninguna. Desde 2.5.0 el formulario rápido solo ofrece tarjetas y cuentas de
  efectivo (la regla de datos no cambia).
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
- **2026-10-12 (v2.1.0, en desarrollo)** — Categorías: eliminar solo si
  ningún gasto la usa, si no se desactiva (G5); no se registra con una
  desactivada (G4).
- **2026-10-17 (v2.8.0, en desarrollo)** — El gasto rápido suma **Débito**
  (tarjeta de débito de una cuenta) y **SINPE**; "Nuevo SINPE" usa el mismo
  formulario.
- **2026-10-14 (v2.5.0, en desarrollo)** — Formulario rápido de gasto (monto
  con moneda, categorías con ícono, Tarjeta en carrusel o Efectivo, "Más
  opciones" para fecha y nota) y confirmación animada al centro. Ya no se
  registra un gasto sobre una cuenta de débito. Lista con filtros y filas
  por página; botón y pantalla de Financiamientos.
