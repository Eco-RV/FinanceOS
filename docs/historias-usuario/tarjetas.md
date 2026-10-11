# Tarjetas de crédito

> Ver convención general en [`README.md`](./README.md).

## Resumen

Tarjetas de crédito con su corte, fecha límite de pago, saldo y, sobre cada
una, financiamientos a tasa 0 (compras a cuotas). El módulo calcula un
"estado de cuenta" del corte vigente para saber cuánto hay que pagar de
contado y cuánto es consumo nuevo que entrará al siguiente corte.

## Historias de usuario

### 1. Crear una tarjeta
Como usuario quiero registrar una tarjeta de crédito con nombre, institución,
últimos 4 dígitos, límite, día de corte, día de pago, saldo inicial y moneda,
para llevar su control en la app.

**Criterios de aceptación**
- Campos: `name` (obligatorio), `institution` (opcional), `last_four`
  (opcional, exactamente 4 dígitos), `credit_limit` (opcional, ≥ 0),
  `cutoff_day` y `payment_due_day` (obligatorios, 1-31 cada uno),
  `current_balance`, `currency` (`CRC`/`USD`).
- `bank_id` (opcional): banco de la tarjeta, usado para identificarla al importar
  compras desde el correo (ver [`bancos.md`](./bancos.md)). `last_four` es lo que
  se casa contra el aviso del banco.
- `current_balance` al crear es el saldo de apertura, igual que en cuentas:
  los movimientos posteriores lo ajustan por delta.

### 2. Editar o eliminar una tarjeta
Como usuario quiero editar los datos de una tarjeta o eliminarla si ya no la
uso.

**Criterios de aceptación**
- Editar permite cambiar cualquier campo, incluido el saldo a mano.
- Eliminar es permanente y borra en cascada sus movimientos y sus
  financiamientos (y las cuotas de esos financiamientos).

### 3. Ver el listado de tarjetas con su estado
Como usuario quiero ver todas mis tarjetas con un indicador de estado, el
saldo actual, cuánto falta pagar y la fecha del próximo corte, para saber de
un vistazo cuáles necesitan atención.

**Criterios de aceptación**
- Estado (`CardStatusBadge`) es uno de: `sin-movimientos`, `sin-saldo`,
  `al-dia`, `pendiente`, `atrasada` — calculado por `cardStatement()` sobre
  los movimientos del corte vigente, **no** sobre `current_balance`.
- "Falta pagar" solo se muestra cuando el estado es `pendiente` o `atrasada`;
  en los demás casos se muestra "—".
- Cada tarjeta enlaza a su página de detalle.

### 4. Ver el detalle y estado de cuenta de una tarjeta
Como usuario quiero entrar al detalle de una tarjeta y ver su estado de
cuenta del corte vigente, para saber exactamente cuánto debo pagar de
contado y antes de qué fecha.

**Criterios de aceptación**
- Muestra: saldo al corte (`statementBalance` = cargos − pagos con fecha
  hasta el último corte), pagos aplicados después del corte
  (`paidAfterCutoff`), lo que falta pagar antes del vencimiento (`dueAmount`)
  y el consumo nuevo que todavía no corta (`newCharges`).
- Si la tarjeta está `atrasada`, se muestra una alerta indicando los días de
  atraso, la fecha en que venció y el monto pendiente (y que ya genera
  intereses).
- Si está `al-dia` o `sin-saldo`, se muestra una confirmación en vez de
  alerta.
- También se muestran los datos del plástico: saldo actual total, límite,
  disponible (límite − saldo), próximo corte y fecha límite de pago.

### 5. Registrar un pago o abono de tarjeta
Como usuario quiero registrar un pago desde una cuenta de débito hacia una
tarjeta, con el monto que corresponde ya precargado, para no tener que
calcularlo a mano.

**Criterios de aceptación**
- El monto sugerido al abrir el formulario es `dueAmount` (lo que falta pagar
  del corte) si es mayor que cero; si no, el saldo total de la tarjeta.
- La cuenta de origen y la tarjeta deben estar en la misma moneda — la action
  rechaza el pago si no coinciden (no hay conversión).
- El pago resta el mismo monto de la cuenta y de la tarjeta.

### 6. Crear un financiamiento (compra a cuotas sin interés)
Como usuario quiero registrar una compra a cuotas sobre una tarjeta
(descripción, categoría, monto total, número de cuotas y fecha de la primera
cuota), para que la app genere automáticamente el cronograma de pagos.

**Criterios de aceptación**
- `months` entre 2 y 48. El total se divide en N cuotas iguales, cada una
  como un gasto (`expense`) con fecha mensual desde `first_charge_on`
  (mismo día de cada mes, recortado si el mes es más corto).
- Las cuotas quedan ligadas al financiamiento (`financing_id`,
  `installment_no`, nota "cuota i/N").
- El saldo de la tarjeta sube de inmediato por el total completo (el trigger
  de saldo no espera a que cada cuota "llegue" a su fecha).
- El consumo de cuotas con fecha futura **no** cuenta todavía como "consumo
  sin cortar" en el estado de cuenta — solo entra cuando su fecha ya pasó.

### 7. Ver y eliminar financiamientos activos
Como usuario quiero ver los financiamientos activos de una tarjeta y
eliminar uno completo si ya no aplica.

**Criterios de aceptación**
- Eliminar un financiamiento borra en cascada **todas** sus cuotas, pasadas y
  futuras, y el trigger revierte el saldo completo que ese financiamiento
  había sumado.
- No existe edición ni cancelación parcial (ver *Pendiente*).

## Reglas de negocio

- El estado de cuenta (`cardStatement`) se calcula **solo desde los
  movimientos con fecha**, nunca desde `current_balance` directamente. El
  flujo esperado es: registrar el saldo inicial de la tarjeta como un
  `expense` con fecha **anterior** al corte, y cada consumo nuevo con su
  fecha real.
- Un pago de tarjeta exige la misma moneda entre cuenta origen y tarjeta.
- Un financiamiento no tiene interés (tasa 0); préstamos con interés son un
  concepto distinto, todavía no implementado (ver *Pendiente*).

## Pendiente / fuera de alcance

- No hay edición ni cancelación parcial de un financiamiento (solo
  crear/borrar completo).
- No hay "archivar" tarjeta desde la interfaz, igual que en cuentas.
- Préstamos con interés y tabla de amortización — roadmap paso 3, no
  implementado.
- Tarjetas en `USD` no entran en los cálculos de cobertura del dashboard
  (se listan, pero no suman).

### Propuesta (2.0.0): financiamiento con interés

> Historia redactada para entender el comportamiento antes de implementarlo.
> Reglas en [`../dominio/reglas.md`](../dominio/reglas.md) (F5) y términos en
> [`../dominio/glosario.md`](../dominio/glosario.md).

Como usuario quiero registrar una compra a cuotas **con interés** sobre una
tarjeta, para saber cuánto me cuesta realmente y qué parte de cada cuota es
interés.

**Ejemplo**: compra de ₡600 000 a 12 meses, tasa 24 % anual (2 % mensual),
sistema francés (cuota fija).

- Cuota fija = capital × i / (1 − (1 + i)^−n) = **₡56 735,76**.
- Total pagado ₡680 829,10 → **₡80 829,10 de interés**.

| Cuota | Interés | Abono al capital | Capital restante |
|---|---|---|---|
| 1 | ₡12 000,00 | ₡44 735,76 | ₡555 264,24 |
| 2 | ₡11 105,28 | ₡45 630,47 | ₡509 633,77 |
| 3 | ₡10 192,68 | ₡46 543,08 | ₡463 090,69 |
| … | baja | sube | … |
| 12 | ₡1 112,47 | ₡55 623,29 | ₡0,00 |

**Criterios de aceptación (propuestos)**
- Al crear se piden tarjeta, monto (capital), meses, tasa anual y fecha de
  la primera cuota.
- El **capital** resta al disponible de la tarjeta desde el día 1, igual que
  en tasa 0; a medida que se pagan cuotas, el disponible se libera por el
  abono al capital.
- Cada mes la cuota entra al estado de cuenta como cargo, separando
  **interés** y **abono al capital** (dos líneas o una con desglose), en la
  sección de cuotas de la tarjeta.
- Se ve la tabla completa: cuotas pagadas, pendientes, interés pagado y por
  pagar.
- Eliminar el plan borra solo las cuotas futuras (regla F4).
- Préstamos usan la misma tabla de amortización.
- Cada banco puede tener particularidades (redondeos, cargos extra); antes de
  implementar se valida contra un estado de cuenta real.

## Historial

- **2026-10-08 (v1.2.3)** — Primera versión de este documento, redactada a
  partir de `src/lib/cards.ts`, `src/app/(app)/procesos/tarjetas/` y
  `_financiamientos/`.
- **2026-10-08 (v1.3.0)** — `bank_id` opcional en la tarjeta y `last_four` como llave
  para importar compras desde el correo (ver `bancos.md`).
- **2026-10-11 (v2.0.0, en desarrollo)** — Propuesta de financiamiento con
  interés (historia de ejemplo con tabla de amortización). El glosario y las
  reglas de dominio pasan a `docs/dominio/`; decisiones nuevas que cambian este
  módulo (tarjeta bimoneda con límite en colones, borrar financiamiento solo
  borra cuotas futuras, abonos a cuota y reembolsos de familia) se
  implementarán en 2.0.0.
