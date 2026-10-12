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
  `currency` (`CRC`/`USD`), **saldo inicial** (con signo) y su **fecha**.
- `bank_id` (opcional): banco de la tarjeta, usado para identificarla al importar
  compras desde el correo (ver [`bancos.md`](./bancos.md)). `last_four` es lo que
  se casa contra el aviso del banco.
- El saldo inicial se guarda como un movimiento `opening_balance` (C1), igual
  que en cuentas, y aparece en el historial de la tarjeta como "Saldo inicial".
  Cuenta como **cargo en su fecha**: si es anterior al último corte, entra en
  el saldo al corte y el pago de contado. Se edita desde "Editar tarjeta", no
  desde la lista de movimientos.

### 2. Editar, eliminar o desactivar una tarjeta
Como usuario quiero editar los datos de una tarjeta, o quitarla de mis
listados si ya no la uso sin perder su historia.

**Criterios de aceptación**
- Editar permite cambiar cualquier campo y el saldo inicial; el saldo actual
  no se edita a mano.
- Regla G5: una tarjeta **sin movimientos ni financiamientos** (su saldo
  inicial no cuenta) se puede **eliminar**. Si tiene historia, el botón es
  **Desactivar**: se conserva todo, deja de ofrecerse para registrar y de
  contar en el resumen y en los pagos de contado (la confirmación avisa si
  todavía tiene saldo).
- Las tarjetas desactivadas aparecen en "Desactivadas" al final de la página,
  desde donde se activan de nuevo.
- Regla G4: no se registra ni se edita sobre una tarjeta desactivada, y no se
  le asocia un banco desactivado (sí conserva el que ya tenía; se muestra
  como "(desactivado)").

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
- Si la tarjeta tiene movimientos en las dos monedas, hay un estado de cuenta
  **por moneda** (colones y dólares), cada uno con su saldo al corte, pagos,
  falta pagar y consumo sin cortar. El estado de la tarjeta es el más grave de
  los dos (T1).
- También se muestran los datos del plástico: saldo actual por moneda, límite
  (en la moneda del límite), disponible, próximo corte y fecha límite de pago.
- **Disponible** = límite − saldo en la moneda del límite − saldo en la otra
  moneda convertido con el último tipo de cambio de Ajustes (T2). Si hay saldo
  en otra moneda y no hay tipo de cambio, se muestra "—" con un aviso.

### 5. Registrar un pago o abono de tarjeta
Como usuario quiero registrar un pago desde una cuenta de débito hacia una
tarjeta, con el monto que corresponde ya precargado, para no tener que
calcularlo a mano.

**Criterios de aceptación**
- El monto sugerido al abrir el formulario es `dueAmount` (lo que falta pagar
  del corte) si es mayor que cero; si no, el saldo total de la tarjeta.
- El abono baja el saldo de la tarjeta **en la moneda de la cuenta origen**
  (T1/M5): desde una cuenta en dólares se abona el saldo en dólares; no hay
  conversión.
- El pago resta el mismo monto de la cuenta y del saldo de esa moneda.

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
- Eliminar un financiamiento (regla F4) borra solo las cuotas **futuras**
  (fecha posterior a hoy) y el trigger revierte solo ese monto. Las cuotas que
  ya ocurrieron se conservan y el plan queda como "Cancelado el <fecha> · N
  cuota(s) conservada(s)". Si ninguna cuota había ocurrido, el plan se borra
  completo.
- Las cuotas conservadas de un plan cancelado se pueden quitar a mano desde el
  historial de la tarjeta (botón eliminar en la fila).
- No existe edición de un financiamiento (ver *Pendiente*).

## Reglas de negocio

- El estado de cuenta (`cardStatement`) se calcula **solo desde los
  movimientos con fecha**, nunca desde `current_balance` directamente. El
  saldo inicial de la tarjeta es un movimiento "Saldo inicial" con fecha
  (antes se registraba como un `expense` anterior al corte, que sigue
  funcionando), y cada consumo nuevo va con su fecha real.
- Las cuotas de un financiamiento las calcula el dominio
  (`installmentSchedule`) y la base las guarda tal cual
  (`create_financing_v2`), validando cantidad y suma.
- Tarjeta bimoneda (T1): cada cargo, abono y saldo inicial va al saldo de su
  moneda; `credit_cards.currency` es la **moneda del límite**.
- Un cargo con tarjeta se registra en CRC o USD (selector "Moneda del cargo").
- Un financiamiento no tiene interés (tasa 0); préstamos con interés son un
  concepto distinto, todavía no implementado (ver *Pendiente*).

## Pendiente / fuera de alcance

- No hay edición de un financiamiento (solo crear y eliminar/cancelar).
- Préstamos con interés y tabla de amortización — roadmap paso 3, no
  implementado.
- Los saldos en `USD` de las tarjetas no entran en los cálculos de cobertura
  del dashboard (se listan, pero no suman).
- El tipo de cambio es manual; no se consulta el BCCR todavía.

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
- **2026-10-11 (v2.0.0, en desarrollo)** — Saldo inicial como movimiento
  `opening_balance` con fecha (editable desde "Editar tarjeta"); cuotas de
  financiamiento calculadas por el dominio y guardadas con `create_financing_v2`.
- **2026-10-11 (v2.0.0, en desarrollo)** — Eliminar un financiamiento conserva
  las cuotas ya ocurridas (F4, `04_cancel_financing.sql`).
- **2026-10-11 (v2.0.0, en desarrollo)** — Tarjeta bimoneda: saldo y estado de
  cuenta por moneda, límite en su moneda, disponible con tipo de cambio manual,
  saldo inicial en ₡ y $ (`06_multicurrency_cards.sql`).
- **2026-10-12 (v2.1.0, en desarrollo)** — Eliminar vs. desactivar (G5): una
  tarjeta con movimientos o financiamientos ya no se borra en cascada; se
  desactiva y se puede reactivar (G4).
