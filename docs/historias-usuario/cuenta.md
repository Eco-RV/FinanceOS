# Cuenta y preferencias

> Ver convención general en [`README.md`](./README.md).

## Resumen

Acceso a la app (registro, confirmación por correo, inicio de sesión y
recuperación de contraseña), el perfil del usuario (nombre, usuario, país y
foto), el cambio de correo y contraseña, y las preferencias de la app. Desde
2.6.0.

## Historias de usuario

### 1. Crear mi cuenta
Como persona nueva quiero registrarme con mi correo y una contraseña, para
empezar a usar la app.

**Criterios de aceptación**
- En el login, pestaña **Crear cuenta**: nombre (opcional), correo,
  contraseña y repetirla. La contraseña muestra en vivo si cumple U4 (8+
  caracteres, letras y números) y avisa si las dos no coinciden.
- Al crearla aparece **"Revisa tu correo"** con el correo al que se mandó el
  enlace (ya no un mensaje rojo): botón **Reenviar correo** (tras 60 s), "Ya lo
  confirmé, iniciar sesión" y "Usar otro correo".
- Si el correo ya tiene cuenta, se dice y se invita a iniciar sesión.
- El nombre del registro queda en el perfil.

### 2. Confirmar mi correo
**Criterios de aceptación**
- El enlace del correo vuelve a la misma app desde donde se pidió
  (producción o local), a `/auth/confirm` (U7). Antes volvía a localhost en
  producción porque el registro no indicaba a dónde volver.
- Si el enlace se abre en el mismo navegador, entra directo al Resumen con la
  bienvenida "¡Cuenta confirmada!". Si se abre en otro dispositivo, el correo
  queda confirmado y el login lo dice.
- Un enlace vencido o ya usado lleva al login con el aviso.

### 3. Iniciar sesión y recuperar la contraseña
**Criterios de aceptación**
- Botón para ver la contraseña. Mensajes claros: datos incorrectos, correo sin
  confirmar (con "Reenviar correo") o demasiados intentos.
- **¿La olvidaste?** pide el correo y manda un enlace; no dice si el correo
  existe. El enlace abre **Contraseña nueva** (`/auth/restablecer`), que no pide
  la actual (U4, solo con sesión de recuperación).

### 4. Mi perfil
Como usuario quiero guardar mi nombre, usuario, país y foto, para que la app
me reconozca.

**Criterios de aceptación**
- **Ajustes → Mi cuenta** (también desde el menú del avatar): foto (subir,
  cambiar o quitar; se recorta al centro a 512 px), nombre, usuario (@, único,
  U1), país (con bandera) y el correo (solo lectura).
- La barra superior y el menú muestran la foto (o las iniciales del nombre) y
  el nombre; la bienvenida saluda por el nombre.

### 5. Cambiar mi correo
**Criterios de aceptación**
- Se escribe el correo nuevo; llega un enlace para confirmarlo (U5). Hasta
  abrirlo se sigue entrando con el actual. Al confirmarlo, Mi cuenta avisa
  "Tu correo se actualizó".

### 6. Cambiar mi contraseña
**Criterios de aceptación**
- Pide la actual, la nueva y repetirla; valida U4 y que la actual sea
  correcta.

### 7. Preferencias de la app
**Criterios de aceptación**
- **Ajustes → Preferencias**: tema **Sistema / Claro / Oscuro** (en este
  dispositivo) y accesos a las configuraciones que ya existen (Categorías,
  Tipo de cambio, Bancos). Moneda base y formato de fecha figuran como
  "Próximamente".
- El perfil guarda `preferences` (jsonb) para sumar ajustes sin migrar.

### 8. Entrar con Google (3.1.0)
Como usuario quiero entrar con mi cuenta de Google, sin otra contraseña.

**Criterios de aceptación**
- En el login (pestañas Iniciar sesión y Crear cuenta) → **Continuar con
  Google** (U10). Vuelve a la app por `/auth/confirm` y entra.
- Si el proveedor no está activo, vuelve al login con un aviso y se puede usar
  el correo.
- Para que funcione hay que activar Google en Supabase → Authentication →
  Providers (cliente OAuth de Google Cloud con la URL de callback de
  Supabase).

### 9. Borrar mi cuenta (3.1.0)
Como usuario quiero borrar mi cuenta y todos mis datos.

**Criterios de aceptación**
- Ajustes → Cuenta → **Borrar la cuenta** (al final, en rojo): escribir
  ELIMINAR y la contraseña actual (U8). Se borran los datos y los archivos, se
  cierra la sesión y el login lo confirma.
- Necesita `SUPABASE_SERVICE_ROLE_KEY` en el servidor.

### 10. Moneda base y formato de fecha (3.1.0)
Como usuario quiero elegir mi moneda principal y cómo se ven las fechas.

**Criterios de aceptación**
- Ajustes → Preferencias → **Moneda y fechas** (U9): moneda base (colones o
  dólares) y formato de fecha (18 oct 2026 · 18/10/2026 · 18 de octubre de
  2026). Se guardan al elegir, en el perfil.
- La moneda base es con la que abre el gasto rápido; con USD el Resumen
  muestra además el patrimonio en dólares. Las fechas cambian en toda la app.

## Reglas de negocio

- U1–U7 en [`docs/dominio/reglas.md`](../dominio/reglas.md).
- El perfil es de cada usuario (RLS); la foto vive en Storage
  (`avatars/<user_id>/`), pública para poder mostrarla.

## Pendiente / fuera de alcance

- (Hecho en 3.1.0) Entrar con Google (U10), borrar la cuenta (U8), moneda base y formato de fecha (U9).
- El tema sigue siendo por dispositivo (moneda y fecha ya viajan con la cuenta).

## Historial

- **2026-10-14 (v2.6.0)** — Archivo nuevo: registro con
  confirmación por correo, recuperar contraseña, perfil con foto, cambio de
  correo y contraseña, y preferencias.
- **2026-10-19 (v3.1.0, en desarrollo)** — Entrar con Google (U10), borrar
  la cuenta (U8) y moneda base y formato de fecha (U9).
