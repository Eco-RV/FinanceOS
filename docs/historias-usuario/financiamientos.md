# Financiamientos

> Ver convención general en [`README.md`](./README.md).

## Resumen

Compras a cuotas sobre una tarjeta de crédito, **sin interés (tasa 0)** o
**con interés** (cuota fija, sistema francés), y su reparto entre miembros de
la familia: cuánto paga cada uno por cuota, quién ya te pagó y los avisos de
cuánto le toca y cuántas quincenas faltan para la fecha límite de la tarjeta.
Reglas en [`../dominio/reglas.md`](../dominio/reglas.md) (F1–F9) y términos
en [`../dominio/glosario.md`](../dominio/glosario.md).

## Historias de usuario

### 1. Crear un financiamiento (tasa 0 o con interés)
Como usuario quiero registrar una compra a cuotas sobre una tarjeta
(descripción, categoría, monto, tasa anual, meses y fecha de la primera
cuota), para que la app genere el cronograma y sepa cuánto me cuesta.

**Criterios de aceptación**
- Desde el detalle de la tarjeta → "Nuevo financiamiento". Campos: descripción
  (1–80), categoría de gasto, monto, **tasa anual (%)** (0 a 100, por defecto
  0), meses (**2 a 72**) y fecha de la primera cuota (por defecto hoy). La
  moneda es la del límite de la tarjeta.
- El formulario muestra la cuota mensual y, con tasa, el total de intereses
  y el costo total, con el mismo cálculo del dominio.
- **Tasa 0**: el monto se divide en N cuotas iguales en céntimos; el residuo va
  en la última (F1).
- **Con tasa**: tabla de amortización francesa (F5), la misma de los
  préstamos: cuota fija = capital × i / (1 − (1 + i)^−n), con i = tasa anual /
  12; el interés de cada cuota se redondea a céntimos y la última cuota cierra
  el capital en 0.
- Las cuotas caen el mismo día cada mes, recortado en meses cortos (F2). Cada
  una es un gasto (`expense`) por el **monto completo de la cuota** (interés +
  capital) ligado al plan (`financing_id`, `installment_no`, nota
  "<descripción> (cuota i/N)") y con su interés en `interest_amount`.
- Todo se guarda en una sola operación (`create_financing_v3`), que verifica
  que lleguen N cuotas y que los abonos al capital sumen exactamente el
  capital.

**Ejemplo** (el de la propuesta de 2.0.0, hoy implementado): ₡600 000 a 12
meses al 24 % anual → cuota ₡56 735,76; intereses ₡80 829,10.

| Cuota | Interés | Abono al capital | Capital restante |
|---|---|---|---|
| 1 | ₡12 000,00 | ₡44 735,76 | ₡555 264,24 |
| 2 | ₡11 105,28 | ₡45 630,48 | ₡509 633,76 |
| 3 | ₡10 192,68 | ₡46 543,08 | ₡463 090,68 |
| … | baja | sube | … |
| 12 | ₡1 112,47 | ₡55 623,27 | ₡0,00 |

### 2. Qué baja el saldo y el disponible
Como usuario quiero que la tarjeta muestre la deuda real de hoy, para no ver
como deuda intereses que todavía no me cobran.

**Criterios de aceptación**
- El **capital** completo resta al disponible y suma al saldo desde el día 1,
  igual que en tasa 0 (F1).
- El **interés** de cada cuota cuenta en el saldo, el disponible, el
  patrimonio neto y el Arranque de 0 **solo cuando llega su fecha**. "Saldo
  actual" en la tarjeta indica aparte cuánto interés queda en cuotas futuras.
- Cada cuota entra al estado de cuenta en su fecha por el monto completo (M7):
  hasta entonces no es "consumo sin cortar" ni pago de contado. En el
  historial de la tarjeta la cuota dice "incluye ₡X de interés".
- Al abonar a la tarjeta, la deuda baja por el monto abonado (capital e
  interés de lo ya cobrado).

### 3. Ver un financiamiento y su tabla
Como usuario quiero ver el plan completo de un financiamiento, para saber qué
cuotas ya entraron, cuáles faltan y cuánto interés llevo.

**Criterios de aceptación**
- La lista de la tarjeta muestra por plan: descripción (enlace al detalle),
  categoría y tasa, capital (+ interés total si hay), cuota, cuotas restantes
  y próxima cuota (o "Completado" / "Cancelado el …").
- El detalle (`/procesos/tarjetas/<tarjeta>/financiamientos/<plan>`) muestra
  cuota, capital por cobrar, próxima cuota y, con interés, interés cobrado,
  interés por cobrar y costo total.
- La tabla lista cada cuota con fecha, monto, (interés y capital si hay tasa),
  saldo de capital, estado (**Cobrada** si su fecha ya llegó, **Próxima**,
  **Programada**) y la fecha límite de pago del estado de cuenta en que cae.

### 4. Editar un financiamiento
Como usuario quiero corregir la descripción o la categoría de un
financiamiento, para no tener que borrarlo y crearlo de nuevo.

**Criterios de aceptación**
- Se editan **solo la descripción y la categoría** (F9); cambian en el plan y
  en todas sus cuotas activas (nota "cuota i/N" incluida).
- El monto, la tasa, los meses y la fecha **no se editan**: para cambiarlos se
  elimina el plan y se crea otro.
- Un plan cancelado no se edita.

### 5. Eliminar un financiamiento
Como usuario quiero eliminar un financiamiento que ya no aplica.

**Criterios de aceptación**
- Regla F4: se borran solo las cuotas **futuras** (fecha posterior a hoy), con
  su interés; las que ya ocurrieron se conservan y el plan queda "Cancelado el
  <fecha> · N cuota(s) conservada(s)". Si ninguna había ocurrido, el plan se
  borra completo (con su reparto, reembolsos y avisos).
- Las cuotas conservadas de un plan cancelado se pueden quitar a mano desde el
  historial de la tarjeta.

### 6. Miembros de la familia
Como usuario quiero registrar a los familiares que me pagan parte de las
cuotas, para poder repartirlas y avisarles.

**Criterios de aceptación**
- Ajustes → **Miembros**: nombre (1–60, único entre los activos), correo y
  WhatsApp (8 dígitos de Costa Rica o con código de país). Hace falta al
  menos uno de los dos para poder avisarle.
- G5: un miembro con partes o reembolsos no se elimina, se desactiva (sus
  partes y reembolsos se conservan); uno desactivado no se agrega a un reparto
  nuevo (G4).

### 7. Repartir las cuotas
Como usuario quiero indicar cuánto paga cada miembro por cuota, para saber
cuánto me toca a mí.

**Criterios de aceptación**
- En el detalle del plan → "Repartir cuotas": un **monto fijo por cuota** por
  miembro; vacío = no participa. La parte del usuario es el resto de la cuota,
  así las partes suman exactamente la cuota (F6).
- La suma de los miembros no puede pasar la cuota más baja del plan (en tasa 0
  la última puede variar unos céntimos).
- No se quita del reparto a un miembro que ya tiene reembolsos en ese plan
  (primero se deshacen).

### 8. Registrar que un miembro pagó
Como usuario quiero marcar que un miembro me pagó su parte de una cuota, para
saber quién me debe.

**Criterios de aceptación**
- En la tabla del plan (una columna por miembro) o en Procesos → **Cobros a
  miembros** → "Pagó": fecha, medio (SINPE, efectivo, transferencia, otro) y
  nota opcional. El monto es la parte del miembro.
- Es un **control interno** (F7): no toca la tarjeta ni las cuentas.
- Una parte se reembolsa una sola vez; se puede deshacer.
- "Por cobrar" lista, por miembro, las partes de cuotas que ya entraron a la
  tarjeta (fecha ≤ hoy) sin reembolso. El Resumen muestra el total en colones.

### 9. Avisar a cada miembro su parte
Como usuario quiero mandarle a cada miembro cuánto le toca y cuánto tiempo le
queda, para cobrarle a tiempo.

**Criterios de aceptación**
- La fecha límite de una cuota es la fecha de pago del estado de cuenta en que
  cae (el primer corte en o después de su fecha). Si la tarjeta tiene marcado
  "Las compras del día de corte pasan al siguiente corte" (T3), la opción vale
  también para las cuotas: una cuota que cae el mismo día del corte entra al
  corte siguiente y vence en su fecha de pago (3.0.1; antes solo lo respetaba
  el estado de cuenta, no la tabla ni los avisos).
- Procesos → **Cobros a miembros** → "Avisos por enviar": las partes sin
  reembolsar cuya fecha límite está a **3 quincenas o menos** (o ya venció),
  agrupadas por miembro y fecha límite — un mensaje por miembro con todas sus
  cuotas de esa fecha y el total (F8).
- Se avisa **una vez por quincena**: con 3, 2 y 1 quincenas (1 = 15 días o
  menos, incluido el mismo día) y una vez al vencer. Lo ya avisado en la
  quincena actual pasa a "Ya avisados".
- **WhatsApp**: abre WhatsApp con el mensaje ya escrito para ese número; el
  usuario toca Enviar. La app deja constancia del aviso.
- **Correo**: se envía desde el Gmail conectado (permiso `gmail.send`). Si la
  conexión es anterior a 2.3.0 hay que reconectar Gmail en Ajustes → Bancos.
- El envío es **manual**: el Resumen y Procesos muestran cuántos avisos hay por
  enviar; no hay envío automático.

## Reglas de negocio

- El plan lo calcula el dominio (`financingSchedule` en
  `src/domain/financing/plan.ts`); la base guarda exactamente ese plan.
- El interés de una cuota viaja en la cuota (`transactions.interest_amount`):
  el trigger de saldos suma la cuota completa y la app descuenta el interés de
  las cuotas futuras (`scheduledInterest`). "Verificar saldos" sigue cuadrando
  porque los dos lados incluyen el plan completo.
- `financings.total_amount` es el **capital** (en tasa 0, el total).
- Reparto, reembolsos y avisos (`financing_shares`, `member_reimbursements`,
  `member_notices`) no tocan saldos. Borrar el plan o el Arranque de 0 los
  borra con él; los miembros se conservan.
- La moneda del plan es la del límite de la tarjeta.

## Pendiente / fuera de alcance

- Financiamiento en dólares sobre una tarjeta con límite en colones.
- Envío automático de avisos (cron) o por la API de WhatsApp Business.
- Abonos extraordinarios al capital de un financiamiento con interés.
- Cada banco puede tener particularidades (redondeos, comisiones, IVA sobre
  intereses): conviene comparar la tabla con el estado de cuenta real.
- Cambiar los términos de un plan existente (se elimina y se crea otro).

## Historial

- **2026-10-14 (v2.3.0, en desarrollo)** — Archivo nuevo: los financiamientos
  salen de `tarjetas.md` (historias 6 y 7) y suman financiamiento con interés
  (F5), edición (F9), 72 meses como máximo, miembros con reparto por cuota
  (F6), reembolsos (F7) y avisos por quincena por WhatsApp y correo (F8).
- **2026-10-14 (v2.5.0, en desarrollo)** — Pantalla
  `/procesos/financiamientos` con los activos de todas las tarjetas (botón
  en Gastos y modal en el Resumen); toda la fila abre el detalle.
- **2026-10-18 (v3.0.1, en desarrollo)** — La opción de corte de la tarjeta
  (T3) también se aplica a la fecha límite de las cuotas: tabla del plan,
  avisos a miembros y por cobrar.
