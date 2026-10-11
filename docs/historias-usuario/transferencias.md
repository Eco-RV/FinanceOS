# Transferencias

> Ver convención general en [`README.md`](./README.md).

## Resumen

Movimiento de dinero **entre cuentas propias** (p. ej. BAC → BN). No es gasto
ni ingreso: baja una cuenta y sube la otra por el mismo monto, sin tocar los
totales de gastos (regla M2 de [`../dominio/reglas.md`](../dominio/reglas.md)).

## Historias de usuario

### 1. Registrar una transferencia
Como usuario quiero pasar dinero de una de mis cuentas a otra, para que los
saldos reflejen dónde está mi plata sin que cuente como un gasto.

**Criterios de aceptación**
- Página `/procesos/transferencias` con botón "Nueva transferencia".
- Campos: cuenta **desde**, cuenta **hacia**, monto (> 0), fecha y nota
  opcional. Sin categoría.
- Origen y destino deben ser cuentas **distintas** y de la **misma moneda**
  (no hay conversión: comprar dólares no se registra como transferencia).
- Al guardar, el origen baja y el destino sube por el mismo monto (trigger de
  saldos); no aparece en Gastos ni en Ingresos.
- Se necesitan al menos dos cuentas para registrar una.

### 2. Consultar, editar y eliminar transferencias
Como usuario quiero ver mis transferencias y corregirlas o eliminarlas.

**Criterios de aceptación**
- La lista muestra fecha, "Desde → Hacia", nota y monto.
- Editar permite cambiar cuentas, monto, fecha y nota; eliminar revierte
  ambos saldos.

## Reglas de negocio

- M2: entre dos cuentas propias distintas, misma moneda; no es gasto ni ingreso.
- Se guarda como un movimiento `type = 'transfer'` con `account_id` (origen) y
  `to_account_id` (destino).

## Pendiente / fuera de alcance

- Transferencias entre monedas (compra/venta de dólares) — decidido que no se
  permiten por ahora.
- Transferencias a terceros: se registran como gasto (p. ej. SINPE, ver
  [`gastos.md`](./gastos.md)).

## Historial

- **2026-10-11 (v2.0.0, en desarrollo)** — Primera versión
  (`05_transfers_and_sinpe.sql`).
