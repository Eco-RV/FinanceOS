# Reglas de negocio (invariantes)

> **Rechaza**: el sistema no permite la operación. **Advierte**: la permite,
> pero lo avisa. Ver términos en [`glosario.md`](./glosario.md).

## Generales

| # | Regla | Tipo | Estado |
|---|---|---|---|
| G1 | Los movimientos son la fuente de verdad. Todo saldo se deriva de ellos; un saldo guardado es una copia que debe coincidir (Ajustes → Verificar saldos). | — | Decidido · Implementado 2.0.0 |
| G2 | Todo monto es mayor que 0; el sentido (entra/sale) lo da el tipo de movimiento. | Rechaza | Decidido · Implementado 2.0.0 |
| G3 | No se suman ni comparan montos de distinta moneda sin tipo de cambio explícito. | Rechaza | Decidido |
| G4 | No se registra nada sobre algo desactivado (cuenta, tarjeta, categoría, banco): ni movimientos, ni edición, ni asociar una tarjeta a un banco desactivado. Al editar un movimiento se puede conservar la categoría que ya tenía aunque esté desactivada. | Rechaza | Decidido · Implementado 2.1.0 |
| G5 | Lo que tiene historia se **desactiva** (se conserva y se puede reactivar); lo que no tiene, se puede **eliminar**. Historia: cuenta = movimientos como origen o destino; tarjeta = movimientos y financiamientos; categoría = movimientos de su tipo con ese nombre; banco = avisos importados. El saldo inicial (C1) no cuenta como historia. | Rechaza eliminar si tiene historia | Decidido 2026-10-12 · Implementado 2.1.0 |
| G8 | Un movimiento puede tener un **comprobante** adjunto (JPG, PNG, WebP o PDF de hasta 5 MB), privado del usuario. Adjuntarlo, reemplazarlo o quitarlo no cambia el movimiento. | Rechaza (tipo o tamaño) | Decidido 2026-10-19 · Implementado 3.0.1 |
| G6 | "Hoy" es el día calendario en Costa Rica, no el del servidor. | — | Decidido |
| G7 | Los totales del Resumen (débito disponible, pagos de contado, faltante, consumo sin cortar, patrimonio) están en colones: lo de dólares se convierte con el **último** tipo de cambio. Sin tipo de cambio, lo de dólares se lista pero no suma (y se indica). | — | Decidido 2026-10-18 · Implementado 3.0.1 |

## Cuentas

| # | Regla | Tipo | Estado |
|---|---|---|---|
| C1 | Cada cuenta y tarjeta arranca con un **saldo inicial** oficial, que es un movimiento visible (`opening_balance`, monto con signo ≠ 0, máximo uno activo por cuenta/tarjeta). | Rechaza 0 o duplicado | Decidido · Implementado 2.0.0 |
| C2 | Un gasto puede dejar una cuenta en negativo; el formulario avisa cuánto quedará. | Advierte | Decidido · Implementado 3.0.1 |
| C3 | Una cuenta bancaria (corriente o ahorro, no efectivo) tiene como máximo **una** tarjeta de débito activa. La tarjeta no tiene saldo propio: un gasto con ella sale de su cuenta y recuerda la tarjeta. Un gasto fijo (P2) también se puede pagar con ella. | Rechaza | Decidido · Implementado 2.8.0 |
| C4 | Una cuenta tiene una sola moneda. | — | Decidido |

## Movimientos

| # | Regla | Tipo | Estado |
|---|---|---|---|
| M1 | Gasto, SINPE e ingreso exigen categoría del tipo correcto. | Rechaza | Decidido |
| M2 | Una transferencia es entre dos cuentas propias **distintas** y de la **misma moneda**, y no cuenta como gasto ni como ingreso. | Rechaza si origen = destino o monedas distintas | Decidido · Implementado 2.0.0 |
| S1 | Un SINPE es un gasto desde una cuenta de débito (no tarjeta), con categoría; destinatario y teléfono (8 dígitos) opcionales. | Rechaza | Decidido · Implementado 2.0.0 |
| M3 | Un abono sale siempre de una cuenta de débito hacia una tarjeta de crédito. | Rechaza | Decidido |
| M4 | Un abono puede superar la deuda; el formulario avisa el saldo a favor que quedará. | Advierte | Decidido · Implementado 3.0.1 |
| M5 | Un abono baja el saldo de la tarjeta en la moneda que se elige (por defecto la de la cuenta). Si la cuenta es de otra moneda, sale de ella el equivalente con el **último tipo de cambio** digitado, que queda guardado en el movimiento; sin tipo de cambio se rechaza. | Rechaza (sin tipo de cambio) | Decidido · Cambiado 2.8.0 (antes: sin conversión) |
| M6 | Un ingreso puede tener fecha futura. | — | Decidido |
| M7 | Un movimiento con fecha futura es **programado**: no cuenta en saldos "de hoy" ni en el pago de contado hasta que llega su fecha. Sí cuenta en el disponible de la tarjeta si es cuota de un financiamiento. | — | Decidido · Implementado 2.0.0 (cuotas) y 2.7.0 (planes) |
| M9 | Lo archivado por un Arranque de 0 se puede **consultar** (Ajustes → Arranque de 0 → Ver lo archivado), pero no se restaura ni se edita: restaurarlo duplicaría los saldos frente a los saldos iniciales nuevos. | — | Decidido 2026-10-18 · Implementado 3.0.1 |
| M8 | El Arranque de 0 pide confirmación escrita (`ARRANCAR`) y un saldo inicial nuevo (puede ser 0) por cada cuenta y tarjeta activa (tarjetas: CRC y USD). De forma atómica: borra las cuotas pendientes (fecha > hoy) de los financiamientos, **archiva** todos los movimientos (no visibles), elimina financiamientos y préstamos (sus cuotas cobradas quedan archivadas) y crea los saldos iniciales nuevos, que son lo único visible. | Rechaza sin confirmación o sin saldos | Decidido 2026-10-12 · Implementado 2.2.0 |

## Tarjetas de crédito

| # | Regla | Tipo | Estado |
|---|---|---|---|
| T1 | La tarjeta lleva saldos y estados de cuenta separados por moneda (CRC y USD); el estado de la tarjeta es el más grave. | — | Decidido · Implementado 2.0.0 |
| T2 | El límite está en la moneda del límite de la tarjeta (normalmente colones). Disponible = límite − (saldo CRC + saldo USD convertido con el último tipo de cambio manual). El capital de financiamientos ya está dentro del saldo. Sin tipo de cambio y con saldo en otra moneda, el disponible no se calcula. | — | Decidido · Implementado 2.0.0 |
| T3 | Saldo al corte (por moneda) = cargos − abonos con fecha ≤ último corte. Pago de contado = saldo al corte − abonos posteriores al corte (mínimo 0). Si la tarjeta tiene la opción "las compras del día de corte pasan al siguiente corte" (bancos que cortan por fecha de proceso, como BAC), cuenta solo lo anterior al día de corte (vale para todo cargo: compras, cuotas de financiamiento y seguros; desde 3.0.1 también en la fecha límite de cada cuota). Lo abonado de más (por encima del pago de contado, o un saldo a favor al corte) se descuenta del consumo sin cortar (abono anticipado). | — | Decidido · Cambiado 2.8.0 (opción de corte y abono anticipado) |
| T4 | Los cargos posteriores al corte entran al siguiente estado de cuenta. | — | Decidido |
| T5 | Si el día de corte o de pago no existe en el mes, se usa el último día del mes. | — | Decidido |
| T6 | Si el día de pago es ≤ al día de corte, la fecha límite cae el mes siguiente. | — | Decidido |
| T7 | Estado: sin movimientos → sin saldo → al día → atrasada (vencida con saldo pendiente) → pendiente. | — | Decidido |
| T8 | El pago mínimo lo digita el usuario desde el estado de cuenta (por corte y moneda; ≥ 0 y no mayor que el saldo al corte); el sistema no lo calcula. Con lo abonado después del corte, la app dice cuánto falta para cubrirlo antes de la fecha límite. | Rechaza (fuera de rango) | Decidido · Implementado 3.0.1 |
| T10 | El tipo de cambio de referencia es la **venta del BCCR**, que la app trae una vez al día (API pública de Hacienda) al abrir el Resumen, o a mano con "Traer del BCCR". El usuario lo puede digitar igual (T2); el más reciente manda. Si la fuente no responde, se sigue con el último. | — | Decidido 2026-10-18 · Implementado 3.0.1 |
| T9 | Un seguro genera un gasto mensual en una tarjeta de crédito o en una tarjeta de débito (sale de su cuenta, C3); una tarjeta puede tener varios. No se cobra desde la cuenta sola. | Rechaza | Decidido · Implementado 2.7.0 · Cambiado 3.0.1 (débito) |

## Financiamientos, préstamos y familia

| # | Regla | Tipo | Estado |
|---|---|---|---|
| F1 | Al crear un financiamiento se eligen tarjeta, monto, tasa (0 = sin interés), de 2 a 72 meses y fecha de primera cuota; el **capital** resta al disponible desde el día 1 (en tasa 0, el total). El interés de cada cuota cuenta solo cuando llega su fecha. | Rechaza (fuera de rango) | Decidido · Cambiado 2.3.0 (72 meses, solo capital) |
| F10 | La moneda del financiamiento se elige al crearlo (CRC o USD, por defecto la del límite). Sus cuotas van al saldo de esa moneda de la tarjeta (T1) y cuentan en el disponible convertidas con el último tipo de cambio (T2). | Rechaza (moneda no soportada) | Decidido 2026-10-18 · Implementado 3.0.1 |
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
| L7 | **Abono extraordinario** a un préstamo: después de la última cuota pagada, mayor que 0 y no mayor que el capital que falta. Sale de una cuenta activa de la moneda del préstamo como un gasto "Préstamos" (con el préstamo, sin número de cuota). En cada abono se elige si **baja el plazo** (misma cuota, menos cuotas) o **baja la cuota** (mismo plazo). El calendario se recalcula por tramos. Solo se deshace el último ajuste y si no hay cuotas pagadas después; una cuota no se deshace si hay un abono después de ella. | Rechaza | Decidido 2026-10-18 · Implementado 3.0.1 |
| L8 | **Tasa variable**: la nueva tasa anual (0–100 %) rige desde una cuota que todavía no se pagó; se mantiene el plazo que queda y se recalcula la cuota. | Rechaza | Decidido 2026-10-18 · Implementado 3.0.1 |
| F11 | **Abono extraordinario** a un financiamiento (con o sin interés): mayor que 0 y no mayor que el capital de las cuotas programadas. Sale de una cuenta de la moneda del plan como un gasto (la plata que iba a salir en cuotas) y las cuotas programadas se reemplazan por un plan con menos capital: baja el plazo o baja la cuota, a elección. Así la deuda de la tarjeta baja una sola vez. Se deshace el último abono mientras no haya llegado ninguna cuota del plan nuevo. | Rechaza | Decidido 2026-10-18 · Implementado 3.0.1 |
| F6 | Las partes de una cuota entre miembros suman exactamente la cuota: cada miembro tiene un **monto fijo por cuota** y la parte del usuario es el resto. La suma de los miembros no pasa la cuota más baja del plan; un miembro aparece una sola vez y con monto > 0. | Rechaza | Decidido · Implementado 2.3.0 |
| F7 | Un reembolso de miembro no toca la tarjeta ni las cuentas. Se registra una sola vez por parte (miembro × cuota), por el monto de su parte; no se quita del reparto a quien ya tiene reembolsos en el plan. | Rechaza (duplicado) | Decidido · Implementado 2.3.0 |
| F8 | El aviso de cuota es informativo: se envía a cada miembro con su parte y las quincenas (1, 2 o 3) que faltan para la fecha límite de pago del estado de cuenta en que cae la cuota; las partes de un miembro con la misma fecha van en un solo aviso. Se avisa una vez por quincena (3, 2, 1 y al vencer), a mano, por WhatsApp (mensaje listo) o correo (Gmail del usuario). Un miembro necesita correo o WhatsApp. | Rechaza (sin medio) | Decidido · Implementado 2.3.0 |
| F9 | De un financiamiento solo se editan descripción y categoría (también en sus cuotas); los términos (monto, tasa, meses, fecha) no se editan. | — | Decidido 2026-10-14 · Implementado 2.3.0 |

## Gastos compartidos (3.0.1)

| # | Regla | Tipo | Estado |
|---|---|---|---|
| X1 | Un gasto compartido es un gasto (`expense`) normal, nuevo o ya registrado, desde una tarjeta de crédito, una cuenta, una tarjeta de débito o por SINPE. El usuario lo paga completo y afecta los saldos por el total. Se comparte una sola vez. Las cuotas de financiamiento y los pagos de préstamo no se comparten aquí (se reparten en su módulo). | Rechaza | Decidido 2026-10-18 · Implementado 3.0.1 |
| X2 | Cada persona (un miembro activo, G4) aparece una vez, con una parte mayor que 0 en la moneda del gasto. La suma de las partes no pasa el total y la parte del usuario es el resto. Se sugieren partes iguales (céntimos sobrantes en la parte del usuario o, si no participa, en la de la última persona) y cada monto se puede ajustar. | Rechaza | Decidido 2026-10-18 · Implementado 3.0.1 |
| X3 | Fecha límite de cobro: con tarjeta de crédito, la fecha de pago del estado de cuenta en que cae el cargo (respeta T3). Con otro origen, la elige el usuario (por defecto 15 días después) y no es anterior al gasto. Se guarda con el gasto. | Rechaza | Decidido 2026-10-18 · Implementado 3.0.1 |
| X4 | Una parte se marca pagada **una vez** (fecha, medio SINPE/efectivo/transferencia/otro y nota). Si se elige, se registra además un ingreso por esa parte en una cuenta activa de la **misma moneda** (G3). Sin ingreso, es solo control y no toca saldos. Deshacer el pago borra ese ingreso. | Rechaza | Decidido 2026-10-18 · Implementado 3.0.1 |
| X5 | El aviso funciona como F8 (WhatsApp o correo, a mano, una vez por tramo), pero se puede avisar **desde el día del gasto**. Más de 3 quincenas es un tramo propio (4). Las partes de una persona con la misma fecha límite y moneda van en un solo aviso. | — | Decidido 2026-10-18 · Implementado 3.0.1 |
| X6 | No se cambia ni se quita la parte de quien ya pagó. No se deja de compartir un gasto que tiene pagos. Un gasto compartido no cambia monto, moneda ni origen, y no se elimina desde Gastos. El ingreso de un cobro no se edita ni se elimina desde Ingresos. El Arranque de 0 borra los compartidos y conserva los miembros. | Rechaza | Decidido 2026-10-18 · Implementado 3.0.1 |

## Planes y presupuesto

| # | Regla | Tipo | Estado |
|---|---|---|---|
| P1 | Un salario siempre tiene una cuenta de débito destino (de su moneda) y una periodicidad: semanal, bisemanal (cada 14 días), quincenal (15 y último día) o mensual. | Rechaza | Decidido · Implementado 2.7.0 |
| P2 | Un gasto fijo (renta, servicios, suscripciones…) es mensual y se paga con una tarjeta de crédito **o** desde una cuenta de débito (de su moneda), no ambas. Sin categoría, se sugiere por el nombre (Alquiler → Vivienda, Luz → Servicios, Netflix → Suscripciones). | Rechaza | Decidido · Implementado 2.7.0 |
| P3 | Al eliminar un plan (salario, suscripción, seguro) no quedan movimientos futuros; los ocurridos quedan (sin plan). Pausar deja de registrar; al reanudar sigue desde ese día, sin lo pausado. | — | Decidido · Implementado 2.7.0 |
| P4 | Si los gastos fijos de la línea base superan el tope (default 35 % del salario, configurable entre 1 y 100 %), se advierte. Línea base = salarios vs. gastos fijos, seguros, cuota de préstamos y cuota de financiamientos, en colones y por mes. | Advierte | Decidido · Implementado 2.7.0 |
| P5 | Un plan tiene monto mayor que 0; la fecha final, si la hay, no es anterior al inicio. | Rechaza | Decidido · Implementado 2.7.0 |
| P7 | Un plan (salario o gasto fijo, no seguro) puede tener **monto variable**: cada ocurrencia se registra con el monto estimado del plan, marcada "por confirmar", y el usuario pone el real (mayor que 0); el saldo se ajusta. | Rechaza (monto ≤ 0) | Decidido 2026-10-18 · Implementado 3.0.1 |
| P8 | **Recordatorios dentro de la app**: el Resumen muestra lo que viene en los próximos 3 días (cobros y salarios de planes, pagos mínimos sin cubrir) y lo pendiente (montos por confirmar, avisos de cobro por enviar). No se envía nada solo (I2, F8). | — | Decidido 2026-10-18 · Implementado 3.0.1 |
| P6 | Cada ocurrencia de un plan se registra como movimiento cuando llega su fecha (M7: lo programado no cuenta en los saldos de hoy); las futuras solo se calculan. Un plan nuevo registra desde el día en que se crea, nunca hacia atrás (esa plata ya está en los saldos); nunca se registra dos veces la misma fecha. | — | Decidido · Implementado 2.7.0 |

## Ahorros y metas (2.7.0)

Hasta 3.0.0 se llamaban S1–S3 (chocaban con S1 = SINPE); desde 3.0.1 son A1–A3.

| # | Regla | Tipo | Estado |
|---|---|---|---|
| A1 | Una meta se liga a lo sumo a una cuenta activa de su misma moneda. Con una sola meta en la cuenta, lo ahorrado es el saldo de esa cuenta; los aportes son transferencias hacia ella (M2). Desde 3.0.1 una cuenta puede tener varias metas (A4). | Rechaza | Decidido · Implementado 2.7.0 · Cambiado 3.0.1 |
| A4 | Con **varias metas en una cuenta**, cada una cuenta lo que se le **aparta** del saldo (≥ 0); la suma de los apartados no puede pasar el saldo al apartar. Lo no apartado queda libre. Si el saldo baja por debajo de lo apartado, se advierte. | Rechaza (al apartar) / Advierte | Decidido 2026-10-18 · Implementado 3.0.1 |
| A2 | Una meta tiene nombre y objetivo mayor que 0; la fecha, opcional, es futura al crearla. | Rechaza | Decidido · Implementado 2.7.0 |
| A3 | Avance = ahorrado / objetivo (lo ahorrado no baja de 0). Con fecha: aporte mensual sugerido = lo que falta / meses que faltan; si la fecha pasó sin llegar, la meta está atrasada. Archivar o eliminar una meta no toca la cuenta. | — | Decidido · Implementado 2.7.0 |

## Importación

| # | Regla | Tipo | Estado |
|---|---|---|---|
| I1 | Solo se leen correos de remitentes de bancos activos. | — | Decidido |
| I2 | Sincronizar es siempre manual. | — | Decidido |
| I3 | Un aviso se importa una sola vez (idempotente). | — | Decidido |
| I4 | Un pendiente no toca saldos hasta aprobarse. | — | Decidido |
| I6 | Las **reglas de comercio** (comercio → categoría) se aprenden al aprobar un pendiente; el usuario las cambia (a una categoría de gasto activa, G4) o las borra en Ajustes → Bancos → Reglas de comercio. Una regla borrada se vuelve a aprender. | Rechaza (categoría desactivada) | Decidido 2026-10-19 · Implementado 3.0.1 |
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

## Constelación · bolsillo (2.9.0, Stellar testnet)

La familia y la bóveda (K3–K7) llegaron en la 3.0.0 (sección siguiente).

| # | Regla | Tipo | Estado |
|---|---|---|---|
| K1 | Solo **testnet**. | — | Decidido · Implementado 2.9.0 |
| K2 | En la cadena solo van direcciones `G…` y montos. **Nunca** nombres, apodos, parentescos ni fotos. | — | Decidido · Implementado 2.9.0 |
| K8 | Antes de mover dinero siempre hay una pantalla de revisión con destino, monto y "no se puede deshacer". | — | Decidido · Implementado 2.9.0 |
| K9 | Enviar a una dirección que no está en la Constelación se advierte de forma destacada (posible estafa). Desde 3.0.1 no se advierten las estrellas de tus familias ni las de tu directorio. | Advierte | Decidido · Implementado 2.9.0 · Completado 3.0.1 |
| K10 | Los montos USDC tienen 7 decimales en la cadena; se muestran en céntimos, truncados hacia abajo. Un envío acepta hasta 7 decimales y no supera el saldo. | Rechaza | Decidido · Implementado 2.9.0 |

## Constelación familiar (3.0.0, Stellar testnet)

| # | Regla | Tipo | Estado |
|---|---|---|---|
| K3 | Solo una estrella de la familia deposita en su bóveda; monto mayor que 0 (USDC). | Rechaza | Decidido 2026-10-17 · Implementado 3.0.0 |
| K4 | Un retiro de la bóveda necesita `min(aprobaciones configuradas, guardianes distintos de quien pide)` aprobaciones de guardianes **distintos de quien pide**. Si quien pide es el núcleo y es el único guardián, se ejecuta directo. Al ejecutarse, la bóveda debe tener saldo. | Rechaza | Decidido 2026-10-17 · Implementado 3.0.0 |
| K5 | El destino de un retiro es una estrella de la misma familia (protege de estafas). | Rechaza | Decidido 2026-10-17 · Implementado 3.0.0 |
| K6 | La familia tiene un **núcleo** (quien la crea): siempre guardián, no sale ni se quita. Solo el núcleo nombra o quita guardianes, cambia roles y fija las aprobaciones; cualquier guardián agrega miembros, quita miembros y fija la meta. Máximo 12 estrellas por familia y 5 familias por dirección. | Rechaza | Decidido 2026-10-17 · Implementado 3.0.0 |
| K7 | Un retiro pendiente vence a los **7 días**: ya no se aprueba (se puede cancelar). Máximo 10 retiros pendientes por familia. Cancela quien pidió o un guardián. | Rechaza | Decidido 2026-10-17 · Implementado 3.0.0 |
