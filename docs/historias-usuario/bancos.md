# Bancos y correos de compras

> Ver convención general en [`README.md`](./README.md).

## Resumen

Importa las compras con tarjeta desde los avisos que envía el
banco por correo. El usuario registra sus bancos (remitentes + formato del
correo), conecta su Gmail en modo solo lectura y, al tocar "Sincronizar", la
app lee los avisos nuevos **sin IA ni tokens** (un parser determinístico por
banco). Cada compra detectada llega a una bandeja "Por confirmar"; solo al
aprobarla se crea el gasto y se ajusta el saldo de la tarjeta.

## Historias de usuario

### 1. Registrar un banco
Como usuario quiero registrar un banco con los correos desde los que me llegan
los avisos y el formato de esos correos, para que la app sepa cuáles leer.

**Criterios de aceptación**
- Campos: `name` (obligatorio, ≤ 60), `sender_emails` (1-10 correos válidos,
  separados por coma, espacio o salto de línea; se guardan en minúsculas y sin
  repetidos), `parser_key` (formato soportado, p. ej. BAC), `enabled`.
- Se gestiona en `/ajustes/bancos` (crear, editar, pausar, desactivar,
  eliminar).
- Pausar un banco (`enabled = false`) deja de leer sus correos sin borrarlo.
- Regla G5: un banco **sin avisos importados** se puede eliminar; si ya trajo
  avisos (en cualquier estado), se **desactiva**: no se leen más sus correos,
  no se ofrece al editar tarjetas y queda en "Desactivados", desde donde se
  activa de nuevo. Un banco desactivado no se edita (G4).

### 2. Conectar mi correo
Como usuario quiero conectar mi Gmail, para que la app pueda leer los avisos
de mis bancos (y enviar desde mi cuenta los avisos de cuota a mis miembros)
sin conocer mi contraseña.

**Criterios de aceptación**
- Flujo OAuth de Google con los permisos `gmail.readonly` y, desde 2.3.0,
  `gmail.send` (solo para los avisos de cuota que el usuario manda desde
  Cobros a miembros; no puede borrar correos). El token de larga duración se
  guarda **cifrado** (AES-256-GCM) y nunca viaja al navegador.
- Si la conexión no tiene `gmail.send` (conectada antes de 2.3.0), la página
  muestra "Reconectar para enviar avisos".
- `/ajustes/bancos` muestra el correo conectado, la fecha de la última lectura
  y permite desconectarlo (borra el token).
- Solo se descargan correos cuyo remitente esté en un banco activo.

### 3. Lectura automática de compras
Como usuario quiero que las compras con tarjeta se detecten solas, para no
registrarlas a mano.

**Criterios de aceptación**
- La lectura es **siempre manual** (I2): el botón "Sincronizar" de
  `/procesos/pendientes`. La ruta `/api/sync-mail` (protegida con un secreto
  Bearer, `CRON_SECRET`) existe para un cron externo, pero el workflow cada 2 h
  que se planeó para v1.3.1 se descartó (decisión de negocio, ver
  `docs/dominio/arquitectura.md`).
- Leer dos veces el mismo correo no duplica nada (`unique (user_id,
  source_message_id)`).
- La tarjeta se identifica por los **últimos 4 dígitos** del aviso contra
  `credit_cards.last_four`; si dos tarjetas comparten dígitos se desempata con
  el banco de la tarjeta (`bank_id`). Sin coincidencia única queda sin tarjeta
  para que el usuario la elija.
- Solo las **compras** generan un pendiente; reversos y otros tipos de aviso se
  ignoran.
- La primera lectura revisa los últimos 30 días; las siguientes, desde la
  última lectura (con un día de margen).

### 4. Confirmar compras por confirmar
Como usuario quiero revisar cada compra detectada y aprobarla o descartarla,
para que solo entren a mis saldos las que son correctas.

**Criterios de aceptación**
- `/procesos/pendientes` lista las compras `pending` con comercio, fecha,
  monto, banco y últimos 4. El índice de Procesos muestra cuántas hay.
- Aprobar exige tarjeta y categoría; crea un `expense` sobre la tarjeta (el
  trigger de saldos hace el resto) y marca el pendiente `approved`.
- Se ofrecen todas las tarjetas: desde 2.0.0 son bimoneda, y la compra va al
  saldo de **su** moneda en la tarjeta elegida (no hay conversión).
- Descartar marca el pendiente `rejected`; no crea gasto.
- "Sincronizar" lee el correo en el momento (único disparador en v1.3.0).

### 5. Categoría sugerida
Como usuario quiero que la app recuerde la categoría de cada comercio, para
confirmar con un toque las compras repetidas.

**Criterios de aceptación**
- Al aprobar se guarda una regla `merchant_rules` (comercio normalizado →
  categoría). La clave descarta los códigos finales con dígitos:
  `WALMART GUADALUPE WCN0` → `walmart guadalupe`.
- Las próximas compras de ese comercio llegan con la categoría preseleccionada.

### 6. Asociar una tarjeta a su banco
Como usuario quiero indicar el banco de cada tarjeta, para que la lectura
distinga tarjetas de bancos distintos con los mismos últimos 4 dígitos.

**Criterios de aceptación**
- El formulario de tarjeta muestra el selector "Banco" solo si hay bancos
  registrados; es opcional.

### 7. Corregir las reglas de comercio (3.0.1)
Como usuario quiero cambiar la categoría que la app sugiere para un comercio, o
borrar la regla, para que las próximas compras lleguen bien clasificadas.

**Criterios de aceptación**
- Ajustes → Bancos → **Reglas de comercio**: cada comercio con su categoría en
  un combo; cambiarla guarda al momento (solo categorías de gasto activas, G4).
- **Borrar** quita la regla: la próxima compra de ese comercio llega sin
  sugerencia y se vuelve a aprender al aprobarla (I6).

## Reglas de negocio

- Nada del correo afecta saldos hasta que el usuario lo aprueba.
- Agregar un banco nuevo = un parser en `src/lib/mail/parsers/`, su registro en
  `parsers/index.ts`, un correo real como fixture y su test.
- La ruta `/api/sync-mail` usa service role (salta RLS) e inserta siempre con
  `user_id` explícito; es la única que lo hace.
- El parser de BAC espera la tabla Etiqueta/Valor de "Notificación de
  transacción" (Comercio, Fecha, tarjeta enmascarada, Autorización, Referencia,
  Tipo de Transacción, Monto). Si BAC cambia la plantilla, los correos se ignoran
  hasta ajustar el parser.

## Pendiente / fuera de alcance

- Lectura automática programada: descartada (I2); se sincroniza a mano.
- Solo Gmail; IMAP queda como alternativa futura tras la misma interfaz.
- Solo gastos con tarjeta de crédito: no importa débitos, transferencias ni
  reversos.
- (Hecho en 3.0.1) Pantalla de reglas de comercio (I6).
- Solo BAC tiene parser; otros bancos requieren un correo de ejemplo real.

## Historial

- **2026-10-08 (v1.3.0)** — Primera versión: bancos, conexión Gmail, lectura
  programada, bandeja "Por confirmar" y categorías sugeridas por comercio.
- **2026-10-11 (v2.0.0, en desarrollo)** — Un pendiente se aprueba contra
  cualquier tarjeta (bimoneda); va al saldo de la moneda de la compra.
- **2026-10-12 (v2.1.0, en desarrollo)** — Eliminar vs. desactivar banco (G5).
  Un pendiente no se aprueba con una categoría desactivada (G4).
- **2026-10-14 (v2.3.0, en desarrollo)** — La conexión de Gmail pide también
  `gmail.send` para enviar los avisos de cuota a los miembros
  ([`financiamientos.md`](./financiamientos.md)); una conexión anterior muestra
  "Reconectar para enviar avisos". Se guardan los permisos concedidos
  (`mail_connections.scopes`).
- **2026-10-18 (v3.0.1, en desarrollo)** — Se corrige el documento: la
  lectura es siempre manual (I2); la lectura programada de v1.3.1 se descartó.
- **2026-10-19 (v3.0.1, en desarrollo)** — Pantalla de reglas de comercio (I6).
  Los parsers de otros bancos y de débitos esperan correos de ejemplo.
