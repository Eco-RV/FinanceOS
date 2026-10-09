# Bancos y correos de compras

> Ver convención general en [`README.md`](./README.md).

## Resumen

Importa automáticamente las compras con tarjeta desde los avisos que envía el
banco por correo. El usuario registra sus bancos (remitentes + formato del
correo), conecta su Gmail en modo solo lectura y un proceso programado lee los
avisos nuevos cada pocas horas **sin IA ni tokens** (un parser determinístico por
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
- Se gestiona en `/ajustes/bancos` (crear, editar, eliminar, pausar).
- Pausar un banco (`enabled = false`) deja de leer sus correos sin borrarlo.

### 2. Conectar mi correo
Como usuario quiero conectar mi Gmail con permiso solo de lectura, para que la
app pueda leer los avisos de mis bancos sin conocer mi contraseña.

**Criterios de aceptación**
- Flujo OAuth de Google con el permiso `gmail.readonly` (no puede enviar ni
  borrar correos). El token de larga duración se guarda **cifrado**
  (AES-256-GCM) y nunca viaja al navegador.
- `/ajustes/bancos` muestra el correo conectado, la fecha de la última lectura
  y permite desconectarlo (borra el token).
- Solo se descargan correos cuyo remitente esté en un banco activo.

### 3. Lectura automática de compras
Como usuario quiero que las compras con tarjeta se detecten solas, para no
registrarlas a mano.

**Criterios de aceptación**
- Un workflow de GitHub Actions llama cada 2 horas a `/api/sync-mail` (protegida
  con un secreto Bearer, `CRON_SECRET`).
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
- Solo se ofrecen tarjetas de la **misma moneda** de la compra (no hay
  conversión).
- Descartar marca el pendiente `rejected`; no crea gasto.
- "Sincronizar" lee el correo en el momento, sin esperar al cron.

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

- Solo Gmail; IMAP queda como alternativa futura tras la misma interfaz.
- Solo gastos con tarjeta de crédito: no importa débitos, transferencias ni
  reversos.
- No hay pantalla para editar o borrar reglas de comercio.
- Solo BAC tiene parser; otros bancos requieren un correo de ejemplo real.

## Historial

- **2026-10-08 (v1.3.0)** — Primera versión: bancos, conexión Gmail, lectura
  programada, bandeja "Por confirmar" y categorías sugeridas por comercio.
