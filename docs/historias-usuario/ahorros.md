# Ahorros y metas

> Ver convención general en [`README.md`](./README.md).

## Resumen

Metas de ahorro con objetivo, avance y aportes (paso 4 del roadmap). Cada meta
se liga a una cuenta: lo ahorrado es su saldo y aportar es transferirle.
Desde 2.7.0, en **Procesos → Ahorros y metas**.

## Historias de usuario

### 1. Crear una meta
**Criterios de aceptación**
- Nombre, ícono (del kit de la app), objetivo y moneda, fecha opcional
  (futura) y cuenta ligada (se sugieren primero las de ahorro, de la misma
  moneda; una cuenta solo puede tener una meta activa, A1).

### 2. Ver mi avance
**Criterios de aceptación**
- Cada meta muestra lo ahorrado (saldo de la cuenta), el objetivo, el % con
  barra, lo que falta y, si tiene fecha, cuánto aportar al mes para llegar.
- Estado: **En camino**, **¡Lograda!**, **Se pasó la fecha** o **Sin fecha**.
- Arriba, el total ahorrado en colones contra la suma de objetivos.
- En el Resumen, la card **Metas de ahorro** muestra las tres primeras.

### 3. Aportar
**Criterios de aceptación**
- **Aportar** registra una **transferencia** desde otra cuenta de la misma
  moneda hacia la cuenta de la meta, con el aporte mensual sugerido ya
  escrito. No cuenta como gasto. Aparece en Transferencias.
- Los tres aportes más recientes se ven en la meta.

### 4. Archivar o eliminar
**Criterios de aceptación**
- **Archivar** saca la meta de la lista (se puede recuperar). **Eliminar** la
  borra. Ninguno toca la cuenta ni sus movimientos.

### 5. Varias metas en una misma cuenta (3.0.1)
Como usuario quiero tener varias metas en mi cuenta de ahorro (viaje, carro,
emergencias) y decidir cuánto va a cada una.

**Criterios de aceptación**
- Al crear o editar una meta se puede elegir una cuenta que ya tiene otra meta.
- Con una sola meta, lo ahorrado sigue siendo el saldo de la cuenta. Con
  varias, cada meta muestra lo que se le **apartó** y la cuenta indica cuánto
  queda **libre** (A4).
- **Apartar**: el monto para esa meta, sin pasar lo libre + lo que ya tenía.
- El Resumen usa la misma regla para el avance de las metas.

## Reglas de negocio

- A1–A3 en [`docs/dominio/reglas.md`](../dominio/reglas.md).
- El Arranque de 0 conserva las metas.

## Pendiente / fuera de alcance

- Varias metas en una misma cuenta (apartados).
- Aportes automáticos (un plan de "ahorro" mensual).
- Metas en dólares en el total del Resumen.

## Historial

- **2026-10-14 (v2.7.0)** — Archivo nuevo.
- **2026-10-19 (v3.0.1, en desarrollo)** — Varias metas por cuenta con
  apartados (A4; SQL `3.0.1/08_goal_allocations.sql`).
