# Finance OS — contexto para agentes

Léelo junto con `AGENTS.md` (advertencia de Next.js 16) antes de tocar código.

## Qué es

App personal de finanzas, **un solo usuario**, construida **paso a paso**: se
despliega una rebanada mínima y se añaden módulos según haga falta. Cubre (o
cubrirá) cortes/pagos de tarjetas de crédito, financiamientos, préstamos, gastos,
saldos de cuentas de débito y ahorros.

- GitHub: `Eco-RV/FinanceOS` (privado, rama por defecto `main`).
- Supabase project ref: `kruywmrwstrdvxxdzkcd`. Deploy: Vercel.
- `.env.local` es un placeholder; el usuario crea el proyecto Supabase y aplica la
  migración.
- **Documentación funcional**: `docs/historias-usuario/` tiene las historias de
  usuario por proceso principal (Cuentas, Tarjetas, Gastos, Ingresos, Bancos — un
  archivo por proceso). Es un documento vivo: cualquier cambio de
  comportamiento en esos módulos se refleja ahí en el mismo cambio, igual que
  se mantiene este archivo. Ver la convención completa en
  `docs/historias-usuario/README.md`.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 ·
shadcn/ui sobre `@base-ui/react` · Supabase (`@supabase/ssr`, Auth email+password,
Postgres + RLS) · Zod v4 · sonner (toasts) · next-themes.

## Arquitectura y convenciones

| Área | Archivo(s) | Notas |
|------|-----------|-------|
| Middleware | `src/proxy.ts` | Next 16 renombró `middleware` → `proxy`. Delega en `updateSession` de `src/lib/supabase/proxy.ts`: refresca la sesión y protege rutas. El `matcher` excluye `favicon.ico` y `manifest.webmanifest` para que la instalación funcione sin sesión. |
| Clientes Supabase | `src/lib/supabase/{client,server,proxy}.ts` | browser / server component / middleware respectivamente. |
| DAL / auth | `src/lib/auth.ts` | `getUser()` memoizado con `cache()`, devuelve `null` si no hay env o falla. `requireUser()` redirige a `/login`. Úsalos en páginas y actions protegidas. |
| Server Actions | `src/app/(app)/<modulo>/actions.ts` | `"use server"`. Devuelven `FormResult` (`src/lib/forms.ts`). Patrón: `requireUser()` → `schema.safeParse(Object.fromEntries(formData))` → si falla `fieldErrors()` → insert/update por `id` → `revalidatePath()` de la ruta y `/dashboard`. Sesión: `signOutAction()` en `src/lib/session-actions.ts`. Movimientos: `saveTransaction` / `deleteTransaction` compartidas en `src/app/(app)/procesos/_transactions/actions.ts` — el saldo de la cuenta/tarjeta lo ajusta un **trigger de Postgres**, no la action; la action solo copia la `currency` del origen y valida (p. ej. misma moneda en un `card_payment`). |
| Validación | `src/lib/schema.ts` | Zod: `accountSchema`, `creditCardSchema`, `transactionSchema` (con `superRefine` por tipo; el origen viaja como `"account:<id>"` / `"card:<id>"`), `categorySchema` + tipos inferidos. `ACCOUNT_TYPES`, `CURRENCIES`, `TRANSACTION_TYPES`, `CATEGORY_KINDS`, `EXPENSE_CATEGORIES` / `INCOME_CATEGORIES` (ahora **lista sugerida / fallback** — las reales viven en la tabla `categories`). |
| Formularios CRUD en diálogo | `src/lib/use-dialog-form.ts` + `<modulo>/{account,card,category}-form.tsx`, `procesos/_transactions/transaction-form.tsx` | Componentes de apoyo: `src/components/form-field.tsx`, `delete-button.tsx`, `ui/dialog.tsx`. `TransactionForm` (un solo diálogo con prop `type`) sirve gastos, ingresos y pagos de tarjeta; recibe `categories: string[]` por prop desde la página. |
| Movimientos | `src/lib/transactions.ts` + `src/app/(app)/procesos/_transactions/` | Helpers puros: `signedAmount`, `parseOrigin`, `originValue`, `originLabel`. `_transactions/` (carpeta privada `_`): `actions.ts`, `transaction-form.tsx`, `transaction-list.tsx` (tabla reutilizable, `context` `"list"`/`"card"`), `transaction-row-actions.tsx`. |
| Categorías | `src/lib/categories.ts` + tabla `categories` + `src/app/(app)/ajustes/categorias/` | `categoryNames(rows, fallback)` → nombres del usuario o la lista sugerida si no tiene ninguna. Sub-página con CRUD por diálogo + botón "cargar sugeridas" (`seedCategories`). `gastos`/`ingresos`/`tarjetas/[id]` hacen el fetch y lo pasan a `TransactionForm`/`TransactionList`. |
| Fecha "hoy" | `src/lib/dates.ts` | `crToday()` → día calendario actual en `America/Costa_Rica` (UTC-6, sin DST) como Date a medianoche local. Es el default de `from` en `cards.ts` y `daysUntil`, para no depender de la zona del servidor (Vercel = UTC). `toISODate(Date)` → `"YYYY-MM-DD"` con componentes locales (default del `<input type="date">` de los movimientos). |
| Lógica de tarjetas | `src/lib/cards.ts` | `nextCutoffDate`, `nextPaymentDate`, `lastCutoffDate`, `paymentDueForCutoff` (clamp de día en meses cortos). `cardStatement(card, txns, from)` → estado de cuenta del corte vigente: `statementBalance` (saldo de contado = cargos − pagos **con fecha <= último corte**), `paidAfterCutoff`, `dueAmount` (falta pagar antes de `dueDate` para no generar intereses), `newCharges` (consumo posterior al corte), `status` (`sin-movimientos`/`sin-saldo`/`al-dia`/`pendiente`/`atrasada`), `daysToDue`. |
| Formato es-CR | `src/lib/format.ts` | `formatCurrency` (default `CRC`, símbolo ₡ forzado con `narrowSymbol`), `formatDate` (una string `"YYYY-MM-DD"` se lee como día local, no UTC), `daysUntil` (`from = crToday()`), `relativeDayLabel` ("hoy" / "mañana" / "en 5 días" / "hace 2 días"). Monedas soportadas: `CRC` (default) y `USD` — ver `CURRENCIES` en `src/lib/schema.ts`. |
| Resumen / dashboard | `src/app/(app)/dashboard/page.tsx` | Server component; calcula contra `crToday()`. Trae cuentas + tarjetas + movimientos de tarjeta y arma un `cardStatement` por tarjeta. Los montos "a pagar" son **de contado** (`dueAmount`), no `current_balance`. Secciones: banner de atraso (si hay tarjetas `atrasada`), stats (disponible débito · a pagar de contado · consumo sin cortar), callout de cobertura vs. débito, "Pagos de contado" agrupados (**Atrasadas** / **Por vencer**) y "Próximos cortes". |
| Tipos de dominio | `src/lib/types.ts` | `Account`, `CreditCard`, `Transaction` (`TransactionType`), `Category` (`CategoryKind`), `Financing`. |
| Financiamientos (tasa 0) | `src/app/(app)/procesos/tarjetas/_financiamientos/` + tabla `financings` + SP `create_financing` | Compra a cuotas sin interés sobre una tarjeta: `FinancingForm` (descripción, categoría, monto total, meses, fecha de primera cuota) llama `createFinancing` → `supabase.rpc('create_financing', ...)`, que crea la fila en `financings` y de una vez las N cuotas como `transactions` tipo `expense` (`financing_id`, `installment_no`, `note` con "cuota i/N"), fechadas mes a mes con el mismo día de la compra (clamp en meses cortos, igual que `clampDay` de `cards.ts`). El trigger de saldo ya existente suma el total al `current_balance` de inmediato. `FinancingList` muestra los planes activos y los borra completos (`deleteFinancing`, cascade). Solo crear/borrar — no hay edición ni cancelación parcial. |
| Importación desde correo | `src/lib/mail/` (`gmail.ts`, `crypto.ts`, `sync.ts`, `merchants.ts`, `html.ts`, `parsers/`) + `src/app/api/{sync-mail,gmail/connect,gmail/callback}/route.ts` + `src/lib/supabase/admin.ts` | Lee avisos de compra de los bancos (tabla `banks`: remitentes + `parser_key`) por Gmail API readonly, **sin IA**: un parser determinístico por banco (`parsers/index.ts` = registro; contrato `MailParser` en `types.ts`). `syncConnection` es idempotente (`unique (user_id, source_message_id)`), casa la tarjeta por `credit_cards.last_four` (+ `bank_id` si hay choque) y deja el resultado en `pending_transactions`. El refresh token se guarda cifrado (AES-256-GCM, `MAIL_TOKEN_KEY`). `/api/sync-mail` es pública en `proxy.ts` pero exige `Authorization: Bearer CRON_SECRET`, corre con service role y está pensada para que la llame un cron externo; en v1.3.0 la sincronización es manual (botón "Sincronizar") y el workflow de GitHub Actions cada 2 h queda para v1.3.1. Los imports dentro de `src/lib/mail/` llevan extensión `.ts` para que `node --test` los corra sin dependencias (`allowImportingTsExtensions`). |
| Bancos / Por confirmar | `src/app/(app)/ajustes/bancos/` + `src/app/(app)/procesos/pendientes/` | `/ajustes/bancos`: CRUD de bancos + conectar/desconectar Gmail. `/procesos/pendientes`: aprobar (crea `expense` en la tarjeta + aprende `merchant_rules`) o descartar; `syncNow` = misma sincronización con la sesión del usuario. |
| Rutas | `src/app/login/` (auth), grupo `src/app/(app)/` (protegido: `layout.tsx` llama `requireUser()`): `/dashboard`, `/procesos` (índice + `cuentas`, `tarjetas`, `tarjetas/[id]`, `gastos`, `ingresos`, `pendientes`), `/ajustes` (+ `/ajustes/categorias`, `/ajustes/bancos`) | `src/app/(app)/loading.tsx` = esqueleto de carga entre vistas. `/cuentas` y `/tarjetas` redirigen 308 a `/procesos/*` desde `next.config.ts`. |
| Navegación | `src/components/app-nav.tsx` (`"use client"`) + `src/components/back-link.tsx` | 3 pestañas: **Resumen** (`/dashboard`) · **Procesos** (`/procesos`) · **Ajustes** (`/ajustes`); `useIsActive` hace prefix-match, así que `/procesos/*` ilumina Procesos. `AppTopBar` (marca + pestañas en `sm+` + `UserMenu`) y `AppBottomNav` (tabs inferiores en móvil). `<BackLink href label />` = enlace "← <índice>" arriba a la izquierda en cada sub-página (`/procesos/*`, `/ajustes/categorias`). `UserMenu` (`src/components/user-menu.tsx`): avatar + dropdown con correo y cerrar sesión. `src/app/(app)/layout.tsx` también trae cuentas/tarjetas/categorías una vez y renderiza el FAB global (ver fila siguiente). |
| Acceso rápido / responsive | `src/components/mobile-list.tsx` (`MobileList`/`MobileCard`/`MobileField`) + `TransactionForm` prop `fab` | El layout de `(app)` muestra un botón flotante "Nuevo gasto" (`TransactionForm type="expense" fab`) en todas las páginas. Las listas con muchas columnas (Cuentas, Tarjetas, Movimientos, Financiamientos) renderizan **dos vistas**: la `<Table>` de siempre envuelta en `hidden sm:block`, y un bloque `sm:hidden` con `MobileList`/`MobileCard` que muestra la misma fila como tarjeta apilada (mismos componentes de acción, sin lógica nueva) — así en mobile no hace falta scroll horizontal para editar/borrar. |
| Instalable (PWA-lite) | `src/app/manifest.ts`, `public/icon.svg`, `viewport`/`metadata` en `src/app/layout.tsx` | `display: standalone`, `theme-color` claro/oscuro, `apple-touch-icon`. Sin service worker. |

- **Degrada con gracia sin variables de Supabase**: `getUser()` atrapa el error; útil
  para CI y primer arranque. No romper este comportamiento.

## Base de datos

- Esquema histórico (hasta v1.2.1): `supabase/migrations/` (p. ej.
  `20260902180000_init.sql`), aplicado en su momento vía SQL Editor de Supabase o
  `supabase db push`. **Desde v1.2.2 esta carpeta no recibe archivos nuevos** — queda
  congelada como historial de lo ya aplicado.
- **A partir de v1.2.2**: todo SQL nuevo (tablas/columnas, RLS, índices, funciones /
  stored procedures) vive en `supabase/Versionamiento/<version>/`, una carpeta por
  versión de la app, con los archivos numerados en **orden de ejecución** (`00_...`,
  `01_...`, ...). El usuario los corre a mano en el SQL Editor de Supabase; la carpeta
  queda como respaldo legible de qué se ejecutó en cada release. Al publicar una
  versión, el siguiente desarrollo abre `supabase/Versionamiento/<version-siguiente>/`
  con lo que haga falta (migraciones y/o SPs).
- Config local: `supabase/config.toml`.
- Tablas: `accounts` (checking/savings/cash), `credit_cards` (con `cutoff_day`,
  `payment_due_day`, `current_balance`) y `transactions` (movimientos). **Todas con RLS
  por `auth.uid()`** y columna `user_id` con default `auth.uid()`. Cada tabla nueva debe
  seguir el mismo patrón de 4 policies (select/insert/update/delete own) + índice parcial
  `where not archived`.
- Columna `currency`: `text not null default 'CRC' check (currency in ('CRC', 'USD'))`.
- `transactions` (`20260906120000_transactions.sql`): `type in ('expense','income','card_payment')`,
  `amount > 0`, `occurred_on date`, `category text` (catálogo fijo en `schema.ts`;
  configurable = pendiente), `note`, `account_id` / `card_id` nullable (`on delete cascade`)
  con CHECK `transactions_fk_by_type` que exige la FK correcta según el tipo.
- Trigger `transactions_balance_sync` (`security invoker`, funciones `_tx_apply` /
  `apply_transaction_balance`): en INSERT/UPDATE/DELETE ajusta `current_balance`.
  Convención de signo: gasto/cuenta **−**, gasto/tarjeta **+** (más deuda), ingreso/cuenta
  **+**, `card_payment` **−** en ambos. Las filas `archived` no afectan saldos (archivar
  revierte, desarchivar reaplica). Por eso el "Saldo actual" de los formularios de
  cuenta/tarjeta es ahora **saldo de apertura / ajuste manual**: los movimientos lo
  modifican por deltas.
- `categories` (`20260906130000_categories.sql`): `kind in ('expense','income')`,
  `name` (1–40 chars). RLS + 4 policies + índice parcial + **índice único parcial**
  `(user_id, kind, lower(name)) where not archived` (choque → `error.code === '23505'`).
- `financings` (`supabase/Versionamiento/1.2.2/00_financings_schema.sql`): plan de
  cuotas sin interés sobre una tarjeta — `card_id`, `description`, `category`,
  `total_amount`, `months` (2–48), `currency` (heredada de la tarjeta), `first_charge_on`.
  RLS + 4 policies + índices parciales, mismo patrón que el resto. `transactions` suma
  `financing_id` (FK `on delete cascade`) e `installment_no`, nullable — solo los
  poblan las cuotas generadas por el SP `create_financing`
  (`01_create_financing_function.sql`), que inserta el plan y sus N cuotas en una sola
  función `security invoker` (atómico).

- `banks`, `mail_connections`, `pending_transactions`, `merchant_rules`
  (`supabase/Versionamiento/1.3.0/00_banks_and_pending.sql`): mismo patrón de RLS +
  4 policies. `credit_cards` suma `bank_id` (FK nullable, `on delete set null`).
  `pending_transactions` es solo staging: **no toca saldos** hasta que se aprueba y
  se crea el `expense`.

## Comandos

```bash
npm run dev     # next dev (Turbopack)
npm run build
npm run lint     # eslint
npm test         # node --test (parsers, cifrado, claves de comercio)
```

Variables de entorno de la importación de correo (ver `.env.example`):
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MAIL_TOKEN_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`. Cuando llegue el workflow (v1.3.1) se necesitarán además los secrets de GitHub `APP_URL` y `CRON_SECRET`.

## Roadmap

| Paso | Alcance | Estado |
|------|---------|--------|
| 1 | Base desplegable + auth + **cuentas de débito** + **tarjetas de crédito** (saldo, corte, pago) + dashboard resumen | ✅ v1.0.0 (tag + release) |
| 2 | Movimientos / gastos e ingresos, actualización de saldos por trigger, detalle de tarjeta con pagos/abonos | ✅ v1.2.0 · estado de cuenta + alerta de atraso + categorías configurables en v1.2.1 |
| 3 | Financiamientos y préstamos (amortización) | 🔶 financiamientos de tarjeta a tasa 0 en v1.2.2 · préstamos con interés/amortización pendientes |
| 4 | Ahorros y metas | ⏳ |

## Gotchas

- **No editar a mano** el bloque de `AGENTS.md`: lo reescribe `next dev`. Commitéalo
  junto con tu trabajo para mantener el árbol limpio.
- Antes de tocar APIs de framework, leer la guía correspondiente en
  `node_modules/next/dist/docs/` — esta versión de Next tiene breaking changes.
- El dashboard acota sus totales y la cobertura a `CRC`; las tarjetas en `USD` se
  listan pero **no** entran en la matemática de cobertura. `Patrimonio neto` sí
  suma todo de forma naïve — pendiente multi-moneda de verdad.
- El **saldo al corte** (`cardStatement`) se calcula **solo desde los movimientos con
  fecha**, no desde `current_balance`. Flujo esperado del usuario: registrar el saldo
  inicial de cada tarjeta como un `expense` con fecha **anterior** al corte, y los
  consumos siguientes como `expense` con su fecha real. Los cargos con fecha **posterior**
  al último corte no cuentan para el pago de contado (entran al siguiente).
- Un `card_payment` resta el mismo monto de la cuenta y de la tarjeta sin conversión:
  la action exige que ambas usen la misma moneda.
- Borrar una cuenta/tarjeta (`on delete cascade`) borra sus movimientos y el trigger
  revierte cada efecto; el otro lado de un `card_payment` (la tarjeta, al borrar la
  cuenta origen) se re-ajusta — revisá saldos después de borrar.
- `transactions.category` es **texto libre**: renombrar o borrar una categoría en
  `/ajustes/categorias` no toca los movimientos históricos.
- Un financiamiento genera sus cuotas **con fecha futura desde el día 0**. Por eso
  `cardStatement` (`src/lib/cards.ts`) separa "después del corte" en lo ya ocurrido
  (`occurred_on <= hoy`, cuenta como `newCharges`/`dueAmount`) y lo programado a
  futuro (`occurred_on > hoy`, no cuenta todavía) — solo `balanceByMovements` y
  `current_balance` incluyen el total completo de inmediato. Si se agrega otro flujo
  que inserte movimientos con fecha futura, revisar que siga esta misma regla.
- Un aviso del banco solo se importa si el remitente está en un banco **activo** y
  el parser lo reconoce; si el banco cambia la plantilla del correo, los avisos se
  ignoran en silencio hasta ajustar el parser (agregar un fixture real + test).
- Un pendiente solo se aprueba contra una tarjeta de **su misma moneda**.
- `SUPABASE_SERVICE_ROLE_KEY` salta RLS: solo se usa en `createAdminClient()` para
  el cron; nunca con prefijo `NEXT_PUBLIC_` ni en código de cliente.
- Borrar un financiamiento borra (cascade) **todas** sus cuotas, pasadas y futuras, y
  el trigger revierte el saldo completo — no hay forma de "cancelar a la mitad"
  dejando las cuotas ya cortadas.
