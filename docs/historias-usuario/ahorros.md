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
  moneda; una cuenta solo puede tener una meta activa, S1).

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

## Reglas de negocio

- S1–S3 en [`docs/dominio/reglas.md`](../dominio/reglas.md).
- El Arranque de 0 conserva las metas.

## Pendiente / fuera de alcance

- Varias metas en una misma cuenta (apartados).
- Aportes automáticos (un plan de "ahorro" mensual).
- Metas en dólares en el total del Resumen.

## Historial

- **2026-10-14 (v2.7.0)** — Archivo nuevo.
