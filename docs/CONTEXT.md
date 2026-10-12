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
  usuario por proceso principal (Cuentas, Tarjetas, Gastos, Ingresos, Bancos,
  Transferencias, Préstamos, Arranque de 0 — un archivo por proceso). Es un documento vivo: cualquier cambio de
  comportamiento en esos módulos se refleja ahí en el mismo cambio, igual que
  se mantiene este archivo. Ver la convención completa en
  `docs/historias-usuario/README.md`.
- **Dominio (desde 2.0.0)**: `docs/dominio/` es el modelo de negocio
  independiente de la tecnología — `glosario.md` (lenguaje ubicuo),
  `contextos.md`, `reglas.md` (rechaza vs. advierte) y `arquitectura.md`
  (capas `domain`/`application`/`infrastructure`, decisiones de infra). Ante
  duda sobre un término o una regla, manda `docs/dominio/`. La 2.0.0 es un
  rediseño por dominio (DDD pragmático) en fases; ver `arquitectura.md`.

## Flujo de trabajo con agentes (instrucción del usuario)

- **Avisar siempre dónde se trabaja.** Si la sesión corre en la nube (contenedor
  remoto, no la máquina del usuario), decirlo al empezar y recordar que los cambios
  solo llegan a su VS Code con `git fetch` + `git checkout <rama>` (o `git pull`).
- **El nombre de la rama lo define el usuario.** Antes del primer commit, preguntar
  qué nombre quiere para la rama de trabajo y crearla con ese nombre exacto. No
  usar nombres generados automáticamente; si la sesión ya trae una rama asignada,
  avisarle y preguntarle si la renombra.
- Nunca trabajar directo sobre `main`.

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
| Server Actions | `src/app/(app)/<modulo>/actions.ts` | `"use server"`. Devuelven `FormResult` (`src/lib/forms.ts`). **Desde 2.1.0 todas** las escrituras (movimientos, financiamientos, pendientes y el catálogo: cuentas, tarjetas, categorías, bancos) siguen: `requireUser()` → Zod → caso de uso de `@/application` con `await repositories()` (`src/infrastructure/container.ts`) → si `!result.ok` devolver `result.message` (`toFormResult` de `src/lib/catalog-actions.ts`) → `revalidatePath()`; nada de `supabase.from(...)` en las actions (excepción: `syncNow` de pendientes, que delega en la sincronización de `src/lib/mail/`). Eliminar/desactivar del catálogo: actions `delete<X>` / `set<X>Active` (reciben `id` y `active`) que devuelven `FormResult`, usadas por `LifecycleButton`. Sesión: `signOutAction()` en `src/lib/session-actions.ts`. Movimientos: `saveTransaction` / `deleteTransaction` compartidas en `src/app/(app)/procesos/_transactions/actions.ts` — el saldo de la cuenta/tarjeta lo ajusta un **trigger de Postgres**, no la action; la action solo copia la `currency` del origen y valida (p. ej. misma moneda en un `card_payment`). |
| Aplicación / infraestructura (2.0.0) | `src/application/` (puertos `ports.ts`, `result.ts`, casos de uso) + `src/infrastructure/` (`supabase/repositories.ts`, `container.ts`) | La capa de aplicación es pura como el dominio (misma regla de ESLint) y se prueba con fakes en memoria. El adaptador Supabase lanza `InfrastructureError` con un mensaje mostrable. Ver `docs/dominio/arquitectura.md`. |
| Dominio (2.0.0) | `src/domain/` (`index.ts` exporta todo; importar desde `@/domain`) | Reglas de negocio puras, sin Next/React/Supabase/Zod ni alias `@/` (lo impone ESLint `no-restricted-imports`); imports internos relativos con `.ts` para `node --test`. `shared/` (`money.ts`: `Money` en céntimos, `assertSameCurrency`, `splitEvenly`, `convert`; `calendar.ts`: `crToday`, `toISODate`, `addMonthsClamped`, `daysUntil`; `errors.ts`: `DomainError` con id de regla), `ledger/movement.ts`, `cards/statement.ts`, `financing/` (`installmentSchedule` = única fuente del reparto de cuotas; `frenchAmortization` para financiamiento con interés/préstamo, aún sin UI), `coverage/coverage.ts`, `catalog/lifecycle.ts` (G4/G5: `assertCanDelete`, `assertActive`, `assertCategoryUsable`), `loans/loan.ts` (L1–L6: `loanSchedule`, `loanProgress`, `nextInstallment`, `lastPaidInstallment`, `loanDue`, `LOAN_CATEGORY`), `ledger/fresh-start.ts` (M8: `planFreshStart`, `FRESH_START_CONFIRMATION`). Cada módulo tiene su `*.test.ts`. Las Server Actions atrapan `DomainError` y devuelven su mensaje. |
| Validación | `src/lib/schema.ts` | Zod: `accountSchema`, `creditCardSchema`, `transactionSchema` (con `superRefine` por tipo; el origen viaja como `"account:<id>"` / `"card:<id>"`), `categorySchema` + tipos inferidos. `ACCOUNT_TYPES`, `CURRENCIES`, `TRANSACTION_TYPES`, `CATEGORY_KINDS`, `EXPENSE_CATEGORIES` / `INCOME_CATEGORIES` (ahora **lista sugerida / fallback** — las reales viven en la tabla `categories`). |
| Eliminar vs. desactivar (G5, 2.1.0) | `src/components/catalog-actions.tsx` (`RemoveOrDeactivate`, `InactiveList`) + `lifecycle-button.tsx` + `src/lib/catalog-history.ts` (`idsWithHistory`) | Cuentas, tarjetas, categorías y bancos: la página trae también lo `archived`, calcula qué ids tienen historia (`historyCount` del repositorio) y muestra **Eliminar** (sin historia) o **Desactivar** (con historia); lo desactivado va en una sección plegable para reactivarlo. El caso de uso vuelve a validar. `DeleteButton` queda para movimientos y financiamientos. |
| Formularios CRUD en diálogo | `src/lib/use-dialog-form.ts` + `<modulo>/{account,card,category}-form.tsx`, `procesos/_transactions/transaction-form.tsx` | Componentes de apoyo: `src/components/form-field.tsx`, `delete-button.tsx`, `ui/dialog.tsx`. `TransactionForm` (un solo diálogo con prop `type`, y `sinpe` para gastos por SINPE) sirve gastos, ingresos y pagos de tarjeta; `TransferForm` sirve transferencias; recibe `categories: string[]` por prop desde la página. |
| Movimientos | `src/lib/transactions.ts` + `src/domain/ledger/movement.ts` (`signedAmount`, `balanceEffects`, `deriveBalances`, `validateMovement`) + `src/app/(app)/procesos/_transactions/` | Helpers de formulario/UI: `parseOrigin`, `originValue`, `originLabel` (marca "(desactivada)"), `productLabel`, `touchesInactive` (G4: fila sin editar/eliminar). Las páginas con listados traen cuentas/tarjetas **incluidas las desactivadas** y se las pasan a `TransactionList` (para nombrar el origen); los formularios reciben solo las activas. `_transactions/` (carpeta privada `_`): `actions.ts`, `transaction-form.tsx`, `transaction-list.tsx` (tabla reutilizable, `context` `"list"`/`"card"`), `transaction-row-actions.tsx`. |
| Categorías | `src/lib/categories.ts` + tabla `categories` + `src/app/(app)/ajustes/categorias/` | `categoryNames(rows, fallback)` → nombres del usuario o la lista sugerida si no tiene ninguna. Sub-página con CRUD por diálogo + botón "cargar sugeridas" (`seedCategories`). `gastos`/`ingresos`/`tarjetas/[id]` hacen el fetch y lo pasan a `TransactionForm`/`TransactionList`. |
| Fecha "hoy" | `src/domain/shared/calendar.ts` | `crToday()` → día calendario actual en `America/Costa_Rica` (UTC-6, sin DST) como Date a medianoche local. Es el default de `from` en `domain/cards/statement.ts` y `daysUntil`, para no depender de la zona del servidor (Vercel = UTC). `toISODate(Date)` → `"YYYY-MM-DD"` con componentes locales (default del `<input type="date">` de los movimientos). |
| Lógica de tarjetas | `src/domain/cards/statement.ts` + `multicurrency.ts` (bimoneda: `cardStatementsByCurrency`, `cardAvailability`, `rateBetween`) | `nextCutoffDate`, `nextPaymentDate`, `lastCutoffDate`, `paymentDueForCutoff` (clamp de día en meses cortos). `cardStatement(card, txns, from)` → estado de cuenta del corte vigente: `statementBalance` (saldo de contado = cargos − pagos **con fecha <= último corte**), `paidAfterCutoff`, `dueAmount` (falta pagar antes de `dueDate` para no generar intereses), `newCharges` (consumo posterior al corte), `status` (`sin-movimientos`/`sin-saldo`/`al-dia`/`pendiente`/`atrasada`), `daysToDue`. |
| Formato es-CR | `src/lib/format.ts` | `formatCurrency` (default `CRC`, símbolo ₡ forzado con `narrowSymbol`), `formatDate` (una string `"YYYY-MM-DD"` se lee como día local, no UTC), `relativeDayLabel` ("hoy" / "mañana" / "en 5 días" / "hace 2 días"). Monedas soportadas: `CRC` (default) y `USD` — ver `CURRENCIES` en `src/lib/schema.ts`. |
| Resumen / dashboard | `src/app/(app)/dashboard/page.tsx` | Server component; calcula contra `crToday()`. La cobertura (débito disponible, pagos acumulados, atrasos, próximos) la calcula `computeCoverage(accounts, cards, loans, today)` de `src/domain/coverage/`: cada pago es `kind: "card"` (pago de contado por moneda, `dueAmount`, no `current_balance`) o `kind: "loan"` (cuota a cobro de `loanDue`, L6). Trae cuentas + tarjetas + movimientos de tarjeta + préstamos activos y sus pagos. Secciones: banner de atraso (tarjetas y/o préstamos), stats (disponible débito · a pagar · consumo sin cortar · gasto del mes · financiamientos · capital pendiente en préstamos), callout de cobertura vs. débito, "Pagos próximos" agrupados (**Atrasadas** / **Por vencer**, con enlace al detalle) y "Próximos cortes". |
| Tipos de dominio | `src/lib/types.ts` | `Account`, `CreditCard`, `Transaction` (`TransactionType`), `Category` (`CategoryKind`), `Financing`, `Loan`. |
| Financiamientos (tasa 0) | `src/app/(app)/procesos/tarjetas/_financiamientos/` + tabla `financings` + SP `create_financing_v2` / `cancel_financing` | Compra a cuotas sin interés sobre una tarjeta: `FinancingForm` (descripción, categoría, monto total, meses, fecha de primera cuota) → action `createFinancing` → caso de uso `createFinancing` (`src/application/financings.ts`), que calcula el plan con `installmentSchedule` del dominio y lo guarda con `supabase.rpc('create_financing_v2', …)`: la fila en `financings` y las N cuotas como `transactions` tipo `expense` (`financing_id`, `installment_no`, `note` con "cuota i/N"), en una sola transacción. El trigger de saldo suma el total al saldo de inmediato. `FinancingList` muestra los planes; eliminar llama `cancel_financing` (F4: conserva las cuotas ya ocurridas). No hay edición. El SP viejo `create_financing` se borra en 2.1.0. |
| Préstamos (2.1.0) | `src/app/(app)/procesos/prestamos/` (`page.tsx` listado, `[id]/page.tsx` calendario, `loan-form.tsx`, `pay-installment.tsx`, `loan-status.tsx`, `actions.ts`) + `src/application/loans.ts` + `src/domain/loans/loan.ts` + tabla `loans` | Préstamo bancario a cuota fija. El **calendario no se guarda**: `loanSchedule(termsOf(loan))` lo deriva de los términos (que no se editan). Hechos guardados: desembolso opcional = `income` con `loan_id`; pago de cuota = `expense` con `loan_id` + `installment_no`, categoría `"Préstamos"`, desde cuenta activa de la misma moneda, **en orden** (`payInstallment`); `undoLastInstallment` borra el último pago. `saveMovement`/`deleteMovement` rechazan (L2) tocar movimientos con `loan_id`; `TransactionList` muestra "Ver en Préstamos". Eliminar/desactivar por G5 (historia = cuotas pagadas). |
| Arranque de 0 (2.2.0) | `src/app/(app)/ajustes/arranque/` (`page.tsx`, `fresh-start-form.tsx`, `actions.ts`) + `src/application/fresh-start.ts` + `src/domain/ledger/fresh-start.ts` + SP `fresh_start` | Formulario con un saldo inicial por cuenta y por tarjeta×moneda (campos `opening:<account|card>:<id>:<moneda>`, precargados con el saldo de hoy), fecha y confirmación `ARRANCAR`. `freshStart` valida M8 y llama `supabase.rpc('fresh_start', …)`: borra cuotas futuras de financiamientos, archiva todos los movimientos (los desliga de `financing_id`/`loan_id`), borra financiamientos y préstamos, crea los saldos iniciales nuevos y registra en `fresh_starts`. La action revalida todo (`revalidatePath("/", "layout")`). |
| Importación desde correo | `src/lib/mail/` (`gmail.ts`, `crypto.ts`, `sync.ts`, `html.ts`, `parsers/`; la clave de comercio vive en `src/domain/importing/merchant.ts`) + `src/app/api/{sync-mail,gmail/connect,gmail/callback}/route.ts` + `src/lib/supabase/admin.ts` | Lee avisos de compra de los bancos (tabla `banks`: remitentes + `parser_key`) por Gmail API readonly, **sin IA**: un parser determinístico por banco (`parsers/index.ts` = registro; contrato `MailParser` en `types.ts`). `syncConnection` es idempotente (`unique (user_id, source_message_id)`), casa la tarjeta por `credit_cards.last_four` (+ `bank_id` si hay choque) y deja el resultado en `pending_transactions`. El refresh token se guarda cifrado (AES-256-GCM, `MAIL_TOKEN_KEY`). `/api/sync-mail` es pública en `proxy.ts` pero exige `Authorization: Bearer CRON_SECRET`, corre con service role y está pensada para que la llame un cron externo; la sincronización es **siempre manual** (botón "Sincronizar"); el workflow cada 2 h planeado para v1.3.1 se descartó (decisión de negocio, ver `docs/dominio/arquitectura.md`). Los imports dentro de `src/lib/mail/` llevan extensión `.ts` para que `node --test` los corra sin dependencias (`allowImportingTsExtensions`). |
| Bancos / Por confirmar | `src/app/(app)/ajustes/bancos/` + `src/app/(app)/procesos/pendientes/` | `/ajustes/bancos`: CRUD de bancos + conectar/desconectar Gmail. `/procesos/pendientes`: aprobar (crea `expense` en la tarjeta + aprende `merchant_rules`) o descartar; `syncNow` = misma sincronización con la sesión del usuario. |
| Rutas | `src/app/login/` (auth), grupo `src/app/(app)/` (protegido: `layout.tsx` llama `requireUser()`): `/dashboard`, `/procesos` (índice + `cuentas`, `tarjetas`, `tarjetas/[id]`, `gastos`, `ingresos`, `transferencias`, `prestamos`, `prestamos/[id]`, `pendientes`), `/ajustes` (+ `/ajustes/categorias`, `/ajustes/bancos`, `/ajustes/saldos`, `/ajustes/tipo-cambio`, `/ajustes/arranque`) | `src/app/(app)/loading.tsx` = esqueleto de carga entre vistas. `/cuentas` y `/tarjetas` redirigen 308 a `/procesos/*` desde `next.config.ts`. |
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
- `transactions` (`20260906120000_transactions.sql`): `type in ('expense','income','card_payment')` — desde 2.0.0 también `'opening_balance'` (saldo inicial, monto con signo ≠ 0, una de las dos FK, único activo por cuenta/tarjeta) y `'transfer'` (`account_id` origen → `to_account_id` destino, distintas; misma moneda la valida el dominio); un gasto puede llevar `channel = 'sinpe'` + `counterparty_name`/`counterparty_phone` (solo desde cuenta). Ver `supabase/Versionamiento/2.0.0/`,
  `amount > 0`, `occurred_on date`, `category text` (catálogo fijo en `schema.ts`;
  configurable = pendiente), `note`, `account_id` / `card_id` nullable (`on delete cascade`)
  con CHECK `transactions_fk_by_type` que exige la FK correcta según el tipo.
- Trigger `transactions_balance_sync` (`security invoker`, funciones `_tx_apply` /
  `apply_transaction_balance`): en INSERT/UPDATE/DELETE ajusta `current_balance`.
  Convención de signo: gasto/cuenta **−**, gasto/tarjeta **+** (más deuda), ingreso/cuenta
  **+**, `card_payment` **−** en ambos. Las filas `archived` no afectan saldos (archivar
  revierte, desarchivar reaplica). **Desde 2.0.0** `current_balance` es solo una
  proyección: nunca se escribe desde la app. El saldo de apertura es un movimiento
  `opening_balance` que se edita desde el formulario de cuenta/tarjeta ("Saldo
  inicial" + fecha). `balance_derived` / `balance_drift` (vistas `security_invoker`)
  y `recompute_balances()` verifican y reparan la proyección (UI: `/ajustes/saldos`).
  Cuotas de financiamiento: `create_financing_v2(…, p_installments jsonb)` guarda el
  plan que calcula el dominio.
- `categories` (`20260906130000_categories.sql`): `kind in ('expense','income')`,
  `name` (1–40 chars). RLS + 4 policies + índice parcial + **índice único parcial**
  `(user_id, kind, lower(name)) where not archived` (choque → `error.code === '23505'`).
- `financings` (`supabase/Versionamiento/1.2.2/00_financings_schema.sql`): plan de
  cuotas sin interés sobre una tarjeta — `card_id`, `description`, `category`,
  `total_amount`, `months` (2–48), `currency` (heredada de la tarjeta), `first_charge_on`.
  RLS + 4 policies + índices parciales, mismo patrón que el resto. `transactions` suma
  `financing_id` (FK `on delete cascade`) e `installment_no`, nullable — solo los
  poblan las cuotas de un financiamiento. Desde 2.0.0 las inserta
  `create_financing_v2` (plan + N cuotas calculadas por el dominio, `security
  invoker`, atómico); el SP original `create_financing` (1.2.2) se borra en
  `supabase/Versionamiento/2.1.0/00_drop_create_financing.sql`.

- `banks`, `mail_connections`, `pending_transactions`, `merchant_rules`
  (`supabase/Versionamiento/1.3.0/00_banks_and_pending.sql`): mismo patrón de RLS +
  4 policies. `credit_cards` suma `bank_id` (FK nullable, `on delete set null`).
  `pending_transactions` es solo staging: **no toca saldos** hasta que se aprueba y
  se crea el `expense`.
- `loans` (`supabase/Versionamiento/2.1.0/01_loans.sql`): `name`, `lender`,
  `principal`, `annual_rate` (%), `months` (1–480), `currency`, `first_payment_on`,
  `account_id` (cuenta sugerida, `on delete set null`). RLS + 4 policies + índice
  parcial. `transactions.loan_id` (FK `on delete cascade`) + índice único parcial
  `(loan_id, installment_no)` (L3: choque → `23505`, "Esa cuota ya está pagada") +
  CHECK `transactions_loan_by_type` (pago = `expense` con cuota, desembolso = `income`
  sin cuota, siempre desde/hacia cuenta).
- `fresh_starts` + función `fresh_start(p_today, p_on, p_openings jsonb)`
  (`supabase/Versionamiento/2.2.0/00_fresh_start.sql`): constancia de cada Arranque de
  0 (`started_on`, `archived_movements`), RLS + 4 policies. La función es `security
  invoker` y atómica.
- `exchange_rates` (`supabase/Versionamiento/2.0.0/06_multicurrency_cards.sql`):
  colones por dólar por fecha (`unique (user_id, rate_on)`), RLS + 4 policies. Las
  vistas `balance_derived`/`balance_drift` traen una fila por tarjeta **y moneda**.

## Comandos

```bash
npm run dev     # next dev (Turbopack)
npm run build
npm run lint     # eslint
npm test         # node --test (parsers, cifrado, claves de comercio)
```

Variables de entorno de la importación de correo (ver `.env.example`):
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MAIL_TOKEN_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.

## Roadmap

| Paso | Alcance | Estado |
|------|---------|--------|
| 1 | Base desplegable + auth + **cuentas de débito** + **tarjetas de crédito** (saldo, corte, pago) + dashboard resumen | ✅ v1.0.0 (tag + release) |
| 2 | Movimientos / gastos e ingresos, actualización de saldos por trigger, detalle de tarjeta con pagos/abonos | ✅ v1.2.0 · estado de cuenta + alerta de atraso + categorías configurables en v1.2.1 |
| 3 | Financiamientos y préstamos (amortización) | 🔶 financiamientos de tarjeta a tasa 0 en v1.2.2 · cancelar conservando cuotas cobradas en v2.0.0 · **préstamos bancarios a cuota fija en v2.1.0** · financiamiento con interés sobre tarjeta pendiente |
| 2.0 | Rediseño por dominio (DDD) + saldo inicial como movimiento + saldos verificables + transferencias + SINPE + tarjeta bimoneda con tipo de cambio manual | ✅ v2.0.0 |
| 2.1 | Cierre de la Fase 2: catálogo por casos de uso, eliminar vs. desactivar (G5) y nada sobre lo desactivado (G4) · limpieza (SP `create_financing`) · préstamos bancarios con cuotas en el Resumen | ✅ v2.1.0 (`feature/2.1.0`, pendiente de merge) |
| 2.2 | Arranque de 0 (M8) | 🔶 en desarrollo (`feature/2.2.0`, sale de `feature/2.1.0`) |
| 4 | Ahorros y metas | ⏳ |

## Gotchas

- **No editar a mano** el bloque de `AGENTS.md`: lo reescribe `next dev`. Commitéalo
  junto con tu trabajo para mantener el árbol limpio.
- Antes de tocar APIs de framework, leer la guía correspondiente en
  `node_modules/next/dist/docs/` — esta versión de Next tiene breaking changes.
- El dashboard acota sus totales y la cobertura a `CRC`; los saldos en `USD` de las
  tarjetas (bimoneda) se listan como pagos aparte pero **no** entran en la matemática
  de cobertura. `Patrimonio neto` sí
  suma todo de forma naïve — pendiente multi-moneda de verdad.
- El **saldo al corte** (`cardStatement`) se calcula **solo desde los movimientos con
  fecha**, no desde `current_balance`. El saldo inicial (`opening_balance`) cuenta como
  cargo en su fecha; antes de 2.0.0 se registraba como un `expense` anterior al corte
  (sigue valiendo). Los consumos siguientes van como `expense` con su fecha real. Los cargos con fecha **posterior**
  al último corte no cuentan para el pago de contado (entran al siguiente).
- **Tarjeta bimoneda (2.0.0)**: `credit_cards.current_balance` = saldo en **CRC** y
  `usd_balance` = saldo en **USD** (el trigger elige por `transactions.currency`);
  `credit_cards.currency` = moneda del **límite**. Un `card_payment` resta el mismo monto
  de la cuenta y del saldo de la tarjeta en la moneda de la cuenta (sin conversión).
  Estado de cuenta por moneda: `cardStatementsByCurrency`; disponible:
  `cardAvailability` con el último `exchange_rates` (manual, `/ajustes/tipo-cambio`).
- **Desde 2.1.0** una cuenta/tarjeta/categoría/banco **con historia no se elimina**
  (G5): se desactiva (`archived = true`). Solo se borra lo que no tiene historia, así
  que el `on delete cascade` ya solo arrastra el saldo inicial. Lo desactivado no se
  ofrece al registrar (todas las lecturas filtran `archived`) y los casos de uso lo
  rechazan (G4). Una tarjeta desactivada con saldo deja de contar en el dashboard.
- Los **pagos de préstamo** son gastos normales (cuentan en Gastos). La cuota a
  cobro (L6) entra en "Pagos próximos" y en la cobertura; un préstamo cuya próxima
  cuota está a más de 31 días no aparece en el Resumen.
- **Arranque de 0 (2.2.0)**: los movimientos archivados no se ven en ninguna lista ni
  cuentan en saldos, pero siguen siendo historia para G5 (la cuenta se desactiva, no se
  elimina). No hay pantalla para verlos ni restaurarlos.
- `transactions.category` es **texto libre**: renombrar o borrar una categoría en
  `/ajustes/categorias` no toca los movimientos históricos.
- Un financiamiento genera sus cuotas **con fecha futura desde el día 0**. Por eso
  `cardStatement` (`src/domain/cards/statement.ts`) separa "después del corte" en lo ya ocurrido
  (`occurred_on <= hoy`, cuenta como `newCharges`/`dueAmount`) y lo programado a
  futuro (`occurred_on > hoy`, no cuenta todavía) — solo `balanceByMovements` y
  `current_balance` incluyen el total completo de inmediato. Si se agrega otro flujo
  que inserte movimientos con fecha futura, revisar que siga esta misma regla.
- Un aviso del banco solo se importa si el remitente está en un banco **activo** y
  el parser lo reconoce; si el banco cambia la plantilla del correo, los avisos se
  ignoran en silencio hasta ajustar el parser (agregar un fixture real + test).
- Un pendiente se aprueba contra cualquier tarjeta y va al saldo de su moneda.
- `SUPABASE_SERVICE_ROLE_KEY` salta RLS: solo se usa en `createAdminClient()` para
  el cron; nunca con prefijo `NEXT_PUBLIC_` ni en código de cliente.
- **Desde 2.0.0** eliminar un financiamiento llama `cancel_financing(id, hoy)`
  (`04_cancel_financing.sql`): borra solo las cuotas con fecha > hoy, conserva las
  demás y marca `financings.cancelled_on`; si no quedó ninguna, borra el plan. Borrar
  la **tarjeta** sí sigue borrando todo en cascada.
