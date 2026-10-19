# Ingresos

> Ver convención general en [`README.md`](./README.md).

## Resumen

Registro de depósitos y entradas de dinero hacia una cuenta de débito,
ahorro o efectivo. Comparte formulario y lista con Gastos
(`TransactionForm` / `TransactionList`).

## Historias de usuario

### 1. Registrar un ingreso
Como usuario quiero registrar un ingreso indicando monto, fecha, categoría y
una nota opcional, y a cuál cuenta entra, para llevar el detalle de mis
entradas de dinero.

**Criterios de aceptación**
- Campos: `amount` (> 0), `occurred_on` (fecha), `category` (obligatoria),
  `note` (opcional), `origin` (debe ser `account:<id>`).
- La moneda del movimiento se copia de la cuenta elegida.
- Al guardar, el saldo de la cuenta sube automáticamente vía trigger.

### 2. Elegir categoría
Como usuario quiero elegir la categoría del ingreso entre las que configuré
en Ajustes, para clasificar de dónde viene el dinero.

**Criterios de aceptación**
- Si no hay categorías propias de tipo `income`, se ofrece la lista sugerida
  (`INCOME_CATEGORIES`: Salario, Freelance, Reembolso, Intereses, Regalo,
  Otros).
- Igual que en gastos, la categoría es texto libre: renombrar una categoría
  en Ajustes no toca los ingresos ya registrados. Una categoría con ingresos
  se desactiva en vez de eliminarse (G5) y no se usa en ingresos nuevos (G4).

### 3. Editar o eliminar un ingreso
Como usuario quiero corregir o borrar un ingreso mal registrado, para que el
saldo de la cuenta quede correcto sin tener que ajustarlo a mano.

**Criterios de aceptación**
- En la lista, el lápiz abre el mismo formulario con los datos del ingreso;
  al guardar, el trigger ajusta el saldo de la cuenta (la anterior y la nueva
  si cambió).
- Eliminar pide confirmación y revierte el saldo.
- Un ingreso sobre una cuenta desactivada no se edita ni se elimina (G4).
- El desembolso de un préstamo y el ingreso de un cobro compartido se
  gestionan desde su módulo (Préstamos y Gastos compartidos).

### 4. Ver mis ingresos
Como usuario quiero ver el listado de todos mis ingresos, ordenado por
fecha más reciente primero.

**Criterios de aceptación**
- Si no hay ninguna cuenta creada todavía, se muestra un mensaje guiando a
  crear una primero, en vez del formulario y la lista.

## Reglas de negocio

- Un ingreso **siempre** entra a una cuenta — a diferencia de un gasto, no
  puede tener una tarjeta como destino (lo valida `transactionSchema` con
  `superRefine`: si `type === "income"` el origen debe ser `account:*`).

## Pendiente / fuera de alcance

- Los ingresos recurrentes son salarios de Planes (ver
  [`planes.md`](./planes.md)).
- No hay proyección de ingresos futuros en el dashboard (a diferencia de las
  cuotas de financiamiento, que sí se proyectan).

## Historial

- **2026-10-08 (v1.2.3)** — Primera versión de este documento, redactada a
  partir de `src/app/(app)/procesos/ingresos/page.tsx` y
  `src/app/(app)/procesos/_transactions/`.
- **2026-10-12 (v2.1.0, en desarrollo)** — Categorías desactivables (G4/G5),
  igual que en gastos.
- **2026-10-14 (v2.5.0, en desarrollo)** — La categoría se elige en una
  cuadrícula con íconos; la lista va en filas separadas.
- **2026-10-18 (v3.0.1, en desarrollo)** — Botón flotante "Nuevo ingreso"
  (flecha hacia abajo, verde) en todas las páginas. Criterios de la historia 3
  y pendiente de ingresos recurrentes corregido (existen salarios desde 2.7.0).
