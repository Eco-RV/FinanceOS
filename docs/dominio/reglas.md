# Reglas de negocio (invariantes)

> **Rechaza**: el sistema no permite la operación. **Advierte**: la permite,
> pero lo avisa. Ver términos en [`glosario.md`](./glosario.md).

## Generales

| # | Regla | Tipo | Estado |
|---|---|---|---|
| G1 | Los movimientos son la fuente de verdad. Todo saldo se deriva de ellos; un saldo guardado es una copia que debe coincidir (Ajustes → Verificar saldos). | — | Decidido · Implementado 2.0.0 |
| G2 | Todo monto es mayor que 0; el sentido (entra/sale) lo da el tipo de movimiento. | Rechaza | Propuesta |
| G3 | No se suman ni comparan montos de distinta moneda sin tipo de cambio explícito. | Rechaza | Decidido |
| G4 | No se registra nada sobre algo desactivado (cuenta, tarjeta, categoría, banco). | Rechaza | Decidido |
| G5 | Lo que tiene movimientos se **desactiva**; lo que no tiene, se puede **eliminar**. | Rechaza eliminar si tiene historia | Propuesta |
| G6 | "Hoy" es el día calendario en Costa Rica, no el del servidor. | — | Decidido |

## Cuentas

| # | Regla | Tipo | Estado |
|---|---|---|---|
| C1 | Cada cuenta y tarjeta arranca con un **saldo inicial** oficial, que es un movimiento visible (`opening_balance`, monto con signo ≠ 0, máximo uno activo por cuenta/tarjeta). | Rechaza 0 o duplicado | Decidido · Implementado 2.0.0 |
| C2 | Un gasto puede dejar una cuenta en negativo. | Advierte | Decidido |
| C3 | Una cuenta bancaria de débito tiene como máximo **una** tarjeta de débito. | Rechaza | Decidido |
| C4 | Una cuenta tiene una sola moneda. | — | Decidido |

## Movimientos

| # | Regla | Tipo | Estado |
|---|---|---|---|
| M1 | Gasto, SINPE e ingreso exigen categoría del tipo correcto. | Rechaza | Decidido |
| M2 | Una transferencia es entre dos cuentas propias **distintas**, y no cuenta como gasto ni como ingreso. | Rechaza si origen = destino | Decidido |
| M3 | Un abono sale siempre de una cuenta de débito hacia una tarjeta de crédito. | Rechaza | Decidido |
| M4 | Un abono puede superar la deuda. | Advierte | Decidido |
| M5 | Un abono afecta el saldo de la tarjeta **en la moneda de la cuenta origen**; cuenta y saldo de la tarjeta deben coincidir en moneda (no hay conversión en un abono). | Rechaza | Decidido |
| M6 | Un ingreso puede tener fecha futura. | — | Decidido |
| M7 | Un movimiento con fecha futura es **programado**: no cuenta en saldos "de hoy" ni en el pago de contado hasta que llega su fecha. Sí cuenta en el disponible de la tarjeta si es cuota de un financiamiento. | — | Propuesta (amplía la regla actual de cuotas) |
| M8 | El Arranque de 0 pide confirmación explícita, archiva todos los movimientos y exige un saldo inicial nuevo por cuenta y tarjeta. | Rechaza sin confirmación | Decidido (qué conserva) · Propuesta (archivar) |

## Tarjetas de crédito

| # | Regla | Tipo | Estado |
|---|---|---|---|
| T1 | La tarjeta lleva saldos separados por moneda (CRC y USD). | — | Decidido |
| T2 | El límite está en colones. Disponible = límite − (saldo real CRC + saldo real USD × tipo de cambio + capital pendiente de financiamientos). | — | Decidido |
| T3 | Saldo al corte (por moneda) = cargos − abonos con fecha ≤ último corte. Pago de contado = saldo al corte − abonos posteriores al corte (mínimo 0). | — | Decidido |
| T4 | Los cargos posteriores al corte entran al siguiente estado de cuenta. | — | Decidido |
| T5 | Si el día de corte o de pago no existe en el mes, se usa el último día del mes. | — | Decidido |
| T6 | Si el día de pago es ≤ al día de corte, la fecha límite cae el mes siguiente. | — | Decidido |
| T7 | Estado: sin movimientos → sin saldo → al día → atrasada (vencida con saldo pendiente) → pendiente. | — | Decidido |
| T8 | El pago mínimo lo digita el usuario desde el estado de cuenta; el sistema no lo calcula. | — | Propuesta |
| T9 | Un seguro genera un gasto mensual en la tarjeta. | — | Decidido |

## Financiamientos, préstamos y familia

| # | Regla | Tipo | Estado |
|---|---|---|---|
| F1 | Al crear un financiamiento se eligen tarjeta, monto, meses y fecha de primera cuota; el monto total resta al disponible desde el día 1. | — | Decidido |
| F2 | Las cuotas caen el mismo día cada mes (ajustado al último día en meses cortos). | — | Decidido |
| F3 | Las cuotas se consultan en una sección propia de la tarjeta, separadas de los gastos. | — | Decidido |
| F4 | Al eliminar un financiamiento se borran solo sus cuotas **futuras**; las ya ocurridas y los abonos ya hechos quedan y se quitan a mano. | — | Decidido (cambia el comportamiento actual, que borra todo) |
| F5 | Financiamiento con interés y préstamo usan la misma **tabla de amortización** (sistema francés: cuota fija). | — | Propuesta |
| F6 | Las partes de una cuota entre miembros suman exactamente la cuota. | Rechaza | Propuesta |
| F7 | Un reembolso de miembro no toca la tarjeta ni las cuentas. | — | Decidido |
| F8 | El aviso de cuota es informativo: se envía a cada miembro con su parte y las quincenas (1, 2 o 3) que faltan para la fecha límite. | — | Decidido |

## Planes y presupuesto

| # | Regla | Tipo | Estado |
|---|---|---|---|
| P1 | Un salario siempre tiene una cuenta de débito destino y una periodicidad. | Rechaza | Decidido |
| P2 | Una suscripción siempre tiene una tarjeta (crédito o débito). | Rechaza | Decidido |
| P3 | Al eliminar un plan (salario, suscripción, seguro) se borran sus movimientos futuros; los ocurridos quedan. | — | Decidido |
| P4 | Si los gastos fijos de la línea base superan el tope (default 35 % del salario), se advierte. | Advierte | Decidido |

## Importación

| # | Regla | Tipo | Estado |
|---|---|---|---|
| I1 | Solo se leen correos de remitentes de bancos activos. | — | Decidido |
| I2 | Sincronizar es siempre manual. | — | Decidido |
| I3 | Un aviso se importa una sola vez (idempotente). | — | Decidido |
| I4 | Un pendiente no toca saldos hasta aprobarse. | — | Decidido |
| I5 | Un pendiente solo se aprueba contra una tarjeta de su misma moneda. | Rechaza | Decidido |
