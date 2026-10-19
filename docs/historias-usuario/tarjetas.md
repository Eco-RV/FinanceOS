# Tarjetas de crédito

> Ver convención general en [`README.md`](./README.md).

## Resumen

Tarjetas de crédito con su corte, fecha límite de pago, saldo y, sobre cada
una, financiamientos (compras a cuotas con o sin interés, ver
[`financiamientos.md`](./financiamientos.md)). El módulo calcula un
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
- Sus cargos siguen en el listado de Gastos con el origen como
  "<nombre> (desactivada)" y sin editar/eliminar hasta reactivarla.

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
- **Abono anticipado** (2.8.0): lo pagado después del corte por encima de lo
  que faltaba del corte (o un saldo a favor al corte) se descuenta del
  consumo sin cortar; la card lo indica ("ya descuenta ₡X de abono
  anticipado"). Gastar ₡20 000 y abonar ₡20 000 el mismo día deja la tarjeta
  igual.
- **Día de corte al siguiente corte** (2.8.0): si la tarjeta tiene marcada la
  opción "Las compras del día de corte pasan al siguiente corte" (en su
  formulario), lo comprado el mismo día del corte no entra al pago de
  contado: queda como consumo sin cortar. Es como corta BAC (por fecha de
  proceso). El próximo corte lo recuerda en su pista. Vale para **todo cargo**:
  compras, cuotas de financiamiento y seguros (también en la fecha límite de
  cada cuota, 3.0.1).
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
- El historial **Movimientos** trae todos los movimientos de la tarjeta (sin el
  tope de 1000 filas). El estado de cuenta se calcula siempre con todos; los
  filtros solo cambian lo que se ve.
- **Filtros y filas por página** (3.0.1): arriba del historial, siempre a la
  vista, **Buscar** (nota, categoría, destinatario o monto, sin importar
  tildes), **Tipo** (Cargos, Cuotas, Pagos, Saldo inicial) e **Incluir futuras**. Por defecto se ve solo
  hasta hoy; al marcarlo aparecen también las cuotas programadas de los financiamientos y todo lo que tiene fecha
  futura (M7). En "Más filtros" están Desde/Hasta y Moneda (si la tarjeta
  tiene movimientos en las dos). Se muestran 10 filas por página (5, 10, 20, 50 o todas;
  la elección se recuerda en este navegador) con los totales de lo filtrado.

### 5. Registrar un pago o abono de tarjeta
Como usuario quiero registrar un pago desde una cuenta de débito hacia una
tarjeta, con el monto que corresponde ya precargado, para no tener que
calcularlo a mano.

**Criterios de aceptación**
- El monto sugerido al abrir el formulario es `dueAmount` (lo que falta pagar
  del corte) si es mayor que cero; si no, el saldo total de la tarjeta.
- Se elige qué **saldo de la tarjeta** se abona: colones o dólares (por
  defecto, la moneda de la cuenta). El monto va en esa moneda y "Usar saldo
  total" precarga lo de esa moneda.
- Misma moneda: el pago resta el mismo monto de la cuenta y de la tarjeta.
- **Otra moneda** (M5, 2.8.0): p. ej. una suscripción cobrada en dólares que
  se paga desde una cuenta en colones. El formulario muestra cuánto sale de la
  cuenta con el **último tipo de cambio** (Ajustes → Tipo de cambio); el monto
  convertido y el tipo de cambio quedan guardados en el movimiento. Sin tipo
  de cambio no deja guardar. Al editar, se convierte con el último tipo de
  cambio.
- M4 (3.0.1): si el abono supera la deuda de esa moneda, el formulario avisa
  el saldo a favor que quedará y deja registrarlo igual.

### 6. Financiamientos
Las compras a cuotas (tasa 0 o con interés), su reparto entre miembros de la
familia y los avisos de cuota viven en
[`financiamientos.md`](./financiamientos.md). En la tarjeta se ven en la
sección "Financiamientos" y cada cuota aparece en el historial como "Cuota".

## Reglas de negocio

- El estado de cuenta (`cardStatement`) se calcula **solo desde los
  movimientos con fecha**, nunca desde `current_balance` directamente. El
  saldo inicial de la tarjeta es un movimiento "Saldo inicial" con fecha
  (antes se registraba como un `expense` anterior al corte, que sigue
  funcionando), y cada consumo nuevo va con su fecha real.
- Las cuotas de un financiamiento las calcula el dominio
  (`financingSchedule`) y la base las guarda tal cual
  (`create_financing_v3`); ver [`financiamientos.md`](./financiamientos.md).
- El saldo actual y el disponible no cuentan el interés de cuotas de
  financiamiento que todavía no llegan (solo el capital cuenta desde el día 1).
- Tarjeta bimoneda (T1): cada cargo, abono y saldo inicial va al saldo de su
  moneda; `credit_cards.currency` es la **moneda del límite**.
- Un cargo con tarjeta se registra en CRC o USD (selector "Moneda del cargo").
- Los préstamos bancarios son un módulo aparte ([`prestamos.md`](./prestamos.md)).

## Pendiente / fuera de alcance

- (Resuelto en 3.0.1) Los saldos en USD ya suman en la cobertura convertidos
  (G7), y el tipo de cambio se trae del BCCR (T10).

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
- **2026-10-14 (v2.3.0, en desarrollo)** — Los financiamientos pasan a
  [`financiamientos.md`](./financiamientos.md) (con interés, edición, miembros
  y avisos); la propuesta de financiamiento con interés se implementó allí. El
  saldo y el disponible descuentan el interés de cuotas futuras.
- **2026-10-17 (v2.8.0, en desarrollo)** — Opción por tarjeta para que las
  compras del día de corte pasen al siguiente corte (BAC), abono anticipado
  sobre el consumo sin cortar, abono en otra moneda con tipo de cambio (M5) y
  lectura completa de los movimientos (antes se cortaba en 1000).
- **2026-10-14 (v2.5.0, en desarrollo)** — La lista de tarjetas pasa a filas
  separadas (como en móvil) y **toda la fila abre el detalle**, salvo los
  botones de editar y desactivar. El detalle muestra arriba la tarjeta
  dibujada (mismo degradado que en el gasto) con animación de entrada. El
  Resumen suma el disponible de todas las
  tarjetas con semáforo (ver [`resumen.md`](./resumen.md)).
- **2026-10-18 (v3.0.1, en desarrollo)** — Historial de la tarjeta con
  filtros (buscar, tipo, fechas, moneda), "Incluir futuras" para ver las
  cuotas programadas y filas por página (5/10/20/50/todas). Aviso M4 al abonar
  más que la deuda.
