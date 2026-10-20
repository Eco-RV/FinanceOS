# Planes recurrentes

> Ver convención general en [`README.md`](./README.md).

## Resumen

Salario, gastos fijos (renta, agua, luz, internet, suscripciones…) y seguros
de tarjeta: movimientos que se repiten y se
registran solos cuando llega su fecha. Incluye la **línea base** (gastos fijos
contra el salario, P4). Desde 2.7.0, en **Procesos → Planes**.

## Historias de usuario

### 1. Registrar mi salario
Como usuario quiero indicar cuánto y cada cuánto me pagan, para que el ingreso
entre solo a mi cuenta.

**Criterios de aceptación**
- Nombre, monto y moneda, frecuencia (semanal, bisemanal, quincenal = 15 y
  último día, mensual), primer pago, fecha final opcional, cuenta de débito
  destino (de la misma moneda), categoría de ingreso (por defecto "Salario") y
  nota.
- Cada fecha que llega se registra como **ingreso** en la cuenta (al abrir la
  app). Las que vienen se ven como programadas.
- Un salario con primer pago en el pasado no registra hacia atrás: empieza
  desde el día en que se crea (P6).

### 2. Registrar gastos fijos y seguros
Como usuario quiero registrar lo que pago cada mes (renta, agua, luz,
internet, suscripciones), para que se cargue solo y cuente en mi línea base.

**Criterios de aceptación**
- **Gasto fijo** (P2, antes "Suscripción"): mensual, con una tarjeta de
  crédito, con una **tarjeta de débito** (2.8.0: el cargo sale de su cuenta)
  o desde una cuenta. La categoría se sugiere por el nombre
  (Alquiler → Vivienda; Agua, Luz, Internet → Servicios; Netflix →
  Suscripciones) y se puede cambiar. Si el monto varía (luz, agua), se edita
  el movimiento cuando llega.
- **Seguro de tarjeta** (T9): mensual, a una **tarjeta de crédito** o a una
  **tarjeta de débito** (3.0.1: p. ej. el seguro que el banco cobra por la
  tarjeta de débito; el cargo sale del saldo de su cuenta). Puede haber varios
  por tarjeta; categoría por defecto "Seguros". No se cobra desde la cuenta
  sola.
- Se repiten el mismo día del primer cargo cada mes (recortado en meses
  cortos) y se registran como **gasto** cuando llega su fecha.

### 3. Pausar, editar o eliminar un plan
**Criterios de aceptación**
- **Editar** cambia lo que viene, no lo ya registrado (el tipo no se cambia).
- **Pausar** deja de registrar; al **reanudar** sigue desde ese día, sin lo
  que se pausó.
- **Eliminar** (P3): no quedan cargos ni ingresos futuros; lo ya registrado se
  conserva como movimiento normal.
- Un movimiento registrado por un plan se edita o elimina como cualquier otro
  (no se vuelve a generar).

### 4. Ver mi línea base
Como usuario quiero saber qué parte de mi salario se va en gastos fijos, para
controlar mi liquidez.

**Criterios de aceptación**
- Salario al mes (equivalente mensual de cada frecuencia), gastos fijos al mes
  y el porcentaje del salario, con barra y marca del **tope** (default 35 %,
  editable en la misma pantalla y guardado en las preferencias).
- Gastos fijos: gastos fijos del plan, seguros, cuota de préstamos y cuota de
  financiamientos activos, cada uno con su % del salario; total por semana,
  quincena y mes.
- Si se pasa el tope, aviso en rojo (P4, advierte). Solo colones.

### 5. Ver lo programado
**Criterios de aceptación**
- **Próximos 30 días** en Planes; en el Resumen, la card **Línea base** muestra
  el % y lo próximo de 15 días.

### 6. Monto variable (3.0.1)
Como usuario quiero registrar un salario (o la luz, el agua) que cambia cada
vez, para no tener que editar el movimiento a mano.

**Criterios de aceptación**
- En el formulario del plan (salario o gasto fijo) → **El monto varía**. El
  monto del plan pasa a ser un estimado.
- Cuando llega la fecha, el movimiento entra con el estimado y aparece en
  Planes → **Por confirmar** (arriba), ya lleno con el estimado. Pones el real
  y **Confirmar**: el saldo se ajusta (P7).
- El Resumen lo recuerda en "Recordatorios" mientras quede algo por confirmar.

### 7. Recordatorios (3.0.1)
Como usuario quiero ver en el Resumen lo que viene pronto, para no olvidar
nada.

**Criterios de aceptación**
- Card **Recordatorios** en el Resumen (P8): montos por confirmar, avisos de
  cobro por enviar, pagos mínimos sin cubrir que vencen en 3 días o menos, y
  salarios o cobros de planes de los próximos 3 días. Cada fila lleva a donde
  se resuelve.
- Es solo dentro de la app: no se envían correos ni notificaciones solas.

## Reglas de negocio

- P1–P6 y T9 en [`docs/dominio/reglas.md`](../dominio/reglas.md).
- Lo programado no cuenta en los saldos de hoy (M7): el trigger de saldos no
  sabe de fechas, por eso las ocurrencias se registran al llegar su día.
- El **Arranque de 0** conserva los planes; sigue registrando desde el día
  del arranque.

## Pendiente / fuera de alcance

- Recordatorio antes de un cargo.
- Línea base en dólares.

## Historial

- **2026-10-17 (v2.8.0, en desarrollo)** — Un gasto fijo se puede pagar con
  tarjeta de débito.
- **2026-10-14 (v2.7.0)** — Archivo nuevo: salario,
  gastos fijos (renta, servicios, suscripciones), seguros de tarjeta, línea
  base y programados.
- **2026-10-18 (v3.0.1, en desarrollo)** — Un seguro también se cobra a una
  tarjeta de débito (T9; SQL `3.0.1/02_insurance_debit_card.sql`).
- **2026-10-19 (v3.0.1, en desarrollo)** — Monto variable con confirmación
  (P7; SQL `3.0.1/07_variable_plans.sql`) y recordatorios en el Resumen (P8).
