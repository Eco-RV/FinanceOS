# Plan 3.2.0 — Salida a producción (early birds)

> Rama `feature/3.2.0` (sale de `dev_main`). Objetivo: que una persona que no
> es el autor pueda registrarse, resolver **un problema concreto** en minutos
> y descubrir el resto de la app con el uso. La Constelación pendiente pasa a
> la 4.0.0 (`docs/dominio/pendientes.md`).

Hasta la 3.1.0 la app se pensó para **un solo usuario** y muestra todas sus
funciones a la vez. Para un usuario nuevo es demasiado. La 3.2.0 cambia el
enfoque: **una promesa, un camino y funciones que llegan cuando sirven**.

## La promesa: "No vuelvas a pagar intereses en tus tarjetas"

Es lo más propio de Finance OS (corte, fecha de pago, monto de contado,
cobertura con el débito) y responde a la pregunta que todos se hacen:
**¿cuánto tengo que pagar, para cuándo y me alcanza?**

## Fases

| Fase | Qué | Por qué en este orden |
|---|---|---|
| 0 | Bloqueantes de multiusuario | Sin esto, dos usuarios se pisan. |
| 1 | Velocidad y fluidez | Afecta a todo lo demás; se mide antes de cambiar. |
| 2 | Enfoque y funciones por logros | Es la experiencia del early bird. |
| 3 | Buzón de comentarios | Es el canal para escucharlos desde el día 1. |
| 4 | Producción y seguridad | Lo mínimo para abrir el registro. |
| 5 | Pulido de UI/UX | Sobre la app ya enfocada. |
| 6 | Release | Prueba manual, docs y SQL. |

## Fase 0 · Bloqueantes de multiusuario

| # | Qué | Por qué |
|---|---|---|
| 0.1 | **Formato de fecha por request.** Hoy `setDateFormat` guarda la preferencia en una variable del módulo `src/lib/format.ts`, y en el servidor ese módulo lo comparten los requests de todos los usuarios. | Un usuario ve las fechas con el formato de otro. Pasarlo a un valor por request (`cache()` en el servidor + contexto en el cliente). |
| 0.2 | Buscar otros estados globales de módulo y supuestos de "un solo usuario" (código, comentarios, `CONTEXT.md`). | Mismo riesgo que 0.1. |
| 0.3 | **Auditoría de RLS** con un script SQL de solo lectura: tablas sin RLS o sin las 4 policies, funciones `security definer`, buckets (`avatars` público, `receipts` privado). | Los datos de un usuario no pueden llegarle a otro. |
| 0.4 | `/api/sync-mail` (cron con service role): confirmar que filtra por el `user_id` de cada conexión. | Corre fuera de RLS. |

## Fase 1 · Velocidad y fluidez

Síntoma: desde que se toca un botón o una pestaña hasta que abre la página
pasa demasiado tiempo. **Primero se mide y después se cambia.**

**1.1 Medir (línea base).** Con Sentry (tracing) y un `Server-Timing` en el servidor: tiempo del proxy, de la autenticación y de cada lectura en Resumen, Procesos, Tarjetas, detalle de tarjeta y Gastos. Se mide en el celular, con build de producción. Los números quedan en este archivo.

**1.2 Causas probables** (revisando el código):

| Causa | Dónde | Cambio |
|---|---|---|
| **Dos viajes a Supabase Auth por navegación**: `auth.getUser()` en el proxy y otra vez en `getUser()` de la página. | `src/lib/supabase/proxy.ts`, `src/lib/auth.ts` | `auth.getClaims()`: valida el JWT en local si el proyecto usa llaves asimétricas (JWT Signing Keys; las activas tú en Supabase). Un solo `getUser()` donde de verdad haga falta. |
| **Sincronizaciones en el camino crítico**: planes (`ensurePlansUpToDate`) en el layout, y planes + tipo de cambio del BCCR (llamada HTTP externa) en el Resumen, antes de leer los datos. | `(app)/layout.tsx`, `dashboard/page.tsx`, `src/lib/sync-plans.ts` | Una vez al día por usuario (marca de "última sincronización") y fuera del render con `after()`. |
| **Lecturas en cascada**: el Resumen hace 4 tandas seguidas (sync → datos → tableros → perfil → ajustes de préstamos). | `dashboard/page.tsx` y otras | Una sola tanda en paralelo, y `Suspense` por sección para que la página aparezca y lo pesado llegue después. |
| **Un solo esqueleto genérico** (`(app)/loading.tsx`) para todas las rutas. | `src/app/(app)/` | Un `loading.tsx` por sección con la forma de su página, para que el cambio de pantalla sea inmediato (prefetch parcial de rutas dinámicas). |
| **Revalidar todo el layout** después de una acción (`revalidatePath("/", "layout")`, 5 lugares): vuelve a correr el layout con todas sus lecturas. | `src/app/(app)/**/actions.ts` | Revalidar solo las rutas afectadas. |
| **Región**: si la función de Vercel y la base de Supabase están en regiones distintas, cada consulta paga la distancia. | Vercel / Supabase | Verificar las dos regiones y ponerlas juntas. |
| **Animaciones de entrada lentas**: `rise` dura 520 ms + 55 ms por fila, así que el contenido "llega tarde" aunque ya esté. | `src/app/globals.css` | ~200 ms y un tope a la cascada. |
| **JavaScript del layout**: los dos formularios del botón flotante (gasto e ingreso) se cargan en todas las páginas. | `(app)/layout.tsx` | Cargar el diálogo al abrirlo (`next/dynamic`) y revisar el tamaño del bundle. |

**1.3 Objetivo.** Respuesta visual al toque en < 100 ms (estado "cargando" en el botón o la pestaña) y contenido de la página en < 1 s (p75, celular en 4G). Se vuelve a medir y se anota el antes y el después.

## Fase 2 · Enfoque y funciones por logros

**2.1 El camino del early bird** ("Primeros pasos" en el Resumen; se cierra solo):
1. **Agrega tu tarjeta**: banco, día de corte, día de pago, límite y saldo de hoy.
2. **Agrega la cuenta con la que la pagas** (débito) y su saldo.
3. **Mira tu primer resultado**: cuánto pagar de contado, para cuándo y si el débito alcanza (cobertura y faltante).
4. **Registra tus compras con la tarjeta** (gasto rápido).
5. **Registra el pago de la tarjeta** → logro "Sin intereses este corte".

El avance sale de los datos (¿hay tarjeta?, ¿hay pago?), no de una tabla aparte.

**2.2 Modo enfocado.** Un usuario nuevo ve solo el núcleo:
- **Resumen**: pagos próximos, monto de contado, cobertura/faltante y próximos cortes.
- **Tarjetas**, **Cuentas** y **Gastos**.
- **Gasto rápido**.

Lo demás está apagado, pero no bloqueado.

**2.3 Funciones por logros + catálogo.**
- Catálogo "Más funciones" (en Procesos y en Ajustes): cada función con una línea de qué resuelve y un botón **Activar**. Se puede activar o apagar cualquiera en cualquier momento.
- Sugerencias por logro: una tarjeta discreta en el Resumen, una a la vez y descartable (ley de ceguera a banners). Ejemplos:

| Logro | Sugiere |
|---|---|
| Primer pago de tarjeta | **Planes**: tu salario y gastos fijos, para saber si te alcanza el mes. |
| 10 gastos registrados | **Gastos por categoría** y comparar períodos. |
| Una compra a tasa 0 o con cuotas | **Financiamientos**. |
| Primer ingreso | **Ahorros y metas**. |
| Un gasto con otra persona | **Gastos compartidos** y **Miembros**. |
| Varias compras por mes | **Importar desde Gmail** (beta). |

- Funciones del catálogo: Ingresos y transferencias, Planes, Financiamientos, Préstamos, Ahorros y metas, Gastos compartidos, Cobros y miembros, Importar desde Gmail (beta), Tipo de cambio manual, Verificar saldos y Arranque de 0. La **Constelación no aparece**: se enciende solo por entorno (`NEXT_PUBLIC_FEATURE_CONSTELLATION`, apagada en producción hasta la 4.0.0; sin ella, `/trading` da 404 y no se cargan los SDK de Stellar).
- Se guarda en `profiles.preferences.features` (jsonb, sin SQL nuevo). Un usuario que ya tiene datos de una función la tiene encendida (tu cuenta queda como hoy).
- Dominio: `src/domain/account/features.ts` (catálogo, funciones activas según preferencias y uso, siguiente sugerencia), con su `*.test.ts`.
- Una función apagada no se ve en la navegación, pero su URL sigue funcionando.

**2.4 Entrada.**
- **Página pública en `/`** con la promesa, 3 capturas del camino y "Crear cuenta / Entrar". Con sesión, va al Resumen.
- **Al registrarse**: categorías sugeridas sembradas solas y tipo de cambio del día.
- **Estados vacíos** con una acción clara en cada lista.
- La bienvenida (`WelcomeSplash`) se muestra la primera vez, no en cada carga.

## Fase 3 · Buzón de comentarios

Un lugar **propio y tranquilo** para que cada usuario cuente su experiencia, pregunte o pida mejoras. No hay ventanas emergentes ni avisos que interrumpan.

- **Qué se publica.** Tipos: Experiencia · Duda · Mejora · Me gustaría que tuviera. Llevan un título, un texto y, opcionalmente, una captura (bucket privado).
- **Privado.** Cada usuario ve solo lo suyo y tus respuestas; nadie más lo lee. Siempre va **con el nombre** del perfil.
- **Conversación.** Cada publicación es un hilo: tú respondes y el usuario puede contestar.
- **Estados**: Recibido → En revisión → En planes → Hecho (o "No por ahora", con el motivo).
- **No invasivo.** Se entra desde el menú del usuario, desde Ajustes y con un enlace discreto al pie del Resumen ("¿Algo que contarnos?"). Solo hay un punto en el menú cuando tienes una respuesta sin leer.
- **Tu bandeja (admin).** Una vista que solo ves tú, con todas las publicaciones por tipo y estado, para responder y cambiar el estado. El rol admin va en `app_metadata.role = 'admin'`: lo pone un SQL y el usuario no lo puede cambiar. Las policies lo leen de `auth.jwt()`.
- **Datos.** Tablas `feedback_posts` y `feedback_messages`, con RLS: el usuario lee y escribe lo suyo y el admin lee todo y responde. SQL en `supabase/Versionamiento/3.2.0/`.
- **Dominio y código.** `src/domain/feedback/` (tipos, estados, transiciones válidas), caso de uso en `src/application/feedback.ts`, puerto + adaptador Supabase. Historia de usuario nueva: `docs/historias-usuario/comentarios.md`.
- **Aviso al admin.** Más adelante, un correo cuando llega una publicación nueva (puerto `Mailer`). En la 3.2.0 basta con el contador en tu bandeja.

## Fase 4 · Producción y seguridad

- **Errores**: `error.tsx`, `global-error.tsx` y `not-found.tsx` con la marca y un camino de vuelta.
- **Sentry**: errores y rendimiento (lo usa la Fase 1). Sin DSN, la app sigue igual.
- **Cabeceras de seguridad** en `next.config.ts`: `frame-ancestors`/`X-Frame-Options`, `Referrer-Policy`, `X-Content-Type-Options`, `Permissions-Policy`. La CSP se deja para después.
- **Supabase Auth**: protección de contraseñas filtradas, rate limits y plantillas de correo en español con la marca.
- **Gmail**: `gmail.readonly` es un scope restringido. Sin la verificación de Google, el cliente OAuth queda en *Testing* (máx. 100 usuarios de prueba, que se dan de alta a mano). En el catálogo es "beta" y explica eso.
- **Legal**: Términos de uso nuevos y una Política de privacidad reescrita para varios usuarios (hoy dice "uso individual"). Los redacta el agente; **los revisa una persona**.
- **Respaldo**: backups/PITR en Supabase y un procedimiento escrito de restauración.

## Fase 5 · Pulido de UI/UX

- Auditoría pantalla por pantalla con las 6 leyes (`docs/diseno/leyes-ux.md`) a 375 px y en escritorio, en claro y oscuro, empezando por el camino del early bird. Los hallazgos van a una tabla en este archivo, y luego se corrigen.
- Textos: sin jerga interna (G5, M8, "Arranque de 0"…) en la UI; los errores dicen qué hacer.
- Accesibilidad básica: contraste, foco visible, `aria-label` en botones de ícono, objetivos táctiles ≥ 44 px.

## Fase 6 · Release

- `npm run lint`, `npm test` y `npm run build` en verde.
- **Guion de prueba manual del early bird**: registro → correo → primeros pasos (tarjeta, cuenta, resultado, gasto, pago) → activar una función sugerida → publicar en el buzón → recuperar contraseña → borrar cuenta.
- Medición de velocidad final contra la línea base de la Fase 1.
- SQL en `supabase/Versionamiento/3.2.0/`, CHANGELOG, historias de usuario, glosario (Función, Logro, Buzón) y `CONTEXT.md` al día.

## Decisiones (2026-10-21)

1. **Promesa**: no pagar intereses en las tarjetas.
2. **Funciones**: por logros + catálogo; no se bloquea nada.
3. **Comentarios**: buzón privado (usuario ↔ admin), siempre con nombre.
4. **Registro abierto**: cualquiera con el enlace.
5. **Sentry** para errores y rendimiento. Tú creas el proyecto y pones el DSN en Vercel.
6. **Constelación solo por entorno**, apagada en producción hasta la 4.0.0.
7. **Por ahora sin dominio propio ni SMTP**: seguimos con `financeos-ten-rust.vercel.app` y el SMTP de Supabase. ⚠️ Con registro abierto, ese SMTP manda pocos correos por hora, así que la confirmación y la recuperación de contraseña pueden fallar si llegan varios a la vez. Reabrir esta decisión antes de anunciar la app.

## Lo que te toca a ti (fuera del código)

- Supabase: activar JWT Signing Keys (Fase 1), ver la región del proyecto, correr el SQL de la 3.2.0 y ponerte `app_metadata.role = 'admin'`.
- Vercel: ver la región de las funciones, poner el DSN de Sentry y `NEXT_PUBLIC_FEATURE_CONSTELLATION`.
- Revisar los textos legales.

## Historial

- **2026-10-21** — Plan inicial.
- **2026-10-21** — Ajuste: promesa única (no pagar intereses) y funciones por logros; buzón de comentarios privado; fase de velocidad antes de lo demás.
