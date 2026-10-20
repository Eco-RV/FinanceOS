# Glosario (lenguaje ubicuo)

> Un término = un significado. Si en una conversación, historia de usuario o
> en el código aparece una palabra con otro sentido, se corrige para que
> coincida con este glosario. Ver convención en [`README.md`](./README.md).

## Dinero

| Término | Definición | Estado |
|---|---|---|
| **Moneda** | `CRC` o `USD`, con el mismo trato. Pueden agregarse más a futuro, así que nunca se asume que hay solo dos. | Decidido |
| **Monto (Dinero)** | Cantidad **más** moneda. Dos montos de distinta moneda no se suman ni se comparan sin un tipo de cambio explícito. | Decidido |
| **Tipo de cambio** | Precio de una moneda en otra en una fecha. Se usa solo donde una regla lo pide (p. ej. el disponible de una tarjeta bimoneda). La fuente (BCCR, digitado a mano) es un detalle externo. | Decidido |

## Usuario y familia

| Término | Definición | Estado |
|---|---|---|
| **Usuario** | La persona dueña de los datos. Entra con correo y contraseña (confirmado por correo) o con Google; puede cambiar su correo y su contraseña, restablecerla si la olvida y cerrar sesión. | Decidido · correo y contraseña implementados 2.6.0 |
| **Perfil** | Datos opcionales del usuario: nombre, usuario (@), país y foto. | Decidido · Implementado 2.6.0 |
| **Preferencias** | Ajustes de cómo se ve y se comporta la app (tema hoy; moneda base y formato de fecha a futuro). | Decidido · Implementado 2.6.0 |
| **Familia** | Grupo de **contactos** del usuario (nombre, correo, WhatsApp) con quienes divide cuotas. **No** tienen login ni ven la app. | Decidido |
| **Persona (de un gasto compartido)** | Un miembro con quien se divide un gasto compartido (3.1.0). En pantalla se dice "persona"; en el modelo es un **miembro**. | Decidido · Implementado 3.1.0 |
| **Miembro** | Un contacto de la familia que paga parte de las cuotas de un financiamiento o de un gasto compartido. Tiene nombre y correo y/o WhatsApp (Ajustes → Miembros). | Decidido · Implementado 2.3.0 |

| **Gasto compartido** | Gasto que el usuario paga completo y divide entre personas (miembros). Cada persona tiene una parte fija y la del usuario es el resto (X1–X6). | Decidido · Implementado 3.1.0 |
| **Parte** | Lo que le toca pagar a una persona de un gasto compartido o de una cuota de financiamiento. | Decidido |
| **Cobro** | Registro de que una persona pagó su parte: fecha, medio y, si se quiere, un ingreso a una cuenta (X4). | Decidido · Implementado 3.1.0 |

## Bancos y productos

| Término | Definición | Estado |
|---|---|---|
| **Banco** | Entidad financiera de un catálogo del sistema: BCR, BN, BAC (se pueden agregar). Sabe sus remitentes de correo y su plantilla de aviso. | Decidido: hoy cada usuario crea sus bancos (Ajustes → Bancos). Un catálogo del sistema queda como propuesta |
| **Cuenta** | Lugar donde el usuario **tiene** dinero. Su saldo es disponible. | Decidido |
| **Tipo de cuenta** | Clasificación de una cuenta bancaria de débito: ahorros, corriente… (en el documento de negocio aparece como "categorías de débito"; **no** son categorías de gasto). | Decidido |
| **Cuenta bancaria de débito** | Cuenta en un banco, con tipo de cuenta y moneda. | Decidido |
| **Efectivo** | Cuenta sin banco que representa la plata física. | Decidido |
| **Tarjeta de débito** | Medio de pago de **una** cuenta bancaria (corriente o ahorro; máximo una activa por cuenta). No tiene saldo propio: un gasto con ella resta de su cuenta y recuerda la tarjeta. Sirve para identificar compras (últimos 4 dígitos). | Decidido · Implementado 2.8.0 |
| **Tarjeta de crédito** | Producto donde el usuario **debe** dinero. Su saldo es deuda. Puede tener saldo en CRC y en USD a la vez (bimoneda). | Decidido |
| **Límite de crédito** | Tope de deuda de la tarjeta, expresado **en colones**. | Decidido |
| **Disponible** | Límite − deuda total (saldo real CRC + saldo real USD convertido a CRC + capital de financiamientos pendiente). | Decidido |
| **Desactivar** | Sacar de uso algo que tiene historia (movimientos). Deja de ofrecerse para registrar, pero su historia queda. | Decidido · Implementado 2.1.0 (G5) |
| **Eliminar** | Borrar algo sin historia, o borrar un movimiento puntual. | Decidido · Implementado 2.1.0 (G5) |

## Ciclo de la tarjeta de crédito

| Término | Definición | Estado |
|---|---|---|
| **Corte** | Día del mes en que se cierra el estado de cuenta. En meses cortos se ajusta al último día. | Decidido |
| **Fecha límite de pago** | Hasta cuándo se puede pagar el saldo al corte sin intereses. | Decidido |
| **Saldo al corte** | Por moneda: cargos − pagos con fecha hasta el último corte. Es lo que hay que pagar de contado. | Decidido |
| **Pago de contado** | Lo que falta pagar del saldo al corte antes de la fecha límite (saldo al corte − abonos posteriores al corte). | Decidido |
| **Abono anticipado** | Lo abonado después del corte por encima del pago de contado (o un saldo a favor al corte): se descuenta del consumo sin cortar. | Decidido · Implementado 2.8.0 |
| **Día de corte al siguiente corte** | Opción de una tarjeta para bancos que cortan por fecha de proceso (BAC): lo comprado el mismo día del corte entra al corte siguiente. | Decidido · Implementado 2.8.0 |
| **Pago mínimo** | Monto mínimo que exige el banco para no caer en mora. Lo calcula el banco con su fórmula; el usuario lo **digita** del estado de cuenta (T8). | Decidido · Implementado 3.1.0 |
| **Consumo sin cortar** | Cargos posteriores al último corte que ya ocurrieron. Entran al siguiente estado de cuenta. | Decidido |
| **Saldo real** | Por moneda: saldo al corte + consumo sin cortar (− abonos posteriores). | Decidido |
| **Estado de la tarjeta** | `sin movimientos`, `sin saldo`, `al día`, `pendiente` o `atrasada`. | Decidido |
| **Interés** | Costo que cobra el banco por financiar deuda (saldo no pagado de contado, o financiamiento con interés). | Decidido (término) |

## Movimientos

| Término | Definición | Estado |
|---|---|---|
| **Movimiento** | Hecho con fecha que cambia un saldo. **Los movimientos son la verdad**: todo saldo se deriva de ellos; un saldo guardado es solo una copia para rendimiento. | Decidido |
| **Saldo inicial** | Movimiento oficial de entrada o salida con el que arranca una cuenta o tarjeta. Aparece como una línea más en los movimientos. | Decidido |
| **Gasto** | Salida de dinero hacia un tercero, desde una cuenta o con una tarjeta. Lleva **categoría de gasto** obligatoria. | Decidido |
| **Ingreso** | Entrada de dinero a una cuenta. Lleva **categoría de ingreso**. Puede tener fecha futura (p. ej. salario). | Decidido |
| **Transferencia** | Movimiento de dinero **entre cuentas propias**. Tiene dos lados (sale de una, entra a otra) y **no es gasto**. | Decidido |
| **SINPE** | Salida de dinero desde una cuenta de débito hacia un tercero vía SINPE Móvil. **Es un gasto** y lleva categoría. | Decidido |
| **Comprobante** | Archivo (factura, recibo, foto del voucher) adjunto a un movimiento; privado del usuario (G8). | Decidido · Implementado 3.1.0 |
| **Regla de comercio** | Comercio → categoría que la app aprende al aprobar una compra importada y sugiere la próxima vez; se edita o borra (I6). | Decidido · Implementado 3.1.0 |
| **Abono** | Pago a una tarjeta de crédito. Sale **siempre** de una cuenta de débito: baja la cuenta y baja la deuda. Puede superar la deuda. Puede abonar el saldo en la otra moneda de la tarjeta: la cuenta paga el equivalente con el último tipo de cambio (M5, 2.8.0). | Decidido |
| **Categoría de gasto** / **de ingreso** | Clasificación de un gasto (comida, transporte…) o un ingreso. El usuario parte de una lista sugerida y puede editar, deshabilitar y consultar. | Decidido |
| **Movimiento programado** | Movimiento con fecha futura que nace de un plan (salario, suscripción, seguro, cuota). Se muestra como **proyección** y no se confunde con lo ocurrido hasta que llega su fecha. | Decidido · Implementado 2.0.0 (cuotas) y 2.7.0 (planes, M7) |
| **Archivar** | Sacar movimientos de la vista y de los saldos sin borrarlos. | Decidido · Implementado 2.2.0 (Arranque de 0) |
| **Arranque de 0** | Rutina con confirmación que archiva todos los movimientos (gastos, ingresos, abonos, transferencias, cuotas cobradas…), elimina financiamientos y préstamos con sus cuotas pendientes y pide un saldo inicial nuevo para cada cuenta y tarjeta. Conserva cuentas, tarjetas, bancos, categorías, salario, suscripciones y seguros. | Decidido |

## Planes recurrentes

| Término | Definición | Estado |
|---|---|---|
| **Salario** | Plan de ingresos periódicos (semanal, bisemanal, quincenal, mensual) hacia una cuenta de débito. Genera ingresos programados. | Decidido |
| **Gasto fijo** | Plan de gasto mensual que se repite: renta, agua, luz, internet, suscripciones… Se paga con una tarjeta de crédito o desde una cuenta de débito. Genera gastos programados. Al eliminarlo no quedan cargos futuros. (Antes "Suscripción"; las suscripciones son un tipo de gasto fijo.) | Decidido · Implementado 2.7.0 |
| **Seguro de tarjeta** | Cargo mensual fijo asociado a una tarjeta de crédito. Genera gastos en la tarjeta. Una tarjeta puede tener varios. | Decidido |
| **Línea base financiera** | Lista de gastos fijos del usuario, repartidos por periodo (semana, quincena, mes), para controlar liquidez. Muestra qué porcentaje del salario ocupa cada gasto. | Decidido |
| **Tope de línea base** | Porcentaje máximo del salario que deberían sumar los gastos fijos. Default 35 %, configurable. | Decidido · Implementado 2.7.0 |
| **Ocurrencia programada** | Fecha futura de un plan. No es un movimiento todavía: se registra cuando llega su día. | Decidido · 2.7.0 |
| **Meta de ahorro** | Objetivo (monto, moneda y fecha opcional) ligado a una cuenta. Con una sola meta, lo ahorrado es el saldo de la cuenta; aportar es transferirle. | Decidido · Implementado 2.7.0 |
| **Apartado** | Parte del saldo de una cuenta que se asigna a una de sus metas cuando la cuenta tiene varias (A4). Lo no apartado queda **libre**. | Decidido · Implementado 3.1.0 |
| **Monto variable / por confirmar** | Plan cuyo monto es un estimado (salario variable, luz, agua): cada ocurrencia entra con el estimado y queda **por confirmar** hasta poner el real (P7). | Decidido · Implementado 3.1.0 |
| **Recordatorio** | Aviso **dentro de la app** (card del Resumen) de lo que viene en los próximos días o está pendiente; no se envía nada solo (P8). | Decidido · Implementado 3.1.0 |

## Financiamientos y préstamos

| Término | Definición | Estado |
|---|---|---|
| **Financiamiento sin interés (tasa 0)** | Compra a N cuotas iguales sobre una tarjeta de crédito, sin interés. El total resta al disponible desde el día 1. | Decidido |
| **Capital (de un financiamiento)** | Lo financiado, sin intereses. En tasa 0 es el total de la compra. | Decidido · 2.3.0 |
| **Financiamiento con interés** | Compra a N cuotas sobre una tarjeta con tasa de interés. El capital resta al disponible desde el día 1; cada cuota incluye interés y abono al capital, y su interés cuenta cuando llega su fecha. | Decidido · Implementado 2.3.0 (ver `historias-usuario/financiamientos.md`) |
| **Cuota** | Cargo mensual de un financiamiento o préstamo, con número `i/N`. Se consulta en una sección propia, separada de los gastos. | Decidido |
| **Cuota a cobro** | La cuota que entra en el estado de cuenta vigente. | Decidido |
| **Abono a cuota** | Abono real a la tarjeta por el monto total de una cuota, desde una cuenta de débito. | Decidido |
| **Parte de un miembro** | Monto fijo por cuota que le toca a un miembro de la familia; lo que sobra de la cuota es la parte del usuario. | Decidido · Implementado 2.3.0 |
| **Reembolso de miembro** | Registro de que un miembro pagó su parte de una cuota (SINPE, efectivo, transferencia u otro). Es un control interno: **no toca la tarjeta**. | Decidido · Implementado 2.3.0 |
| **Aviso de cuota** | Mensaje informativo (correo y/o WhatsApp) a cada miembro con su parte y cuántas quincenas (1, 2 o 3) faltan para la fecha límite. El usuario lo envía a mano desde Cobros a miembros. | Decidido · Implementado 2.3.0 |
| **Por cobrar (a un miembro)** | Partes de cuotas que ya entraron a la tarjeta y el miembro todavía no reembolsó. | Decidido · 2.3.0 |
| **Abono extraordinario** | Pago extra al capital de un préstamo (L7) o de un financiamiento (F11), fuera de las cuotas. Al hacerlo se elige si **baja el plazo** (misma cuota, menos cuotas) o **baja la cuota** (mismo plazo). Sale de una cuenta como un gasto. | Decidido · Implementado 3.1.0 |
| **Tasa variable** | Cambio de la tasa anual de un préstamo desde una cuota todavía sin pagar; el plazo se mantiene y la cuota se recalcula (L8). | Decidido · Implementado 3.1.0 |
| **Préstamo** | Deuda con un banco por un monto, a N meses, con tasa de interés anual fija. | Decidido |
| **Desembolso** | Dinero que el banco deposita al dar un préstamo. Se registra (opcional) como ingreso en una cuenta. | Decidido |
| **Cuota a cobro (préstamo)** | Lo que hay que pagar ya de un préstamo: las cuotas vencidas, o la próxima si vence dentro de 31 días (L6). | Decidido |
| **Capital pendiente** | Lo que falta pagar del monto prestado, sin intereses futuros: el saldo después de la última cuota pagada. | Decidido |
| **Tabla de amortización** | Calendario de cuotas de un préstamo o financiamiento con interés: por cuota, interés, abono al capital y capital restante. Sistema francés (cuota fija). | Decidido |

## Importación desde correo

| Término | Definición | Estado |
|---|---|---|
| **Aviso bancario** | Correo de compra de un banco, reconocido por su remitente y su plantilla. Hoy solo BAC. | Decidido |
| **Plantilla** | Formato del correo de un banco. Puede cambiar sin aviso; el parser se ajusta. | Decidido |
| **Sincronizar** | Leer los avisos nuevos. **Siempre manual**: lo dispara el usuario. | Decidido |
| **Pendiente (por confirmar)** | Compra detectada que todavía no es gasto ni toca saldos. | Decidido |
| **Aprobar** / **Descartar** | Aprobar convierte el pendiente en gasto; descartar lo ignora. | Decidido |
| **Regla de comercio** | Categoría sugerida para un comercio, aprendida al aprobar. | Decidido |

## Constelación (2.9.0, Stellar testnet)

Contexto aparte del libro: su fuente de verdad es la **cadena** (Stellar
testnet), no los movimientos de Finance OS.

| Término | Definición | Estado |
|---|---|---|
| **Wallet / bolsillo** | La cuenta Stellar `G…` del usuario, con su saldo en USDC. Solo él la controla (Cavos con su correo o Google, o una extensión). Enviar a otra persona es un pago directo de wallet a wallet, sin contrato. | Decidido · Implementado 2.9.0 |
| **USDC** | Dólar digital (Circle) en Stellar, con 7 decimales. Para tenerlo hace falta una **trustline** ("abrir el bolsillo de dólares"). | Decidido · Implementado 2.9.0 |
| **XLM de prueba** | La moneda de la red, que paga las comisiones. En testnet la regala Friendbot. | Decidido · Implementado 2.9.0 |

## Constelación familiar (3.0.0)

| Término | Definición | Estado |
|---|---|---|
| **Constelación** | La familia vista como estrellas unidas: cada persona es una **estrella** y la bóveda es un planeta. La familia (direcciones y roles) vive en el contrato `family`; apodos, emoji y parentesco viven en Finance OS. No confundir con **Familia (cobros)** de los financiamientos. | Decidido 2026-10-17 |
| **Estrella** | Una persona de la constelación, identificada en la cadena solo por su dirección `G…`. Tiene cuenta en Finance OS y su propia wallet. | Decidido 2026-10-17 |
| **Núcleo** | Quien crea la familia. Siempre es guardián, no sale ni se quita, cambia roles y aprueba los retiros de los demás. | Decidido 2026-10-17 |
| **Estrella gestionada** | Familiar (p. ej. una abuela) a quien el núcleo invita y cuida: el núcleo pone su apodo y su rol, pero ella tiene su propia wallet y su propia cuenta. | Decidido 2026-10-17 |
| **Guardián** | Estrella que puede aprobar retiros de la bóveda (de otros), agregar estrellas y fijar la meta. | Decidido 2026-10-17 |
| **Bóveda** | Ahorro común de una familia, guardado en el contrato `family`, con una **meta**. Todos depositan; retirar necesita aprobación (K4). | Decidido 2026-10-17 |
| **Retiro (de la bóveda)** | Pedido de sacar USDC de la bóveda hacia una estrella de la familia. Queda pendiente hasta tener las aprobaciones; vence a los 7 días. | Decidido 2026-10-17 |
| **Apoyo** | Pago con condición sobre un escrow de Trustless Work (p. ej. la matrícula se libera cuando un guardián confirma). | Decidido 2026-10-17 |
| **Academia** | Lecciones cortas con quiz sobre wallet, blockchain, USDC, enviar sin miedo y la bóveda. | Decidido 2026-10-17 |
