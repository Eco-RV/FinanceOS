# Reglas de negocio (invariantes)

> **Rechaza**: el sistema no permite la operación. **Advierte**: la permite,
> pero lo avisa. Ver términos en [`glosario.md`](./glosario.md).

## Generales

| # | Regla | Tipo | Estado |
|---|---|---|---|
| G1 | Los movimientos son la fuente de verdad. Todo saldo se deriva de ellos; un saldo guardado es una copia que debe coincidir (Ajustes → Verificar saldos). | — | Decidido · Implementado 2.0.0 |
| G2 | Todo monto es mayor que 0; el sentido (entra/sale) lo da el tipo de movimiento. | Rechaza | Propuesta |
| G3 | No se suman ni comparan montos de distinta moneda sin tipo de cambio explícito. | Rechaza | Decidido |
| G4 | No se registra nada sobre algo desactivado (cuenta, tarjeta, categoría, banco): ni movimientos, ni edición, ni asociar una tarjeta a un banco desactivado. Al editar un movimiento se puede conservar la categoría que ya tenía aunque esté desactivada. | Rechaza | Decidido · Implementado 2.1.0 |
| G5 | Lo que tiene historia se **desactiva** (se conserva y se puede reactivar); lo que no tiene, se puede **eliminar**. Historia: cuenta = movimientos como origen o destino; tarjeta = movimientos y financiamientos; categoría = movimientos de su tipo con ese nombre; banco = avisos importados. El saldo inicial (C1) no cuenta como historia. | Rechaza eliminar si tiene historia | Decidido 2026-10-12 · Implementado 2.1.0 |
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
| M2 | Una transferencia es entre dos cuentas propias **distintas** y de la **misma moneda**, y no cuenta como gasto ni como ingreso. | Rechaza si origen = destino o monedas distintas | Decidido · Implementado 2.0.0 |
| S1 | Un SINPE es un gasto desde una cuenta de débito (no tarjeta), con categoría; destinatario y teléfono (8 dígitos) opcionales. | Rechaza | Decidido · Implementado 2.0.0 |
| M3 | Un abono sale siempre de una cuenta de débito hacia una tarjeta de crédito. | Rechaza | Decidido |
| M4 | Un abono puede superar la deuda. | Advierte | Decidido |
| M5 | Un abono afecta el saldo de la tarjeta **en la moneda de la cuenta origen** (no hay conversión en un abono). | — | Decidido · Implementado 2.0.0 |
| M6 | Un ingreso puede tener fecha futura. | — | Decidido |
| M7 | Un movimiento con fecha futura es **programado**: no cuenta en saldos "de hoy" ni en el pago de contado hasta que llega su fecha. Sí cuenta en el disponible de la tarjeta si es cuota de un financiamiento. | — | Propuesta (amplía la regla actual de cuotas) |
| M8 | El Arranque de 0 pide confirmación escrita (`ARRANCAR`) y un saldo inicial nuevo (puede ser 0) por cada cuenta y tarjeta activa (tarjetas: CRC y USD). De forma atómica: borra las cuotas pendientes (fecha > hoy) de los financiamientos, **archiva** todos los movimientos (no visibles), elimina financiamientos y préstamos (sus cuotas cobradas quedan archivadas) y crea los saldos iniciales nuevos, que son lo único visible. | Rechaza sin confirmación o sin saldos | Decidido 2026-10-12 · Implementado 2.2.0 |

## Tarjetas de crédito

| # | Regla | Tipo | Estado |
|---|---|---|---|
| T1 | La tarjeta lleva saldos y estados de cuenta separados por moneda (CRC y USD); el estado de la tarjeta es el más grave. | — | Decidido · Implementado 2.0.0 |
| T2 | El límite está en la moneda del límite de la tarjeta (normalmente colones). Disponible = límite − (saldo CRC + saldo USD convertido con el último tipo de cambio manual). El capital de financiamientos ya está dentro del saldo. Sin tipo de cambio y con saldo en otra moneda, el disponible no se calcula. | — | Decidido · Implementado 2.0.0 |
| T3 | Saldo al corte (por moneda) = cargos − abonos con fecha ≤ último corte. Pago de contado = saldo al corte − abonos posteriores al corte (mínimo 0). | — | Decidido |
| T4 | Los cargos posteriores al corte entran al siguiente estado de cuenta. | — | Decidido |
| T5 | Si el día de corte o de pago no existe en el mes, se usa el último día del mes. | — | Decidido |
| T6 | Si el día de pago es ≤ al día de corte, la fecha límite cae el mes siguiente. | — | Decidido |
| T7 | Estado: sin movimientos → sin saldo → al día → atrasada (vencida con saldo pendiente) → pendiente. | — | Decidido |
| T8 | El pago mínimo lo digita el usuario desde el estado de cuenta; el sistema no lo calcula. | — | Propuesta |
| T9 | Un seguro genera un gasto mensual en la tarjeta de crédito; una tarjeta puede tener varios. | — | Decidido · Implementado 2.7.0 |

## Financiamientos, préstamos y familia

| # | Regla | Tipo | Estado |
|---|---|---|---|
| F1 | Al crear un financiamiento se eligen tarjeta, monto, tasa (0 = sin interés), de 2 a 72 meses y fecha de primera cuota; el **capital** resta al disponible desde el día 1 (en tasa 0, el total). El interés de cada cuota cuenta solo cuando llega su fecha. | Rechaza (fuera de rango) | Decidido · Cambiado 2.3.0 (72 meses, solo capital) |
| F2 | Las cuotas caen el mismo día cada mes (ajustado al último día en meses cortos). | — | Decidido |
| F3 | Las cuotas se consultan en una sección propia de la tarjeta, separadas de los gastos. | — | Decidido |
| F4 | Al eliminar un financiamiento se borran solo sus cuotas **futuras**; las ya ocurridas y los abonos ya hechos quedan y se quitan a mano. | — | Decidido · Implementado 2.0.0 (fecha ≤ hoy se conserva) |
| F5 | Financiamiento con interés y préstamo usan la misma **tabla de amortización** (sistema francés: cuota fija; tasa mensual = anual / 12, de 0 a 100 %; interés redondeado a céntimos por cuota; la última cuota cierra en 0). | — | Decidido · Implementado 2.1.0 en préstamos y 2.3.0 en financiamientos |
| L1 | Un préstamo tiene capital > 0, tasa anual de 0 a 100 % y de 1 a 480 meses, en una sola moneda. Su calendario se deriva de esos términos (no se guarda) y los términos no se editan. | Rechaza | Decidido · Implementado 2.1.0 |
| L2 | Las cuotas se pagan **en orden**. Pagar crea un gasto desde una cuenta de débito activa en la moneda del préstamo, por el monto de la cuota, con la fecha real del pago. Pagos y desembolso se gestionan solo desde Préstamos. | Rechaza | Decidido · Implementado 2.1.0 |
| L3 | Una cuota se paga una sola vez; un préstamo pagado no admite más pagos. | Rechaza | Decidido · Implementado 2.1.0 |
| L4 | Un préstamo está **atrasado** si tiene cuotas con fecha anterior a hoy sin pagar. | Advierte | Decidido · Implementado 2.1.0 |
| L5 | Solo se deshace el pago de la **última** cuota pagada. | Rechaza | Decidido · Implementado 2.1.0 |
| L6 | **Cuota a cobro** de un préstamo: con cuotas vencidas, su total; si no, la próxima cuota cuando vence dentro de 31 días. Entra en "pagos próximos" y en la cobertura del débito junto a las tarjetas (solo CRC suma). El capital pendiente resta del patrimonio neto. | — | Decidido · Implementado 2.1.0 |
| F6 | Las partes de una cuota entre miembros suman exactamente la cuota: cada miembro tiene un **monto fijo por cuota** y la parte del usuario es el resto. La suma de los miembros no pasa la cuota más baja del plan; un miembro aparece una sola vez y con monto > 0. | Rechaza | Decidido · Implementado 2.3.0 |
| F7 | Un reembolso de miembro no toca la tarjeta ni las cuentas. Se registra una sola vez por parte (miembro × cuota), por el monto de su parte; no se quita del reparto a quien ya tiene reembolsos en el plan. | Rechaza (duplicado) | Decidido · Implementado 2.3.0 |
| F8 | El aviso de cuota es informativo: se envía a cada miembro con su parte y las quincenas (1, 2 o 3) que faltan para la fecha límite de pago del estado de cuenta en que cae la cuota; las partes de un miembro con la misma fecha van en un solo aviso. Se avisa una vez por quincena (3, 2, 1 y al vencer), a mano, por WhatsApp (mensaje listo) o correo (Gmail del usuario). Un miembro necesita correo o WhatsApp. | Rechaza (sin medio) | Decidido · Implementado 2.3.0 |
| F9 | De un financiamiento solo se editan descripción y categoría (también en sus cuotas); los términos (monto, tasa, meses, fecha) no se editan. | — | Decidido 2026-10-14 · Implementado 2.3.0 |

## Planes y presupuesto

| # | Regla | Tipo | Estado |
|---|---|---|---|
| P1 | Un salario siempre tiene una cuenta de débito destino (de su moneda) y una periodicidad: semanal, bisemanal (cada 14 días), quincenal (15 y último día) o mensual. | Rechaza | Decidido · Implementado 2.7.0 |
| P2 | Un gasto fijo (renta, servicios, suscripciones…) es mensual y se paga con una tarjeta de crédito **o** desde una cuenta de débito (de su moneda), no ambas. Sin categoría, se sugiere por el nombre (Alquiler → Vivienda, Luz → Servicios, Netflix → Suscripciones). | Rechaza | Decidido · Implementado 2.7.0 |
| P3 | Al eliminar un plan (salario, suscripción, seguro) no quedan movimientos futuros; los ocurridos quedan (sin plan). Pausar deja de registrar; al reanudar sigue desde ese día, sin lo pausado. | — | Decidido · Implementado 2.7.0 |
| P4 | Si los gastos fijos de la línea base superan el tope (default 35 % del salario, configurable entre 1 y 100 %), se advierte. Línea base = salarios vs. gastos fijos, seguros, cuota de préstamos y cuota de financiamientos, en colones y por mes. | Advierte | Decidido · Implementado 2.7.0 |
| P5 | Un plan tiene monto mayor que 0; la fecha final, si la hay, no es anterior al inicio. | Rechaza | Decidido · Implementado 2.7.0 |
| P6 | Cada ocurrencia de un plan se registra como movimiento cuando llega su fecha (M7: lo programado no cuenta en los saldos de hoy); las futuras solo se calculan. Un plan nuevo registra desde el día en que se crea, nunca hacia atrás (esa plata ya está en los saldos); nunca se registra dos veces la misma fecha. | — | Decidido · Implementado 2.7.0 |

## Ahorros y metas (2.7.0)

| # | Regla | Tipo | Estado |
|---|---|---|---|
| S1 | Una meta se liga a lo sumo a una cuenta activa de su misma moneda, y una cuenta tiene como máximo una meta activa. Lo ahorrado es el saldo de esa cuenta; los aportes son transferencias hacia ella (M2). | Rechaza | Decidido · Implementado 2.7.0 |
| S2 | Una meta tiene nombre y objetivo mayor que 0; la fecha, opcional, es futura al crearla. | Rechaza | Decidido · Implementado 2.7.0 |
| S3 | Avance = ahorrado / objetivo (lo ahorrado no baja de 0). Con fecha: aporte mensual sugerido = lo que falta / meses que faltan; si la fecha pasó sin llegar, la meta está atrasada. Archivar o eliminar una meta no toca la cuenta. | — | Decidido · Implementado 2.7.0 |

## Importación

| # | Regla | Tipo | Estado |
|---|---|---|---|
| I1 | Solo se leen correos de remitentes de bancos activos. | — | Decidido |
| I2 | Sincronizar es siempre manual. | — | Decidido |
| I3 | Un aviso se importa una sola vez (idempotente). | — | Decidido |
| I4 | Un pendiente no toca saldos hasta aprobarse. | — | Decidido |
| I5 | Un pendiente se aprueba contra cualquier tarjeta (bimoneda, T1) y va al saldo de su moneda; se rechaza una moneda no soportada. | Rechaza | Decidido · Cambiado 2.0.0 |

## Cuenta del usuario (2.6.0)

| # | Regla | Tipo | Estado |
|---|---|---|---|
| U1 | El usuario (@) es opcional; si se pone, lleva de 3 a 30 caracteres (letras minúsculas, números, punto o guion bajo, sin empezar ni terminar en signo) y es único entre todos los usuarios sin importar mayúsculas. | Rechaza | Decidido · Implementado 2.6.0 |
| U2 | El nombre es opcional, hasta 80 caracteres. | Rechaza | Decidido · Implementado 2.6.0 |
| U3 | El país es opcional, un código ISO de dos letras. | Rechaza | Decidido · Implementado 2.6.0 |
| U4 | Contraseña de 8 caracteres o más, con letras y números. Para cambiarla se pide la actual; sin la actual solo desde el enlace de recuperación (sesión de recuperación de hace menos de una hora). | Rechaza | Decidido · Implementado 2.6.0 |
| U5 | El correo nuevo es válido y distinto del actual; el cambio se completa desde el enlace que llega al correo nuevo. Hasta entonces se sigue entrando con el actual. | Rechaza | Decidido · Implementado 2.6.0 |
| U6 | La foto de perfil es JPG, PNG o WebP de hasta 2 MB (la app la recorta a 512 px). | Rechaza | Decidido · Implementado 2.6.0 |
| U7 | Una cuenta nueva se confirma por correo antes de poder entrar. Los enlaces del correo vuelven a la misma app desde donde se pidió (producción o local). | — | Decidido · Implementado 2.6.0 |
