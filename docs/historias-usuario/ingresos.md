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
- Igual que en gastos, la categoría es texto libre: renombrar/borrar una
  categoría en Ajustes no toca los ingresos ya registrados.

### 3. Editar o eliminar un ingreso
Como usuario quiero corregir o borrar un ingreso mal registrado, para que el
saldo de la cuenta quede correcto sin tener que ajustarlo a mano.

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

- No hay ingresos recurrentes/programados.
- No hay proyección de ingresos futuros en el dashboard (a diferencia de las
  cuotas de financiamiento, que sí se proyectan).

## Historial

- **2026-10-08 (v1.2.3)** — Primera versión de este documento, redactada a
  partir de `src/app/(app)/procesos/ingresos/page.tsx` y
  `src/app/(app)/procesos/_transactions/`.
