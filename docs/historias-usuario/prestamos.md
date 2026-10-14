# Préstamos

> Ver convención general en [`README.md`](./README.md).

## Resumen

Deudas con un banco a **cuota fija** (sistema francés): monto, tasa anual,
plazo en meses y fecha de la primera cuota. La app muestra el calendario de
cuotas con interés y abono al capital, y registra cada cuota como **gasto**
cuando se paga (reglas F5 y L1–L5 de
[`../dominio/reglas.md`](../dominio/reglas.md)).

## Historias de usuario

### 1. Registrar un préstamo
Como usuario quiero registrar un préstamo con sus condiciones, para ver
cuánto pago por mes, cuánto es interés y cuánto me falta.

**Criterios de aceptación**
- Página `/procesos/prestamos` con botón "Nuevo préstamo".
- Campos: nombre, banco (opcional), moneda (CRC/USD), monto (capital > 0),
  tasa anual (0–100 %), meses (1–480), fecha de la primera cuota y cuenta
  desde la que se suele pagar (opcional, misma moneda).
- Mientras se llena, el formulario muestra la cuota fija y el total de
  intereses.
- **Desembolso opcional**: "Depositado en <cuenta>" + fecha registra un
  **ingreso** por el monto del préstamo en esa cuenta (categoría
  "Préstamos"). Con "No registrar" no se toca ningún saldo (útil para un
  préstamo que ya venías pagando).
- El préstamo por sí solo **no** cambia saldos: solo el desembolso y los
  pagos, que son movimientos (G1).

### 2. Ver el calendario y el avance
Como usuario quiero ver la tabla de amortización y en qué cuota voy.

**Criterios de aceptación**
- El listado muestra por préstamo: estado, cuota, próxima cuota (fecha y "en
  N días"), capital pendiente y avance `k/N`.
- El detalle (`/procesos/prestamos/[id]`) muestra cuota fija, capital
  pendiente, próxima cuota, intereses pagados y por pagar, y el costo total.
- La tabla trae por cuota: fecha, cuota, interés, abono al capital y saldo,
  marcando **Pagada el <fecha>**, **Vencida**, **Próxima** o Pendiente.
- Estado (L4): **Atrasado** si hay cuotas con fecha anterior a hoy sin pagar
  (con aviso y el monto vencido), **Al día**, o **Pagado**. El día del
  vencimiento todavía cuenta como al día.

### 3. Pagar una cuota
Como usuario quiero marcar una cuota como pagada, para que baje el saldo de
mi cuenta y avance el préstamo.

**Criterios de aceptación**
- Botón "Pagar cuota N" en el detalle: solo se paga la **próxima** cuota, en
  orden (L2).
- El diálogo muestra cuota, interés y capital; se elige la cuenta (sugiere la
  del préstamo) y la fecha real del pago (default hoy).
- Crea un **gasto** desde esa cuenta por el monto de la cuota, categoría
  "Préstamos", nota "<préstamo> · cuota N/M (interés … · capital …)".
- La cuenta debe estar activa (G4) y en la moneda del préstamo (G3).
- Una cuota no se paga dos veces (L3; lo protege también la base de datos).

### 4. Corregir un pago
Como usuario quiero deshacer un pago que marqué por error.

**Criterios de aceptación**
- "Deshacer cuota N" borra el gasto de la **última** cuota pagada (L5) y el
  saldo de la cuenta vuelve.
- En Gastos e Ingresos los pagos y el desembolso aparecen con "Ver en
  Préstamos" en vez de editar/eliminar (L2): se gestionan solo desde aquí.

### 5. Ver las cuotas en el Resumen
Como usuario quiero ver en el Resumen las cuotas que vienen y saber si mi
débito alcanza para pagarlas junto con las tarjetas.

**Criterios de aceptación**
- "Pagos próximos" del Resumen lista tarjetas y préstamos juntos, del más
  urgente al de más tiempo, con enlace al detalle.
- De cada préstamo entra (L6): si tiene cuotas vencidas, su **total** (aviso
  rojo de atraso, "Cuotas 1–2/12"); si no, la **próxima cuota** cuando vence
  dentro de 31 días. Un préstamo cuya primera cuota está lejos no aparece
  todavía.
- Esas cuotas suman en "A pagar", en el aviso de cobertura de los próximos 10
  días y en la línea "desde aquí los pagos superan tu disponible" (solo CRC,
  como las tarjetas).
- Nueva tarjeta "Capital pendiente en préstamos" (CRC) y el patrimonio neto
  resta ese capital.

### 6. Editar, eliminar o desactivar un préstamo
**Criterios de aceptación**
- Editar cambia nombre, banco y cuenta sugerida. Monto, tasa, plazo y
  fechas **no** se editan: definen el calendario.
- G5: un préstamo **sin cuotas pagadas** se elimina (con su desembolso, si
  lo tenía). Con cuotas pagadas se **desactiva** (p. ej. al liquidarlo) y
  queda en "Desactivados", desde donde se activa de nuevo.
- G4: un préstamo desactivado no se paga ni se edita.

## Reglas de negocio

- El calendario **no se guarda**: se calcula siempre con los términos
  (`loanSchedule` del dominio). Lo guardado son los hechos: desembolso
  (`income` con `loan_id`) y pagos (`expense` con `loan_id` +
  `installment_no`).
- Tasa mensual = anual / 12. Interés de cada cuota = saldo × tasa mensual,
  redondeado a céntimos; la última cuota se ajusta para cerrar en 0.
- Los pagos cuentan como gastos (en Gastos y en los totales), igual que las
  cuotas de un financiamiento.

## Pendiente / fuera de alcance

- Abonos extraordinarios al capital (recalcular plazo o cuota).
- Tasa variable, seguros o comisiones dentro de la cuota; cada banco puede
  tener particularidades: conviene comparar el calendario con el del banco.
- Las cuotas en dólares se listan en el Resumen pero no suman en la
  cobertura (igual que las tarjetas en USD).
- (Hecho en 2.3.0) El financiamiento con interés sobre una tarjeta usa la
  misma tabla de amortización: ver [`financiamientos.md`](./financiamientos.md).

## Historial

- **2026-10-12 (v2.1.0, en desarrollo)** — Primera versión: préstamos con
  calendario francés, pago de cuotas en orden, desembolso opcional
  (`supabase/Versionamiento/2.1.0/01_loans.sql`).
- **2026-10-12 (v2.1.0)** — Las cuotas a cobro entran al Resumen y a la
  cobertura del débito (L6); el patrimonio neto resta el capital pendiente.
