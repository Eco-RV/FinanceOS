# Gastos compartidos

> Ver convención general en [`README.md`](./README.md).

## Resumen

Un gasto que el usuario paga **completo** (con tarjeta de crédito, débito o
desde una cuenta) y divide entre varias personas. Cada persona tiene una
parte fija; la del usuario es el resto. La app ayuda a avisarle a cada uno
cuánto le toca y hasta cuándo, y a llevar el control de quién pagó, cuándo y
por qué medio. Funciona como el reparto de un financiamiento
([`financiamientos.md`](./financiamientos.md), F6–F8), pero sobre un solo
gasto. Reglas X1–X6 en [`../dominio/reglas.md`](../dominio/reglas.md).

## Historias de usuario

### 1. Registrar un gasto compartido
Como usuario quiero registrar algo que pagué por varios (una cena, el súper,
un regalo) y decir con quién lo comparto, para saber cuánto me deben.

**Criterios de aceptación**
- Procesos → **Gastos compartidos** → "Nuevo gasto compartido" abre un
  asistente de **3 pasos conectados** (Gasto → Personas → Revisar). Un paso no
  avanza si le falta algo.
- Paso 1 (el gasto): descripción, con qué se pagó (tarjeta de crédito, tarjeta
  de débito o cuenta), fecha (hoy por defecto), total (en tarjeta, con moneda
  CRC/USD) y categoría de gasto.
- Se registra **un gasto normal por el total** (X1): baja la cuenta o sube la
  deuda de la tarjeta por todo lo pagado, igual que cualquier gasto.
- Si compartir falla (p. ej. un monto inválido), el gasto no queda registrado
  a medias.

### 2. Compartir un gasto que ya registré
Como usuario quiero tomar un gasto que ya está en mis movimientos y
compartirlo, para no registrarlo dos veces.

**Criterios de aceptación**
- En las listas de Gastos, de una tarjeta o de una cuenta, cada gasto sin
  compartir tiene el botón **Compartir** (ícono de personas). El asistente abre
  en el paso 2 con el gasto ya puesto.
- Un gasto se comparte una sola vez. Una cuota de financiamiento o un pago de
  préstamo no se comparte aquí: se reparte desde su módulo.
- Un gasto compartido muestra **"Ver en Compartidos"** en lugar de los botones
  de editar y eliminar.

### 3. Repartir entre las personas
Como usuario quiero que la app me proponga partes iguales y poder ajustar el
monto de cada persona.

**Criterios de aceptación**
- Paso 2: elijo las personas (miembros de Ajustes → Miembros) tocándolas. Si
  falta alguien, la agrego ahí mismo con su nombre y WhatsApp.
- "Yo también pago una parte" viene marcado. Al elegir personas, la app
  **sugiere partes iguales** entre ellas y yo (X2). Los céntimos que sobran van
  a mi parte (o a la última persona si no participo). El botón **"Partes
  iguales"** vuelve a la sugerencia.
- Cada monto se puede subir o bajar. Mi parte (el resto) se actualiza en vivo.
- **Por porcentaje** (3.1.0, X7): el selector Monto · % cambia a
  porcentajes. Se sugieren iguales (incluyéndome si participo); cada uno se
  puede cambiar y se ve el monto que resulta. La suma no puede pasar 100 %.
  Se guardan los montos; los céntimos que sobran quedan en mi parte. Si alguien
  ya pagó, el reparto sigue por monto.
  No se puede seguir si las partes pasan el total, si alguna es 0 o si no hay
  nadie elegido.
- Paso 3 (revisar): muestra el gasto, la parte de cada uno, la mía y la
  **fecha límite de cobro** (X3):
  - Con tarjeta de crédito: la fecha de pago del estado de cuenta en que cae
    el cargo (respeta la opción de corte de la tarjeta, T3).
  - Desde una cuenta o con débito: la que elijo (por defecto 15 días después
    del gasto).

### 4. Registrar que alguien me pagó
Como usuario quiero marcar que una persona me pagó su parte, cuándo y por qué
medio, y decidir si esa plata entra a una de mis cuentas.

**Criterios de aceptación**
- En el detalle del gasto, cada persona tiene **"Pagó"**. El diálogo pide la
  fecha (hoy por defecto), el medio (SINPE, efectivo, transferencia, otro) y
  una nota opcional.
- **"Registrar como ingreso en una cuenta"** (X4) viene marcado si hay cuentas
  activas en la moneda del gasto. Se elige la cuenta (se propone la que se usó
  la última vez) y la categoría de ingreso (se sugiere "Reembolso"). Con eso se
  crea un ingreso por la parte de la persona. Si se desmarca, el pago es
  **solo control** y no toca ninguna cuenta.
- Una parte se paga una sola vez. **Deshacer** la deja otra vez por cobrar y
  borra el ingreso, si se había registrado.
- El ingreso de un cobro aparece en Ingresos con "Ver en Compartidos". Se
  gestiona desde el gasto compartido, no desde Ingresos.

### 5. Avisarle a cada persona
Como usuario quiero mandarle a cada persona cuánto me debe y hasta cuándo,
por WhatsApp o por correo.

**Criterios de aceptación**
- El detalle del gasto y Procesos → **Cobros a miembros** (sección "Gastos
  compartidos") muestran un aviso por persona y fecha límite. Si una persona
  debe varios gastos con la misma fecha, van en un solo mensaje con el total.
- A diferencia de las cuotas, se puede avisar **desde el primer día** (X5). El
  aviso indica el tiempo que queda (más de 3 quincenas, 3, 2, 1 o "venció").
  Se sugiere avisar una vez en cada tramo; lo ya avisado en el tramo actual
  pasa a "Ya avisados".
- **WhatsApp** abre el mensaje listo para ese número y la app deja constancia.
  **Correo** se envía desde el Gmail conectado (permiso `gmail.send`). El
  envío es manual.
- Procesos (en "Gastos compartidos" y "Cobros a miembros") y el Resumen
  ("Cobros a miembros") cuentan los avisos por enviar. El Resumen suma lo
  que te deben en colones.

### 6. Editar o dejar de compartir
Como usuario quiero corregir el reparto o dejar de compartir un gasto.

**Criterios de aceptación**
- **Editar reparto** abre el asistente en el paso 2 con las partes guardadas.
  Se cambian la descripción, la fecha límite (solo si no es de tarjeta) y las
  partes de quien **no ha pagado**. A quien ya pagó no se le cambia el monto
  ni se le quita (X6).
- **Dejar de compartir** borra el reparto y los avisos; el gasto queda en mis
  movimientos. No se puede si hay pagos registrados (primero se deshacen).
- Mientras un gasto esté compartido, desde Gastos solo se cambian la fecha, la
  nota y la categoría. El monto, la moneda y el origen no cambian, y el gasto
  no se elimina.

## Reglas de negocio

- X1–X6 en [`../dominio/reglas.md`](../dominio/reglas.md). El dominio está en
  `src/domain/sharing/shared-expense.ts` y los casos de uso en
  `src/application/shared-expenses.ts`.
- Las personas son los **miembros** de Ajustes → Miembros (el mismo catálogo
  de los financiamientos). Un miembro con partes en un gasto compartido tiene
  historia: se desactiva en vez de eliminarse (G5).
- El Arranque de 0 borra los gastos compartidos (reparto, pagos y avisos). Los
  movimientos se archivan como todos los demás y los miembros se conservan.
- Sin el SQL 3.0.1 la pantalla queda vacía y el resto de la app funciona igual.

## Pendiente / fuera de alcance

- Repartir por consumo de cada persona (por porcentaje ya existe, X7).
- Cobrar en USDC desde la Constelación (Fase 7 de 3.x).
- Recordatorios automáticos (el envío es manual, como en F8).
- Compartir un gasto entre usuarios de Finance OS (hoy las personas son
  contactos, no tienen cuenta).

## Historial

- **2026-10-18 (v3.0.1, en desarrollo)** — Archivo nuevo: gastos compartidos
  con reparto sugerido en partes iguales, fecha límite por tarjeta o elegida,
  pagos con ingreso opcional, avisos por WhatsApp/correo y Cobros con las dos
  fuentes.
- **2026-10-20 (v3.1.0, en desarrollo)** — Reparto por porcentaje (X7).
