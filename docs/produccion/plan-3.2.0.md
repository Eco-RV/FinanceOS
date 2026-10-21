# Plan 3.2.0 — Salida a producción (early birds)

> Rama `feature/3.2.0` (sale de `dev_main`). Objetivo: que una persona que no
> es el autor pueda registrarse, entender la app en minutos y usarla con
> confianza. La Constelación pendiente pasa a la 4.0.0
> (`docs/dominio/pendientes.md`).

Hasta la 3.1.0 la app se pensó para **un solo usuario**. Los datos ya están
aislados por RLS, pero quedan supuestos de "un solo usuario" en el código, en
la configuración de Supabase/Google y en los textos legales.

## Fase 0 · Bloqueantes de multiusuario

| # | Qué | Por qué |
|---|---|---|
| 0.1 | **Formato de fecha por request.** Hoy `setDateFormat` guarda la preferencia en una variable del módulo `src/lib/format.ts`; en el servidor (Vercel) ese módulo lo comparten los requests de todos los usuarios. | Un usuario ve las fechas con el formato de otro. Pasarlo a un valor por request (`cache()` en el servidor + contexto en el cliente). |
| 0.2 | Buscar otros estados globales de módulo y supuestos de "un solo usuario" (comentarios, `CONTEXT.md`). | Mismo riesgo que 0.1. |
| 0.3 | **Auditoría de RLS** con un script SQL de solo lectura: tablas sin RLS, tablas sin las 4 policies, funciones `security definer`, buckets (`avatars` público, `receipts` privado). | Los datos de un usuario no pueden llegarle a otro. |
| 0.4 | `/api/sync-mail` (cron con service role): confirmar que filtra por `user_id` de cada conexión. | Corre fuera de RLS. |

## Fase 1 · Producción y seguridad

- **Errores**: `error.tsx`, `global-error.tsx` y `not-found.tsx` con la marca y un camino de vuelta.
- **Monitoreo de errores** (decisión: Sentry o solo logs de Vercel).
- **Cabeceras de seguridad** en `next.config.ts`: `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `X-Content-Type-Options`, `Permissions-Policy`. La CSP se deja para después por Cavos/Stellar.
- **Supabase Auth**:
  - SMTP propio (el SMTP de fábrica de Supabase manda pocos correos por hora y frena los registros).
  - Protección de contraseñas filtradas y rate limits.
  - Plantillas de correo en español con la marca.
- **Registro**: abierto o por invitación (decisión). Si es por invitación, un código por persona (tabla `early_access`).
- **Gmail**: `gmail.readonly` es un scope restringido. Sin la verificación de Google, el cliente OAuth queda en modo *Testing* (máx. 100 usuarios de prueba, que hay que dar de alta a mano). Ocultar la importación salvo para quien esté en la lista, o marcarla "beta".
- **Legal**: Términos de uso nuevos y una Política de privacidad reescrita para varios usuarios (hoy dice "uso individual"). Los redacta el agente, pero **los revisa una persona**.
- **Comentarios**: botón "Enviar comentario" (tabla `feedback`), para que los early birds reporten sin salir de la app.
- **Respaldo**: plan de Supabase con backups/PITR y un procedimiento escrito de restauración.

## Fase 2 · Constelación fuera del camino

- Interruptor de función (`constellation`): apagado por defecto. Sin él no se ve la pestaña, `/trading/*` responde 404 y no se cargan los SDK de Stellar.
- Encenderlo por usuario (Preferencias → "Funciones experimentales") o solo por variable de entorno (decisión).

## Fase 3 · Onboarding de usuario nuevo

- **Página pública en `/`** (hoy redirige a `/dashboard`): qué es Finance OS, capturas y "Crear cuenta / Entrar". Con sesión, sigue yendo al Resumen.
- **Al registrarse**: categorías sugeridas sembradas solas (hoy hay que pulsar "cargar sugeridas") y tipo de cambio del BCCR del día.
- **Primeros pasos** en el Resumen (checklist que se cierra sola): 1) primera cuenta, 2) primera tarjeta (opcional), 3) primer gasto, 4) un plan (salario) (opcional). El progreso sale de los datos, no de una tabla aparte.
- **Estados vacíos** con una acción clara en cada lista (cuentas, tarjetas, gastos, planes, ahorros…).
- Bienvenida (`WelcomeSplash`): explicar la app la primera vez, no en cada carga.

## Fase 4 · Pulido de UI/UX

- Auditoría pantalla por pantalla con las 6 leyes (`docs/diseno/leyes-ux.md`) a 375 px y en escritorio, en claro y oscuro. Los hallazgos van a una tabla en este archivo, y luego se corrigen.
- Textos: sin jerga interna (G5, M8, "Arranque de 0"…) en la UI; mensajes de error que digan qué hacer.
- Accesibilidad básica: contraste, foco visible, `aria-label` en botones de ícono, objetivos táctiles ≥ 44 px.
- Rendimiento: el layout de `(app)` hace varias lecturas en cada navegación; medir y ajustar.

## Fase 5 · Release

- `npm run lint`, `npm test` y `npm run build` en verde.
- **Guion de prueba manual del early bird**: registro → correo → primeros pasos → primer gasto → cerrar sesión → recuperar contraseña → borrar cuenta.
- SQL en `supabase/Versionamiento/3.2.0/`, CHANGELOG, historias de usuario y `CONTEXT.md` al día.

## Decisiones (2026-10-21)

1. **Registro abierto**: cualquiera con el enlace. No hay tabla `early_access`.
2. **Sentry** para errores (cliente, servidor y edge). El usuario crea el proyecto y pone el DSN en Vercel; sin DSN la app sigue igual (degrada con gracia).
3. **Constelación solo por entorno** (`NEXT_PUBLIC_FEATURE_CONSTELLATION`), apagada en producción hasta la 4.0.0.
4. **Por ahora sin dominio propio ni SMTP**: seguimos con `financeos-ten-rust.vercel.app` y el SMTP de Supabase. ⚠️ Con registro abierto, ese SMTP manda pocos correos por hora, así que la confirmación y la recuperación de contraseña pueden fallar si llegan varios a la vez. Reabrir esta decisión antes de anunciar la app.

## Historial

- **2026-10-21** — Plan inicial.
