# Guía de producción (3.2.0)

Lo que hay que configurar **fuera del código** para abrir Finance OS a los
primeros usuarios. Cada paso dice dónde se hace y cómo comprobarlo. Plan
general en [`plan-3.2.0.md`](./plan-3.2.0.md).

## 1. Supabase · base de datos

1. Correr en el SQL Editor, en orden, `supabase/Versionamiento/3.2.0/`:
   - `00_auditoria_rls.sql`: solo lee. Revisar que cada bloque dé lo esperado
     (lo dice el comentario de cada uno).
   - `01_feedback.sql`: buzón de comentarios. ✅ Ya corrido (2026-10-21).
   - `02_feedback_admin.sql`: rol admin con tu correo. ✅ Ya corrido.
2. **Región**: en Settings → General, anotar la región del proyecto. La de las
   funciones de Vercel debe ser la misma o la más cercana (ver §4).

## 2. Supabase · autenticación

En **Authentication**:

| Dónde | Qué poner | Por qué |
|---|---|---|
| Sign In / Providers → Email | *Confirm email* encendido; contraseña mínima 8 | Coincide con U4 y U7. |
| Attack Protection | **Leaked password protection** encendido | Rechaza contraseñas filtradas (Have I Been Pwned). Requiere plan Pro; si no está disponible, queda anotado. |
| Attack Protection | CAPTCHA: opcional (Turnstile) | Con registro abierto ayuda contra bots. Si se activa, hay que agregar el widget en el formulario (no está hecho). |
| Rate Limits | Dejar los de fábrica y revisar *emails sent per hour* | Con el SMTP de Supabase son muy pocos correos por hora (ver §3). |
| URL Configuration | Site URL `https://financeos-ten-rust.vercel.app`; Redirect URLs `https://financeos-ten-rust.vercel.app/**` y `http://localhost:3000/**` | Ya configurado (2.6.0). Agregar el dominio propio cuando exista. |
| JWT Keys | Llaves asimétricas (ya activas) | La sesión se valida en local (Fase 1.2). |

### Plantillas de correo en español

En **Authentication → Emails → Templates**. Usan `{{ .ConfirmationURL }}`,
que la ruta `/auth/confirm` ya acepta (PKCE).

**Confirm signup** · Asunto: `Confirma tu cuenta de Finance OS`

```html
<h2>¡Bienvenido a Finance OS!</h2>
<p>Confirma tu correo para empezar a ordenar tus tarjetas y no volver a pagar intereses.</p>
<p><a href="{{ .ConfirmationURL }}">Confirmar mi cuenta</a></p>
<p>Si no creaste una cuenta, ignora este correo.</p>
```

**Reset password** · Asunto: `Restablece tu contraseña de Finance OS`

```html
<h2>Restablece tu contraseña</h2>
<p>Pediste cambiar la contraseña de tu cuenta de Finance OS. El enlace vence en una hora.</p>
<p><a href="{{ .ConfirmationURL }}">Elegir una contraseña nueva</a></p>
<p>Si no lo pediste, ignora este correo: tu contraseña no cambia.</p>
```

**Change email address** · Asunto: `Confirma tu correo nuevo en Finance OS`

```html
<h2>Confirma tu correo nuevo</h2>
<p>Pediste cambiar el correo de tu cuenta de {{ .Email }} a {{ .NewEmail }}.</p>
<p><a href="{{ .ConfirmationURL }}">Confirmar el cambio</a></p>
<p>Si no lo pediste, ignora este correo y tu cuenta sigue igual.</p>
```

## 3. Correo (SMTP)

Decisión de la 3.2.0: **por ahora el SMTP de Supabase**. ⚠️ Manda muy pocos
correos por hora; si varios early birds se registran o piden recuperar la
contraseña al mismo tiempo, algunos no recibirán el correo. Antes de anunciar
la app: dominio propio + un SMTP (Resend, Postmark o similar) en
Authentication → Emails → SMTP Settings.

## 4. Vercel

| Dónde | Qué | Valor |
|---|---|---|
| Settings → Functions → Region | Región de las funciones | La misma de Supabase (§1.2). |
| Settings → Environment Variables (Production) | `NEXT_PUBLIC_SENTRY_DSN` | El DSN del proyecto de Sentry (§5). |
| | `NEXT_PUBLIC_FEATURE_CONSTELLATION` | **No poner** (la Constelación queda apagada hasta la 4.0.0). |
| | `PERF_LOG`, `NEXT_PUBLIC_PERF_LOG` | No poner (solo para medir). |

Después de cambiar variables, hacer un *Redeploy*.

## 5. Sentry (errores)

1. Crear un proyecto **Next.js** en sentry.io (plan gratis).
2. Copiar el **DSN** (Settings → Client Keys) a `NEXT_PUBLIC_SENTRY_DSN` en
   Vercel. Es público por diseño.
3. Redeploy. Para comprobarlo, provocar un error en el preview (por ejemplo,
   abrir una URL que falle) y verlo en Issues.

La app no manda datos del usuario ni del request a Sentry
(`src/lib/sentry-options.ts`): solo el error, su traza y la ruta. Sin source
maps subidos, las trazas del navegador salen minificadas; si hace falta, se
agrega `withSentryConfig` con un token de Sentry más adelante.

## 6. Gmail (importar compras, beta)

`gmail.readonly` es un **scope restringido**. Sin la verificación de Google, el
cliente OAuth queda en modo **Testing**: solo pueden conectar Gmail hasta 100
usuarios de prueba que se agregan a mano en Google Cloud → APIs & Services →
OAuth consent screen → Test users. Por eso en "Más funciones" la función está
marcada **beta**. A un early bird que la pida: agregarlo como usuario de prueba.

### Outlook (3.3.0)

Lectura de avisos desde Outlook **personal** (outlook.com, hotmail, live) por
Microsoft Graph, solo lectura:

1. Azure Portal → Microsoft Entra ID → App registrations → New registration,
   tipo de cuenta **"Personal Microsoft accounts only"**.
2. Redirect URI (Web): `https://financeos-ten-rust.vercel.app/api/outlook/callback`
   y `http://localhost:3000/api/outlook/callback`.
3. API permissions → Microsoft Graph → Delegated: `Mail.Read`, `User.Read`,
   `offline_access`.
4. Certificates & secrets → New client secret (anotar su vencimiento: al
   vencer, las conexiones de Outlook fallan y la página pide reconectar).
5. Variables `MICROSOFT_CLIENT_ID` (Application ID) y `MICROSOFT_CLIENT_SECRET`
   en Vercel y `.env.local`.

Cada usuario tiene **una** conexión de correo: conectar Outlook reemplaza a
Gmail. Los avisos de cuota por correo (F8) siguen saliendo solo desde Gmail.

## 7. Respaldos

- **Plan gratis de Supabase**: sin respaldos automáticos descargables. Hacer un
  respaldo manual antes de cada release y cada semana mientras haya early
  birds:

  ```bash
  npx supabase db dump --db-url "$SUPABASE_DB_URL" -f respaldo-$(date +%F).sql
  npx supabase db dump --db-url "$SUPABASE_DB_URL" --data-only -f datos-$(date +%F).sql
  ```

  `SUPABASE_DB_URL` = cadena de conexión de Settings → Database (no
  guardarla en el repo). Los archivos van a un lugar privado, nunca al repo.
- **Plan Pro**: respaldos diarios automáticos (7 días) y, con el complemento,
  PITR. Recomendado cuando haya usuarios que dependan de la app.
- **Restaurar**: en un proyecto nuevo de Supabase, correr el respaldo de
  esquema y después el de datos (`psql "$NUEVA_DB_URL" -f …`), apuntar las
  variables de Vercel al proyecto nuevo y redeploy. Probarlo una vez antes de
  necesitarlo.

## 8. Antes de anunciar

- [ ] §1 auditoría sin hallazgos.
- [ ] §2 plantillas en español y leaked password protection (si el plan lo permite).
- [ ] §3 SMTP propio (o aceptar el riesgo con pocos early birds).
- [ ] §4 región y variables en Vercel.
- [ ] §5 Sentry recibiendo un error de prueba.
- [ ] §7 primer respaldo hecho y guardado.
- [ ] Términos y Privacidad revisados por una persona (`/terminos`, `/privacidad`).
