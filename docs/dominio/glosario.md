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
| **Usuario** | La persona dueña de los datos. Entra con correo y contraseña o con Google; puede cambiar su contraseña y cerrar sesión. | Decidido |
| **Familia** | Grupo de **contactos** del usuario (nombre, correo, WhatsApp) con quienes divide cuotas. **No** tienen login ni ven la app. | Decidido |
| **Miembro** | Un contacto de la familia. | Decidido |

## Bancos y productos

| Término | Definición | Estado |
|---|---|---|
| **Banco** | Entidad financiera de un catálogo del sistema: BCR, BN, BAC (se pueden agregar). Sabe sus remitentes de correo y su plantilla de aviso. | Propuesta: catálogo del sistema, no dato que crea cada usuario |
| **Cuenta** | Lugar donde el usuario **tiene** dinero. Su saldo es disponible. | Decidido |
| **Tipo de cuenta** | Clasificación de una cuenta bancaria de débito: ahorros, corriente… (en el documento de negocio aparece como "categorías de débito"; **no** son categorías de gasto). | Decidido |
| **Cuenta bancaria de débito** | Cuenta en un banco, con tipo de cuenta y moneda. | Decidido |
| **Efectivo** | Cuenta sin banco que representa la plata física. | Decidido |
| **Tarjeta de débito** | Medio de pago de **una** cuenta bancaria de débito (máximo una por cuenta). No tiene saldo propio: sus movimientos afectan la cuenta. Sirve para identificar compras (últimos 4 dígitos). | Decidido (una por cuenta) · Propuesta (sin saldo propio) |
| **Tarjeta de crédito** | Producto donde el usuario **debe** dinero. Su saldo es deuda. Puede tener saldo en CRC y en USD a la vez (bimoneda). | Decidido |
| **Límite de crédito** | Tope de deuda de la tarjeta, expresado **en colones**. | Decidido |
| **Disponible** | Límite − deuda total (saldo real CRC + saldo real USD convertido a CRC + capital de financiamientos pendiente). | Decidido |
| **Desactivar** | Sacar de uso algo que tiene historia (movimientos). Deja de ofrecerse para registrar, pero su historia queda. | Propuesta |
| **Eliminar** | Borrar algo sin historia, o borrar un movimiento puntual. | Propuesta |

## Ciclo de la tarjeta de crédito

| Término | Definición | Estado |
|---|---|---|
| **Corte** | Día del mes en que se cierra el estado de cuenta. En meses cortos se ajusta al último día. | Decidido |
| **Fecha límite de pago** | Hasta cuándo se puede pagar el saldo al corte sin intereses. | Decidido |
| **Saldo al corte** | Por moneda: cargos − pagos con fecha hasta el último corte. Es lo que hay que pagar de contado. | Decidido |
| **Pago de contado** | Lo que falta pagar del saldo al corte antes de la fecha límite (saldo al corte − abonos posteriores al corte). | Decidido |
| **Pago mínimo** | Monto mínimo que exige el banco para no caer en mora. Lo calcula el banco con su fórmula; el usuario lo **digita** del estado de cuenta. | Propuesta |
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
| **Abono** | Pago a una tarjeta de crédito. Sale **siempre** de una cuenta de débito: baja la cuenta y baja la deuda. Puede superar la deuda. | Decidido |
| **Categoría de gasto** / **de ingreso** | Clasificación de un gasto (comida, transporte…) o un ingreso. El usuario parte de una lista sugerida y puede editar, deshabilitar y consultar. | Decidido |
| **Movimiento programado** | Movimiento con fecha futura que nace de un plan (salario, suscripción, seguro, cuota). Se muestra como **proyección** y no se confunde con lo ocurrido hasta que llega su fecha. | Propuesta |
| **Archivar** | Sacar movimientos de la vista y de los saldos sin borrarlos. | Propuesta |
| **Arranque de 0** | Rutina con confirmación que archiva todos los movimientos (gastos, ingresos, abonos, transferencias…) y pide un saldo inicial nuevo para cada cuenta y tarjeta. Conserva cuentas, tarjetas, bancos, categorías, salario, suscripciones y seguros. | Decidido (qué conserva) · Propuesta (archiva en vez de borrar) |

## Planes recurrentes

| Término | Definición | Estado |
|---|---|---|
| **Salario** | Plan de ingresos periódicos (semanal, bisemanal, quincenal, mensual) hacia una cuenta de débito. Genera ingresos programados. | Decidido |
| **Suscripción** | Plan de gasto mensual fijo con una tarjeta (crédito o débito). Genera gastos programados. Al eliminarla se borran los cargos futuros. | Decidido |
| **Seguro de tarjeta** | Cargo mensual fijo asociado a una tarjeta de crédito. Genera gastos en la tarjeta. Una tarjeta puede tener varios. | Decidido |
| **Línea base financiera** | Lista de gastos fijos del usuario, repartidos por periodo (semana, quincena, mes), para controlar liquidez. Muestra qué porcentaje del salario ocupa cada gasto. | Decidido |
| **Tope de línea base** | Porcentaje máximo del salario que deberían sumar los gastos fijos. Default 35 %, configurable. | Decidido |

## Financiamientos y préstamos

| Término | Definición | Estado |
|---|---|---|
| **Financiamiento sin interés (tasa 0)** | Compra a N cuotas iguales sobre una tarjeta de crédito, sin interés. El total resta al disponible desde el día 1. | Decidido |
| **Financiamiento con interés** | Compra a N cuotas sobre una tarjeta con tasa de interés. El capital resta al disponible desde el día 1; cada cuota incluye interés y abono al capital. | Propuesta (ver historia en `tarjetas.md`) |
| **Cuota** | Cargo mensual de un financiamiento o préstamo, con número `i/N`. Se consulta en una sección propia, separada de los gastos. | Decidido |
| **Cuota a cobro** | La cuota que entra en el estado de cuenta vigente. | Decidido |
| **Abono a cuota** | Abono real a la tarjeta por el monto total de una cuota, desde una cuenta de débito. | Decidido |
| **Parte de un miembro** | Fracción de una cuota que le toca a un miembro de la familia. | Decidido |
| **Reembolso de miembro** | Registro de que un miembro pagó su parte (SINPE o efectivo). Es un control interno: **no toca la tarjeta**. | Decidido |
| **Aviso de cuota** | Mensaje informativo (correo y/o WhatsApp) a cada miembro con su parte y cuántas quincenas (1, 2 o 3) faltan para la fecha límite. | Decidido |
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
