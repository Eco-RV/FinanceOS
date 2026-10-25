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
  Transferencias, Préstamos, Arranque de 0, Resumen, Cuenta, Planes, Ahorros, Compartidos, Funciones, Comentarios, Constelación —
  un archivo por proceso). Es un documento vivo: cualquier cambio de
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
- **Ramas (desde 2.3.0)**: `dev_main` es la rama de integración (sale de `main`).
  Cada feature/versión sale de `dev_main` en su propia rama (p. ej.
  `feature/2.3.0`) y vuelve a `dev_main` por PR; `dev_main` se lleva a `main` al
  publicar.
- Las ramas son **solo para features nuevas**. Lo demás (docs, README,
  CHANGELOG, ajustes menores) se trabaja directo en `dev_main`, sin preguntar
  nombre de rama.
- Despliegue (Vercel/Supabase), SQL versionado y pasos de release:
  `docs/flujo-de-trabajo.md`.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 ·
shadcn/ui sobre `@base-ui/react` · fuentes Geist (texto) + Oswald (títulos, cifras y botones, 3.2.1) · Supabase (`@supabase/ssr`, Auth email+password,
Postgres + RLS) · Zod v4 · sonner (toasts) · tema claro/oscuro propio (`src/lib/theme.ts`).

## Arquitectura y convenciones

| Área | Archivo(s) | Notas |
|------|-----------|-------|
| Middleware | `src/proxy.ts` | Next 16 renombró `middleware` → `proxy`. Delega en `updateSession` de `src/lib/supabase/proxy.ts`: refresca la sesión (`getClaims()`, sin viaje a Auth desde 3.2.0) y protege rutas. El `matcher` excluye `favicon.ico` y `manifest.webmanifest` para que la instalación funcione sin sesión. |
| Clientes Supabase | `src/lib/supabase/{client,server,proxy}.ts` | browser / server component / middleware respectivamente. |
| DAL / auth | `src/lib/auth.ts` | `getUser()` memoizado con `cache()`, devuelve `{ id, email }` o `null` si no hay env o falla. Desde 3.2.0 usa `auth.getClaims()` (JWT validado en local: el proyecto firma con llaves asimétricas); `getAuthUser()` = usuario completo de Auth (consulta a Auth), solo donde hace falta (fecha de alta). `requireUser()` redirige a `/login` y fija el formato de fecha del request (cookie `fo-date`). Úsalos en páginas y actions protegidas. |
| Acceso y correo (2.6.0) | `src/app/login/` (`actions.ts`: `login`, `signUp`, `resendConfirmation`, `requestPasswordReset`; `login-form.tsx` con pestañas, "Revisa tu correo", `PasswordInput`) + `src/app/auth/confirm/route.ts` + `src/app/auth/restablecer/` + `src/lib/site-url.ts` (`siteOrigin`, `confirmUrl`, `safeNext`) + `src/components/url-notice.tsx` | Todo enlace que manda Supabase por correo lleva `emailRedirectTo` = origen del request (o `NEXT_PUBLIC_SITE_URL`) + `/auth/confirm?next=…`. La ruta acepta `token_hash`+`type` (`verifyOtp`) y `code` (PKCE, `exchangeCodeForSession`; si falla en otro navegador, el correo ya quedó confirmado → `/login?aviso=correo-confirmado`). Avisos por URL: `/login?aviso=…` y `?aviso=bienvenida|correo-actualizado|contrasena-actualizada` (los muestra `UrlNotice` y limpia la URL). En Supabase → Auth → URL Configuration: Site URL `https://financeos-ten-rust.vercel.app` y Redirect URLs `https://financeos-ten-rust.vercel.app/**` y `http://localhost:3000/**`. |
| Planes recurrentes (2.7.0) | `src/app/(app)/procesos/planes/` (`page.tsx` con línea base, grupos y próximos 30 días; `plan-form.tsx`; `plan-controls.tsx` pausar y tope; `labels.ts`; `actions.ts`) + `src/application/plans.ts` (`savePlan`, `syncPlans`, `setPlanActive`, `deletePlan`, `setBaselineCap`) + `src/domain/plans/plan.ts` (`validatePlan`, `occurrencesBetween`/`dueOccurrences`/`upcomingOccurrences`, `monthlyEquivalent`, `baseline`) + `src/infrastructure/supabase/plans.ts` + `src/lib/plans-board.ts` (read model) + `src/lib/sync-plans.ts` (`ensurePlansUpToDate`, `cache()` por request) | Salario (P1), **gasto fijo** (P2: renta, servicios, suscripciones; en la base `kind = 'subscription'`, categoría sugerida con `suggestFixedCategory`) y seguro (T9: tarjeta de crédito o, desde 3.1.0, tarjeta de débito con `debit_card_id` + `account_id`). **Las ocurrencias no se guardan por adelantado** (el trigger sumaría plata futura, M7): `syncPlans` registra las que ya llegaron con el SP `materialize_plan` (idempotente por `(plan_id, occurred_on)`) y avanza `plans.generated_through`; lo corre el layout de `(app)`, el Resumen, Planes y cada acción. Un plan nuevo empieza a registrar desde hoy (P6). Línea base (P4): salarios vs. gastos fijos, seguros, cuota de préstamos y de financiamientos (CRC); tope en `profiles.preferences.baselineCapPercent`. |
| Gastos compartidos (3.1.0) | `src/app/(app)/procesos/compartidos/` (`page.tsx` lista + por cobrar; `nuevo/page.tsx` con `?movimiento=<id>`; `[id]/page.tsx` detalle; `[id]/editar/page.tsx`; `shared-expense-form.tsx` = asistente de 3 pasos con `Stepper`; `shared-actions.tsx` = `SharedPaymentDialog`, `SharedPaidBadge`, `UnshareButton`; `shared-notice-card.tsx`; `actions.ts`) + `src/application/shared-expenses.ts` (`createSharedExpense`, `shareExpense`, `updateSharedExpense`, `deleteSharedExpense`, `markSharedPartPaid`, `undoSharedPartPaid`, `recordSharedNotices`, `sendSharedNoticeEmail`) + `src/domain/sharing/shared-expense.ts` (`suggestSplit`, `validateSharedParts`, `sharedDueDate`, `assertKeepsPaidParts`, `assertCanUnshare`, `sharedNoticeGroups`, `sharedReceivables`) + `src/domain/shared/notices.ts` (`groupNotices`, común con F8) + puerto `SharedExpenseRepository` + `src/infrastructure/supabase/shared-expenses.ts` + `src/lib/shared-board.ts` (`loadSharedBoard`, `loadSharedLinks`) | X1–X6. El gasto es un `expense` normal (X1); las personas son `members`. `createSharedExpense` valida las partes antes de crear el movimiento y lo borra si compartir falla (sin SP). El cobro puede crear un `income` (X4, `income_transaction_id`); deshacer lo borra. `saveMovement`/`deleteMovement` consultan `sharedExpenses.linkOf` (X6): por eso `MovementDeps` incluye `sharedExpenses`. Las listas reciben `sharedLinks` (`TransactionList`): "Compartir" en gastos sin compartir y "Ver en Compartidos" en lo ligado. `WhatsappNoticeButton`/`EmailNoticeButton` aceptan `action`. Cobros, Procesos y Resumen suman las dos fuentes. Sin el SQL 3.1.0 todo lee vacío. |
| Historial con filtros (3.1.0) | `src/app/(app)/procesos/_transactions/movement-explorer.tsx` (`MovementExplorer`, `context` `"card"`/`"account"`, `normalizeSearch`) + `src/lib/use-pagination.ts` (`usePagination`, filas recordadas con `useSyncExternalStore`) + `src/components/pagination-footer.tsx` | Detalle de tarjeta y de cuenta: Buscar, Tipo e "Incluir futuras" (apagado = hasta hoy) a la vista; fechas y moneda en "Más filtros"; 5/10/20/50/todas. Las páginas leen todo con `allRows`; el estado de cuenta usa la lista completa y solo la vista se filtra. `ExpenseExplorer` (Gastos) usa la misma paginación. `displayAmount` se exporta de `transaction-list.tsx` para los totales. |
| Pendientes cerrados (3.1.0) | `src/infrastructure/exchange/hacienda.ts` (T10) + `refreshExchangeRate` / `ensureExchangeRateToday` (`src/lib/sync-plans.ts`) · `computeCoverage(…, usdCrc)` (G7) · `src/domain/cards/minimum.ts` + `setMinimumPayment` (T8) · `create_financing_v4` (F10) · `segmentedAmortization`/`remainingTerm` (`financing/amortization.ts`), `prepayLoan`/`changeLoanRate`/`undoLastLoanAdjustment` + `src/lib/loan-adjustments.ts` (L7/L8) · `financingPrepaymentPlan` + `prepayFinancing`/`undoFinancingPrepayment` (F11) · `confirmPlanOccurrence` + `src/domain/plans/reminders.ts` + `dashboard/reminders.tsx` (P7/P8) · `goalsSaved`/`allocateToGoal` (A4) · `ReceiptStorage` (`supabase/receipts.ts`) + `receipt-dialog.tsx` (G8) · `/ajustes/arranque/archivados` (M9) · `/ajustes/bancos/reglas` (I6) · `deleteAccount` (U8), `readPreferences` + `getPreferences`/`loadRequestDateFormat` (`src/lib/preferences.ts`) / `DateFormatProvider` + `useFormatDate` (U9, por request desde 3.2.0), `signInWithGoogle` (U10) | El calendario de un préstamo sigue derivado: `termsOf(loan, ajustes)`; toda lectura de avance debe pasar los ajustes (`loadLoanAdjustments`). El abono a un financiamiento es un gasto de la cuenta + cuotas reemplazadas (la deuda baja una vez). El formato de fecha es por request (3.2.0): `requireUser()` espera `loadRequestDateFormat()` (cookie `fo-date`), que lo fija para `formatDate` en el servidor; los client components usan `useFormatDate()`, nunca `formatDate` a secas. Borrar la cuenta usa `SUPABASE_SERVICE_ROLE_KEY`. |
| Mejoras 3.1.0 | `src/domain/ledger/spending.ts` (`spendingInColones`, `spendingRanges`, `compareSpending`, `spendingFrom`) + `dashboard/expense-overview.tsx` (`Change`) · `toColones` (`domain/shared/money.ts`) en `plans-board.ts` (`unconverted`, `usdCrc`) y Ahorros · `splitByPercent`/`suggestPercents` en el asistente de compartidos | El Resumen lee los gastos con `allRows` desde `spendingFrom(hoy)` (1 de enero del año pasado). Los rangos del período anterior salen del dominio; el componente no calcula fechas. En `%` se guardan montos (X2); el modo `%` se oculta si alguien ya pagó. |
| Leyes de UX (3.1.0) | **`docs/diseno/leyes-ux.md`** + `src/components/stepper.tsx` + `src/lib/last-used.ts` (`readLastUsed`/`rememberLastUsed`) | Toda UI nueva cumple las 6 leyes (cierre, figura-fondo, ceguera a banners, Parkinson, conexión, exceso de opciones) con su lista de chequeo. Hoy: carrusel con `cqw` (asoma ~30 %), velo `bg-black/65` en diálogos, estado de tarjeta junto al título, últimos valores del gasto e ingreso, `Stepper` en compartidos y wallet, Procesos con 4 frecuentes + "Más procesos". |
| Ahorros y metas (2.7.0) | `src/app/(app)/procesos/ahorros/` (`page.tsx`, `goal-form.tsx`, `contribution-form.tsx` = transferencia con `saveTransfer`, `goal-controls.tsx`, `actions.ts`) + `saveGoal`/`setGoalArchived`/`deleteGoal` en `src/application/plans.ts` + `src/domain/savings/goal.ts` (`validateGoal`, `goalProgress`) | Meta ligada a una cuenta (A1, una meta activa por cuenta): ahorrado = saldo de la cuenta; aportes = transferencias hacia ella. El Resumen muestra línea base y metas (`dashboard/plans-goals.tsx`). |
| Cuenta y preferencias (2.6.0) | `src/app/(app)/ajustes/cuenta/` (perfil + foto, correo, contraseña, sesión) + `ajustes/preferencias/` (tema Sistema/Claro/Oscuro con `setThemeChoice`/`useThemeChoice` de `src/lib/theme.ts`, accesos a configuraciones) + `src/application/profile.ts` + `src/domain/account/profile.ts` (U1–U6, `initialsOf`) + `src/infrastructure/supabase/account.ts` (`profiles`, `identity`, `avatars`) + `src/lib/use-form-action.ts` + `src/lib/countries.ts` | Puertos `ProfileRepository`, `IdentityService` (verifica la contraseña actual con un cliente aparte sin persistir sesión; `isRecoverySession` por el `amr` del JWT), `AvatarStorage`. La foto se recorta en el navegador a 512 px WebP y sube por Server Action (`serverActions.bodySizeLimit = 3mb`). Sin el SQL 2.6.0, `profiles.get()` devuelve `null` y la app sigue funcionando. El layout lee el perfil para la barra (`UserMenu` con `Avatar`) y el saludo de la bienvenida. |
| Server Actions | `src/app/(app)/<modulo>/actions.ts` | `"use server"`. Devuelven `FormResult` (`src/lib/forms.ts`). **Desde 2.1.0 todas** las escrituras (movimientos, financiamientos, pendientes y el catálogo: cuentas, tarjetas, categorías, bancos) siguen: `requireUser()` → Zod → caso de uso de `@/application` con `await repositories()` (`src/infrastructure/container.ts`) → si `!result.ok` devolver `result.message` (`toFormResult` de `src/lib/catalog-actions.ts`) → `revalidatePath()`; nada de `supabase.from(...)` en las actions (excepción: `syncNow` de pendientes, que delega en la sincronización de `src/lib/mail/`). Eliminar/desactivar del catálogo: actions `delete<X>` / `set<X>Active` (reciben `id` y `active`) que devuelven `FormResult`, usadas por `LifecycleButton`. Sesión: `signOutAction()` en `src/lib/session-actions.ts`. Movimientos: `saveTransaction` / `deleteTransaction` compartidas en `src/app/(app)/procesos/_transactions/actions.ts` — el saldo de la cuenta/tarjeta lo ajusta un **trigger de Postgres**, no la action; la action solo copia la `currency` del origen y valida (p. ej. misma moneda en un `card_payment`). |
| Aplicación / infraestructura (2.0.0) | `src/application/` (puertos `ports.ts`, `result.ts`, casos de uso) + `src/infrastructure/` (`supabase/repositories.ts`, `container.ts`) | La capa de aplicación es pura como el dominio (misma regla de ESLint) y se prueba con fakes en memoria. El adaptador Supabase lanza `InfrastructureError` con un mensaje mostrable. Ver `docs/dominio/arquitectura.md`. |
| Dominio (2.0.0) | `src/domain/` (`index.ts` exporta todo; importar desde `@/domain`) | Reglas de negocio puras, sin Next/React/Supabase/Zod ni alias `@/` (lo impone ESLint `no-restricted-imports`); imports internos relativos con `.ts` para `node --test`. `shared/` (`money.ts`: `Money` en céntimos, `assertSameCurrency`, `splitEvenly`, `convert`; `calendar.ts`: `crToday`, `toISODate`, `addMonthsClamped`, `daysUntil`; `errors.ts`: `DomainError` con id de regla), `ledger/movement.ts`, `cards/statement.ts`, `financing/` (`installmentSchedule` = única fuente del reparto de cuotas; `frenchAmortization` para financiamiento con interés y préstamo), `coverage/coverage.ts`, `catalog/lifecycle.ts` (G4/G5: `assertCanDelete`, `assertActive`, `assertCategoryUsable`), `loans/loan.ts` (L1–L6: `loanSchedule`, `loanProgress`, `nextInstallment`, `lastPaidInstallment`, `loanDue`, `LOAN_CATEGORY`), `ledger/fresh-start.ts` (M8: `planFreshStart`, `FRESH_START_CONFIRMATION`), `financing/plan.ts` (2.3.0: `financingSchedule`, `financingProgress`, `storedInstallments`, `scheduledInterest`), `financing/members.ts` (2.3.0, F6–F8). Cada módulo tiene su `*.test.ts`. Las Server Actions atrapan `DomainError` y devuelven su mensaje. |
| Validación | `src/lib/schema.ts` | Zod: `accountSchema`, `creditCardSchema`, `transactionSchema` (con `superRefine` por tipo; el origen viaja como `"account:<id>"` / `"card:<id>"`), `categorySchema` + tipos inferidos. `ACCOUNT_TYPES`, `CURRENCIES`, `TRANSACTION_TYPES`, `CATEGORY_KINDS`, `EXPENSE_CATEGORIES` / `INCOME_CATEGORIES` (ahora **lista sugerida / fallback** — las reales viven en la tabla `categories`). |
| Eliminar vs. desactivar (G5, 2.1.0) | `src/components/catalog-actions.tsx` (`RemoveOrDeactivate`, `InactiveList`) + `lifecycle-button.tsx` + `src/lib/catalog-history.ts` (`idsWithHistory`) | Cuentas, tarjetas, categorías y bancos: la página trae también lo `archived`, calcula qué ids tienen historia (`historyCount` del repositorio) y muestra **Eliminar** (sin historia) o **Desactivar** (con historia); lo desactivado va en una sección plegable para reactivarlo. El caso de uso vuelve a validar. `DeleteButton` queda para movimientos y financiamientos. |
| Formularios CRUD en diálogo | `src/lib/keep-on-error.ts` (3.2.0: **todo formulario de diálogo usa `onSubmit={keepOnError(submit)}`, no `action={submit}`**; con `action`, React 19 vacía los campos aunque haya error) + `src/lib/use-dialog-form.ts` (opción `celebrate` + `detail`: confirmación animada al centro en vez de toast) + `<modulo>/{account,card,category}-form.tsx`, `procesos/_transactions/transaction-form.tsx` | Componentes de apoyo: `src/components/form-field.tsx`, `delete-button.tsx`, `ui/dialog.tsx`. `TransactionForm` (prop `type`, `sinpe`) delega desde 2.5.0 el **gasto no SINPE** a `expense-form.tsx` (`ExpenseForm`: monto con botón CRC/USD, `CategoryPicker`, Tarjeta = `WalletCarousel` (empieza en la primera; flechas, toque, rueda del ratón y deslizar con el dedo; sin arrastre con el cursor) / Efectivo = cuentas `cash` de la moneda, "Más opciones" = fecha y nota); ingresos, SINPE y pagos de tarjeta siguen en `MovementForm` (también con `CategoryPicker`). Reciben `categories: string[]` y `categoryIcons` (nombre en minúsculas → ícono). `TransferForm` sirve transferencias. |
| Tarjetas de débito y detalle de cuenta (2.8.0) | `src/domain/banking/debit-card.ts` (`validateDebitCard`, `assertDebitCardUsable`, `debitCardLabel`, C3) + `src/application/debit-cards.ts` (`saveDebitCard`; eliminar/desactivar con `removeFromCatalog`/`setCatalogActive` tipo `"debitCard"`) + puerto `DebitCardRepository` + tabla `debit_cards` + `src/lib/debit-cards.ts` (`loadDebitCards`, `[]` sin el SQL) + `src/app/(app)/procesos/cuentas/[id]/page.tsx` y `debit-card-form.tsx` | Una tarjeta de débito activa por cuenta bancaria (índice único parcial → 23505). Un gasto con ella es un `expense` de su cuenta con `transactions.debit_card_id`; `saveMovement` valida que la tarjeta esté activa y sea de esa cuenta (al editar se conserva la que ya tenía). Gasto rápido: pestañas Crédito · Débito · SINPE · Efectivo (`ExpenseForm`, `initialMode`; `TransactionForm` manda todo gasto ahí). Detalle de cuenta: `TransactionList` con `context="account"` + `accountId` (signo de transferencias y abonos convertidos). Planes: `target = "debit:<id>"` → `plans.debit_card_id` + `account_id` de la tarjeta. |
| Movimientos | `src/lib/transactions.ts` + `src/domain/ledger/movement.ts` (`signedAmount`, `balanceEffects`, `deriveBalances`, `validateMovement`) + `src/app/(app)/procesos/_transactions/` | Helpers de formulario/UI: `parseOrigin`, `originValue`, `originLabel` (marca "(desactivada)"), `productLabel`, `touchesInactive` (G4: fila sin editar/eliminar). Las páginas con listados traen cuentas/tarjetas **incluidas las desactivadas** y se las pasan a `TransactionList` (para nombrar el origen); los formularios reciben solo las activas. `_transactions/` (carpeta privada `_`): `actions.ts`, `transaction-form.tsx`, `transaction-list.tsx` (tabla reutilizable, `context` `"list"`/`"card"`/`"account"`), `transaction-row-actions.tsx`. |
| Categorías | `src/lib/categories.ts` + tabla `categories` + `src/app/(app)/ajustes/categorias/` + íconos (2.5.0): `src/lib/category-icon-keys.ts` (claves, `defaultIconFor`, `iconFor`; sin lucide, usable en Zod/servidor) y `src/components/category-icon.tsx` (`CATEGORY_ICONS`, `CategoryIcon`, `CategoryBadge`) | `categoryNames(rows, fallback)` → nombres; `categoryOptions` → `{ name, icon }` (ícono guardado o sugerido por el nombre); `iconsByName`. Las páginas leen `select("*")` para no romper si falta la columna `icon`; el repositorio reintenta sin `icon` ante `PGRST204`. Sub-página con CRUD por diálogo (con selector de ícono) + "cargar sugeridas" (`seedCategories`). |
| Fecha "hoy" | `src/domain/shared/calendar.ts` | `crToday()` → día calendario actual en `America/Costa_Rica` (UTC-6, sin DST) como Date a medianoche local. Es el default de `from` en `domain/cards/statement.ts` y `daysUntil`, para no depender de la zona del servidor (Vercel = UTC). `toISODate(Date)` → `"YYYY-MM-DD"` con componentes locales (default del `<input type="date">` de los movimientos). |
| Lógica de tarjetas | `src/domain/cards/statement.ts` + `multicurrency.ts` (bimoneda: `cardStatementsByCurrency`, `cardAvailability`, `rateBetween`) | `nextCutoffDate`, `nextPaymentDate`, `lastCutoffDate`, `paymentDueForCutoff` (clamp de día en meses cortos). `cardStatement(card, txns, from)` → estado de cuenta del corte vigente: `statementBalance` (saldo de contado = cargos − pagos **con fecha <= último corte**), `paidAfterCutoff`, `dueAmount` (falta pagar antes de `dueDate` para no generar intereses), `newCharges` (consumo posterior al corte, ya sin el abono anticipado `prepaid`, 2.8.0), `status` (`sin-movimientos`/`sin-saldo`/`al-dia`/`pendiente`/`atrasada`), `daysToDue`. |
| Formato es-CR | `src/lib/format.ts` | `formatCurrency` (default `CRC`, símbolo ₡ forzado con `narrowSymbol`), `formatDate` (una string `"YYYY-MM-DD"` se lee como día local, no UTC), `relativeDayLabel` ("hoy" / "mañana" / "en 5 días" / "hace 2 días"). Monedas soportadas: `CRC` (default) y `USD` — ver `CURRENCIES` en `src/lib/schema.ts`. |
| Resumen / dashboard (2.5.0; orden nuevo en 3.2.1) | `src/app/(app)/dashboard/` (`page.tsx`; `stat-dialog.tsx` = card que abre su modal de detalle; `expense-overview.tsx` = una card con selector de período + gráfico de barras por categoría, client; `favorites.tsx` = cinta de favoritos + diálogo Editar; `actions.ts` = `saveFavoritesAction`) + `src/domain/account/favorites.ts` (U11: `SHORTCUTS`, `readFavorites`, `validateFavorites`, `visibleShortcuts`) + `saveFavorites` (`src/application/profile.ts`) | 3.2.1: saludo y fecha → atraso → primeros pasos → Liquidez · A pagar · Faltante → **Favoritos** (en `profiles.preferences.favorites`, máx. 5, filtrados con `isRouteVisible`) → Pagos próximos (3 + `<details>` "Ver más") y cortes → gastos → "Más detalle" → recordatorios/línea base/metas → patrimonio. Antes de 3.2.1: Server component; calcula contra `crToday()`. La cobertura la calcula `computeCoverage(accounts, cards, loans, today)` de `src/domain/coverage/` (cada pago `kind: "card"` por moneda con `dueAmount`, o `kind: "loan"` con `loanDue`, L6) y el faltante `coverageShortfall` (verde/amarillo/rojo). Grilla `lg:grid-cols-3`: 1) **Liquidez** (débito CRC; modal con las cuentas > 0) · 2) A pagar de contado · Consumo sin cortar (modales) · **Faltante** · 3) gastos 7 días / mes / año · 4) gráfico por categoría · 5) **Disponible en crédito** (`cardAvailability` + `availabilityLevel`, con el último `exchange_rates`) · Cobros a miembros (enlace) · Financiamientos (modal). Debajo, "Pagos próximos" y "Próximos cortes" (lado a lado en `xl`). El callout de cobertura se quitó. |
| Tipos de dominio | `src/lib/types.ts` | `Account`, `CreditCard`, `Transaction` (`TransactionType`), `Category` (`CategoryKind`), `Financing`, `Loan`, `Member`. |
| Financiamientos (2.3.0: tasa 0 o con interés) | `src/app/(app)/procesos/tarjetas/_financiamientos/` (`financing-form.tsx` crear + `FinancingEditDialog`, `financing-list.tsx`, `member-actions.tsx`, `actions.ts`) + `tarjetas/[id]/financiamientos/[financingId]/page.tsx` (detalle) + `src/application/financings.ts` + `src/domain/financing/plan.ts` + tabla `financings` + SP `create_financing_v3` / `update_financing` / `cancel_financing` | `FinancingForm` (descripción, categoría, monto = **capital**, tasa anual %, 2–72 meses, fecha) → `createFinancing` calcula el plan con `financingSchedule` (tasa 0 = `installmentSchedule`; con tasa = `frenchAmortization`) y lo guarda con `create_financing_v3`: N `expense` por la cuota completa con `interest_amount` (valida que Σ(monto − interés) = capital). El trigger suma el plan completo; **la app descuenta el interés de cuotas futuras** del saldo/disponible/patrimonio/arranque con `scheduledInterest` (`src/lib/card-balances.ts`: `scheduledInterestByCard`, `interestByCard`, `withoutScheduledInterest`). Editar (F9) = descripción y categoría vía `update_financing` (también en las cuotas). Eliminar = `cancel_financing` (F4). `TransactionList` muestra "incluye ₡X de interés" y enlaza la cuota a su detalle. |
| Miembros y cobros (2.3.0) | `src/app/(app)/ajustes/miembros/` + `src/app/(app)/procesos/cobros/page.tsx` + `src/application/members.ts` + `src/domain/financing/members.ts` + `src/lib/financing-board.ts` (`loadFinancingBoard`, read model) + `src/lib/notices.ts` (`noticeMessage`, `whatsappUrl`, `phoneLabel`) | Catálogo `members` (G4/G5 con kind `"member"`). Reparto F6 = monto fijo por cuota por miembro (`financing_shares`, `setFinancingShares`, ≤ cuota más baja; el resto es del usuario). Reembolso F7 = `member_reimbursements` (uno por miembro×cuota, no toca saldos). Avisos F8: `chargeDueDate` (fecha límite del estado de cuenta de la cuota), `quincenasLeft`, `noticeGroups` (por miembro + fecha + moneda, `needsNotice` si no hay aviso con las quincenas de hoy) y `memberReceivables`. Envío **manual**: WhatsApp = enlace `wa.me` con el texto (la action `recordWhatsappNotice` solo registra); correo = `sendNoticeEmail` con el puerto `Mailer` (adaptador Gmail en `repositories.ts`, requiere `gmail.send` en `mail_connections.scopes`). Las actions recalculan el aviso en el servidor (`noticeFor`). Badge en Procesos y callout en el Resumen. |
| Préstamos (2.1.0) | `src/app/(app)/procesos/prestamos/` (`page.tsx` listado, `[id]/page.tsx` calendario, `loan-form.tsx`, `pay-installment.tsx`, `loan-status.tsx`, `actions.ts`) + `src/application/loans.ts` + `src/domain/loans/loan.ts` + tabla `loans` | Préstamo bancario a cuota fija. El **calendario no se guarda**: `loanSchedule(termsOf(loan))` lo deriva de los términos (que no se editan). Hechos guardados: desembolso opcional = `income` con `loan_id`; pago de cuota = `expense` con `loan_id` + `installment_no`, categoría `"Préstamos"`, desde cuenta activa de la misma moneda, **en orden** (`payInstallment`); `undoLastInstallment` borra el último pago. `saveMovement`/`deleteMovement` rechazan (L2) tocar movimientos con `loan_id`; `TransactionList` muestra "Ver en Préstamos". Eliminar/desactivar por G5 (historia = cuotas pagadas). |
| Arranque de 0 (2.2.0) | `src/app/(app)/ajustes/arranque/` (`page.tsx`, `fresh-start-form.tsx`, `actions.ts`) + `src/application/fresh-start.ts` + `src/domain/ledger/fresh-start.ts` + SP `fresh_start` | Formulario con un saldo inicial por cuenta y por tarjeta×moneda (campos `opening:<account|card>:<id>:<moneda>`, precargados con el saldo de hoy), fecha y confirmación `ARRANCAR`. `freshStart` valida M8 y llama `supabase.rpc('fresh_start', …)`: borra cuotas futuras de financiamientos, archiva todos los movimientos (los desliga de `financing_id`/`loan_id`), borra financiamientos y préstamos, crea los saldos iniciales nuevos y registra en `fresh_starts`. La action revalida todo (`revalidatePath("/", "layout")`). |
| Importación desde correo | `src/lib/mail/` (`gmail.ts`, `crypto.ts`, `sync.ts`, `html.ts`, `parsers/`; la clave de comercio vive en `src/domain/importing/merchant.ts`) + `src/app/api/{sync-mail,gmail/connect,gmail/callback}/route.ts` + `src/lib/supabase/admin.ts` | Lee avisos de compra de los bancos (tabla `banks`: remitentes + `parser_key`) por Gmail API readonly, **sin IA**: un parser determinístico por banco (`parsers/index.ts` = registro; contrato `MailParser` en `types.ts`). `syncConnection` es idempotente (`unique (user_id, source_message_id)`), casa la tarjeta por `credit_cards.last_four` (+ `bank_id` si hay choque) y deja el resultado en `pending_transactions`. El refresh token se guarda cifrado (AES-256-GCM, `MAIL_TOKEN_KEY`). `/api/sync-mail` es pública en `proxy.ts` pero exige `Authorization: Bearer CRON_SECRET`, corre con service role y está pensada para que la llame un cron externo; la sincronización es **siempre manual** (botón "Sincronizar"); el workflow cada 2 h planeado para v1.3.1 se descartó (decisión de negocio, ver `docs/dominio/arquitectura.md`). Los imports dentro de `src/lib/mail/` llevan extensión `.ts` para que `node --test` los corra sin dependencias (`allowImportingTsExtensions`). |
| Bancos / Por confirmar | `src/app/(app)/ajustes/bancos/` + `src/app/(app)/procesos/pendientes/` | `/ajustes/bancos`: CRUD de bancos + conectar/desconectar Gmail. `/procesos/pendientes`: aprobar (crea `expense` en la tarjeta + aprende `merchant_rules`) o descartar; `syncNow` = misma sincronización con la sesión del usuario. |
| Rutas | `/comentarios` (+ `[id]`, `bandeja` solo admin) · `/` = página de inicio pública (3.2.0; con sesión redirige a `/dashboard`) · `src/app/login/` (auth; `?modo=crear` abre el registro), grupo `src/app/(app)/` (protegido: `layout.tsx` llama `requireUser()`): `/dashboard`, `/procesos` (índice + `funciones` (catálogo, 3.2.0), `cuentas`, `tarjetas`, `tarjetas/[id]`, `tarjetas/[id]/financiamientos/[financingId]`, `gastos`, `ingresos`, `transferencias`, `prestamos`, `prestamos/[id]`, `pendientes`, `cobros`, `compartidos`, `compartidos/nuevo`, `compartidos/[id]`, `compartidos/[id]/editar`), `/ajustes` (+ `/ajustes/categorias`, `/ajustes/bancos`, `/ajustes/miembros`, `/ajustes/saldos`, `/ajustes/tipo-cambio`, `/ajustes/arranque`) | `src/app/(app)/loading.tsx` = esqueleto de carga entre vistas. `/cuentas` y `/tarjetas` redirigen 308 a `/procesos/*` desde `next.config.ts`. |
| Carga y sincronización (3.2.0) | `src/components/page-skeleton.tsx` + un `loading.tsx` por sección (`(app)/**/loading.tsx`) + `ensureDailySync` (`src/lib/sync-plans.ts`) + `src/components/daily-sync-mark.tsx` | Toda sección nueva lleva su `loading.tsx` con `PageSkeleton` (título real, variante `list`/`detail`/`index`/`dashboard`): sin él, la navegación dentro de su carpeta queda congelada hasta que llegan los datos. Planes y tipo de cambio se sincronizan una vez al día por usuario y dispositivo (cookie `fo-sync`); Planes y cada acción siguen sincronizando siempre. Las lecturas independientes de una página van en un solo `Promise.all` (cada tanda cuesta un viaje a Supabase). |
| Enfoque y funciones (3.2.0) | `src/domain/account/features.ts` (`FEATURES`, `readFeatureState`, `initialFeatureState`, `isFeatureEnabled`/`enabledFeatures`, `isRouteVisible`, `nextSuggestion`, `firstSteps`, E1–E5) + `src/lib/features.ts` (`getFeatureState`, `getEnabledFeatures`, `cache()` por request) + `src/app/(app)/procesos/funciones/` (catálogo, `feature-toggle.tsx`, `actions.ts`: `setFeatureAction`, `dismissSuggestionAction`, `closeFirstStepsAction`, `reopenFirstStepsAction`) + `dashboard/focus-cards.tsx` (`FirstStepsCard`, `SuggestionCard`) + `dashboard/focus-actions.tsx` + `src/app/page.tsx` (inicio público) | El estado vive en `profiles.preferences.features` (`choices`, `legacy`, `dismissed`, `stepsClosed`). La primera vez (`getFeatureState` sin estado) se decide `legacy` según si ya hay cuentas o tarjetas; una cuenta nueva recibe las categorías sugeridas. Toda pantalla que lista accesos filtra con `isRouteVisible` (Procesos, Ajustes); el Resumen oculta Análisis, Cobros, Financiamientos y Línea base/metas según la función; el layout solo muestra el botón de ingreso con "Ingresos". Una ruta nueva que pertenezca a una función va en su `routes`; un botón de una función dentro del núcleo se muestra solo con la función encendida (p. ej. `shareable` en `TransactionList`, `FinancingForm` en el detalle de tarjeta). Estados vacíos: `EmptyRows action` con el paso que sigue. Abrir un diálogo desde un enlace: envolver su componente en `AutoOpen` (`src/components/auto-open.tsx`) con `?nueva=1` (Tarjetas, Cuentas), `?nuevo=1` (Gastos) o `?pago=1` (detalle de tarjeta). |
| Buzón de comentarios (3.2.0) | `src/app/(app)/comentarios/` (`page.tsx` lo propio, `[id]/page.tsx` conversación, `bandeja/page.tsx` solo admin, `new-post-dialog.tsx`, `[id]/thread-actions.tsx`: `MarkRead`, `ReplyForm`, `StatusControl`; `feedback-ui.tsx`; `actions.ts`) + `src/application/feedback.ts` (`createFeedbackPost`, `replyToFeedback`, `setFeedbackStatus`, `markFeedbackRead`) + `src/domain/feedback/feedback.ts` (B1–B6) + puerto `FeedbackRepository` + `src/infrastructure/supabase/feedback.ts` + `src/components/ui/textarea.tsx` | Privado entre el usuario y el admin (`getUser().isAdmin` = `app_metadata.role === "admin"`, desde el JWT). Entradas sin interrumpir: menú del usuario (punto y contador sin leer, que el layout lee con el RPC `feedback_unread`), Ajustes → Comentarios y un enlace al pie del Resumen. Al abrir algo sin leer, `MarkRead` lo marca y revalida el layout. Sin el SQL 3.2.0 las lecturas devuelven vacío. |
| Producción (3.2.0) | `src/app/(app)/error.tsx`, `src/app/global-error.tsx`, `src/app/not-found.tsx` + `src/components/error-state.tsx` + `src/lib/report-error.ts` · `src/instrumentation.ts` / `src/instrumentation-client.ts` + `src/lib/sentry-options.ts` · `headers()` en `next.config.ts` · `/terminos` y `/privacidad` (`src/components/legal-page.tsx`) · **`docs/produccion/guia-produccion.md`** | Next 16: los error boundaries reciben `retry` (no `reset`). Sentry solo con `NEXT_PUBLIC_SENTRY_DSN` y sin datos del usuario (`dataCollection` estricto). Las cabeceras no traen CSP completa (Cavos/Stellar): solo `frame-ancestors`. Términos y Privacidad son borradores para revisar; `/terminos` es pública en `proxy.ts`. La configuración fuera del código (Supabase Auth, SMTP, Vercel, respaldos) está en la guía. |
| Navegación | `src/components/app-nav.tsx` (`"use client"`) + `src/components/back-link.tsx` | 3 pestañas: **Resumen** (`/dashboard`) · **Procesos** (`/procesos`) · **Ajustes** (`/ajustes`); `useIsActive` hace prefix-match, así que `/procesos/*` ilumina Procesos. `AppTopBar` (marca + pestañas en `sm+` + `ThemeToggle` + `UserMenu`) y `AppBottomNav` (tabs inferiores en móvil). `<BackLink href label />` = enlace "← <índice>" arriba a la izquierda en cada sub-página (`/procesos/*`, `/ajustes/categorias`). `UserMenu` (`src/components/user-menu.tsx`): avatar + dropdown con correo y cerrar sesión. `src/app/(app)/layout.tsx` también trae cuentas/tarjetas/categorías una vez y renderiza el FAB global (ver fila siguiente). |
| Acceso rápido / listas (2.5.0) | `src/components/row-list.tsx` (`RowList`/`RowItem`/`RowActions`/`EmptyRows`) + `src/components/mobile-list.tsx` (`MobileList`/`MobileCard`/`MobileField`) + `TransactionForm` prop `fab` | El layout de `(app)` muestra dos botones flotantes apilados en todas las páginas (3.1.0): **Nuevo gasto** (`ArrowUp`, `bg-expense`) arriba y **Nuevo ingreso** (`ArrowDown`, `bg-income`, carga categorías de ingreso) abajo; la prop `fab` solo da el estilo y el layout los posiciona. Desde 3.2.0 los pinta `QuickAdd` (`src/app/(app)/quick-add.tsx`): el `TransactionForm` se baja con `import()` cuando el navegador queda libre o al tocar (botón idéntico mientras tanto). Las listas (Cuentas, Tarjetas, Movimientos, Financiamientos, Préstamos, Miembros) renderizan **dos vistas**: en `sm+` un `RowList` (una card por fila, columnas con `grid-template-columns`, sin la tabla "pegada") y debajo de `sm` `MobileList`/`MobileCard`. Con `href`, `RowItem`/`MobileCard` hacen **toda la fila clicable** con un enlace estirado; los botones van en `RowActions` (encima del enlace). `index` = entrada en cascada (`rise`). Siguen como `<Table>` solo las tablas de cuotas/calendarios, saldos, tipo de cambio y bancos. Gastos filtra en el cliente (`gastos/expense-explorer.tsx`) y acepta `?desde=&hasta=&categoria=` (enlaces del gráfico del Resumen). |
| Diseño e interacción (2.4.0) | `src/app/globals.css` (tokens `--shadow-card`/`--shadow-card-hover`, `ease-fluid`, utilidad `surface`, reduced-motion) + `src/lib/interactive.ts` (`FOCUS_OUTLINE`, `PRESSABLE_SURFACE`, `PRESSABLE_ROW`) + `src/components/nav-card.tsx` (`NavCard`/`NavCardDisabled`) + `panel.tsx` + `link-pending.tsx` (`LinkChevron`) | Fondo de página gris suave y superficies blancas (`surface` = card + `ring` suave + sombra) para tablas, listas y bloques. Una card que **solo navega** es un `NavCard` (todo el `Link` es la card); una fila que solo navega usa `PRESSABLE_ROW` (Resumen: pagos y cortes). Filas o cards con acciones internas (editar/eliminar) **no** se hacen clicables enteras. `Button` se hunde (`scale 0.97`) salvo los disparadores de menú; transiciones solo de color/sombra/escala. Spinners de ejecución en `LifecycleButton`, `DeleteButton` (`useFormStatus`) y acciones de miembros. |
| Tema claro/oscuro (2.4.0) | `src/lib/theme-script.ts` (`THEME_SCRIPT`, en `<head>` de `src/app/layout.tsx`) + `src/lib/theme.ts` (`useTheme`, `setTheme`) + `src/components/theme-toggle.tsx` | Sin elección guardada sigue al sistema; el botón sol/luna guarda `light`/`dark` en `localStorage` (`theme`). El script pone `.dark` en `<html>` antes de pintar (patrón de `node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md`); el ícono se elige por CSS (`dark:`) para no desincronizar la hidratación. Sonner usa el mismo `useTheme`. Sin `next-themes` (se quitó en 2.4.0). |
| Marca, fondo y bienvenida (2.5.0) | **Guía oficial: `docs/marca/README.md`** (logotipo Bloques, SVG oficiales, colores, tipografía, usos). `src/components/brand-logo.tsx` (`LogoMark`/`LogoTile`), `wallet-card.tsx` (`WalletCard` con degradado estable por tarjeta; `WalletCardHero` = tarjeta animada arriba del detalle de tarjeta), `app-backdrop.tsx` (cuadrícula + bloques flotantes, CSS puro), `welcome-splash.tsx` (al cargar la app, ~1,5 s), `celebration.tsx` + `src/lib/celebrate.ts` (confirmación animada al centro), `docs/logos/` (5 propuestas de logo) | Animaciones en `globals.css` (`rise` con `--rise-i`, `float-block`, `pop-in`, `draw-check`, `grow-x`); con "reducir movimiento" se apagan (`[data-motion]`). Tokens `--success`/`--warning` y `--chart-1..5` con color. Contenido a `max-w-7xl` (`2xl`: 1600px). Toasts arriba al centro. Pestaña **Trading** (`/trading`, beta) en la barra; desde 3.2.0 solo con `NEXT_PUBLIC_FEATURE_CONSTELLATION=1` (`src/lib/flags.ts`; si no, 404). Bienvenida: solo la primera vez por dispositivo (`fo-welcome` en `localStorage`, `data-welcomed` lo pone `THEME_SCRIPT`). Confirmaciones: `confirmAction({ title, description, confirmLabel, tone, icon })` de `src/lib/confirm.ts` + `<ConfirmHost />` (layout raíz, Base UI AlertDialog); `DeleteButton`, `LifecycleButton`, deshacer cuota y reembolso lo usan (`splitQuestion` parte el texto en título y descripción). No usar `window.confirm`. Combos: `Select` de `src/components/ui/select.tsx` (Base UI Select con estilo propio, re-exportado por `form-field.tsx`) acepta la misma forma que un `<select>` (`<option>`/`<optgroup>`, `name`, `value`/`defaultValue`, `onChange(e.target.value)`) y envía un input oculto; ya no hay `<select>` nativo en la app. |
| Constelación · wallet y bolsillo (2.9.0) | `src/app/(app)/trading/` (`layout.tsx` monta `StellarShell`; `page.tsx` hub; `bolsillo/page.tsx`) + `src/components/stellar/` (`stellar-shell.tsx` = `next/dynamic` con `ssr:false`; `stellar-providers.tsx` = Cavos + Stellar Wallets Kit; `wallet-context.ts` = `useWallet()`/`useCavosState()`; `wallet-gate.tsx`, `wallet-setup.tsx`, `pocket.tsx`, `send-dialog.tsx`, `receive-dialog.tsx`) + `src/infrastructure/stellar/horizon.ts` (saldos, Friendbot, trustline, swap XLM→USDC, `sendUsdc`, `explainStellarError`) + `src/lib/stellar/` (`env.ts` con `NEXT_PUBLIC_*` literales y valores de testnet, `CAVOS_APP_SALT` **fija**) + `src/domain/constellation/usdc.ts` (7 decimales, K10) + skills en `.claude/skills/` | Pagos de persona a persona en USDC (Stellar **testnet**), sin contrato. **Una sola forma de firmar**: `useWallet().signTransaction` (Cavos o extensión); ninguna pantalla importa los SDK. Todo lo que firma corre en el navegador; el servidor solo lee el tipo de cambio. Friendbot primero, después trustline. La familia y la bóveda (contrato `family`) llegan en la 3.0.0. |
| Constelación · dominio y Supabase (3.0.0) | `src/domain/constellation/{family,directory}.ts` + `src/application/constellation.ts` (`linkWallet`, `saveStar`/`deleteStar`, `createFamilyInvite`, `redeemFamilyInvite`, `revokeFamilyInvite`, `markFamilyInviteAdded`, `completeLesson`) + puertos `WalletLinkRepository`, `StarDirectoryRepository`, `FamilyInviteRepository`, `InviteTokenService`, `AcademyRepository` + `src/infrastructure/supabase/constellation.ts` + tablas `stellar_wallets`, `constellation_stars`, `family_invites`, `academy_progress` | El dominio **espeja** las reglas del contrato para avisar antes de firmar; el contrato manda. Apodos por usuario (D3, RLS "own"). Invitación: token aleatorio, solo su SHA-256 en la base; `redeem_family_invite` (`security definer`) es lo único entre usuarios. Sin el SQL 3.0.0 las lecturas devuelven vacío. |
| Constelación · pantallas de familia (3.0.0) | `src/app/(app)/trading/` (`familia/` = `family-board.tsx` + `invites.tsx`; `boveda/vault-board.tsx`; `unirse/[token]/`; `actions.ts` = Server Actions de Supabase; `wallet-linker.tsx` liga la wallet; `pending-invite.tsx` recuerda una invitación abierta antes de conectar; `star-label-dialog.tsx`) + `src/components/stellar/` (`use-family.ts`: `useMyFamily` lee la familia del contrato, `useFamilyWrite` simula → firma → envía; `constellation-svg.tsx`) + `readFamilySnapshot`/`toFamilyView` en `src/infrastructure/stellar/family.ts` | Lo que cambia la cadena se firma en el navegador con `useFamilyWrite().run` (si la simulación falla, muestra el error del contrato sin pedir firma); lo de Finance OS va por Server Actions. Antes de firmar, el dominio (`assertCan…`, `approvalBlocker`) avisa. La interfaz muestra la primera familia de la wallet (D6). |
| Constelación · contrato `family` (3.0.0) | `contracts/family/src/{lib,test}.rs` (crate del workspace `Cargo.toml` de la raíz, `soroban-sdk` 26.1, toolchain en `rust-toolchain.toml`) + `contracts/Versionamiento/` + `src/infrastructure/stellar/family.ts` (`contract.Client.from<FamilyContract>`, `signAndSendResult`, `familiesOf`, `readFamily`) + `docs/constelacion/plan-3.0.0.md` | Familia (núcleo, guardianes, miembros; solo direcciones y roles, K2) y bóveda USDC: `create_family`, `add_member`/`remove_member`/`leave_family`/`set_role`, `set_approvals`, `set_goal`, `deposit`, `request_withdrawal`/`approve_withdrawal`/`cancel_withdrawal`, lecturas y `upgrade` (admin). Reglas K3–K7 en el contrato; errores con mensaje en español (`///`). Desplegado en testnet (`CBP3Y7EMTKUXSD3SDDC6IVM3U2KRZIO5I2XEBRGNNLO73KKTAPTN77ON`). El usuario despliega y firma; el agente nunca maneja claves `S…`. |
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
  Cuotas de financiamiento: desde 2.3.0 `create_financing_v3(…, p_installments jsonb)`
  guarda el plan que calcula el dominio (con el interés de cada cuota).
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
- 3.2.0 (`supabase/Versionamiento/3.2.0/`): `00_auditoria_rls.sql` (solo lectura); `feedback_posts` y `feedback_messages` con RLS dueño **o admin** (`public.is_app_admin()`), trigger `feedback_posts_guard` (el usuario no cambia el estado; el admin no cambia el contenido), `feedback_messages_touch` (actividad y lectura), RPC `feedback_unread()` y bucket privado `feedback` (`01_feedback.sql`); dar el rol admin (`02_feedback_admin.sql`: cambiar el correo; luego cerrar sesión y volver a entrar). `feedback_messages` solo tiene select e insert (no se editan ni se borran).
- 3.1.0 (`supabase/Versionamiento/3.1.0/`): `shared_expenses` (`transaction_id` único entre activos, total, moneda, `due_on`), `shared_expense_parts` (`unique (shared_expense_id, member_id)`, pago = `paid_on` + `channel`, `income_transaction_id` `on delete set null`) y `shared_expense_notices` (`quincenas` 0–4), todas con RLS + 4 policies (`00_shared_expenses.sql`); `fresh_start` también borra los compartidos (`01_fresh_start_shared.sql`); `plans_target` acepta un seguro con tarjeta de débito (`02_insurance_debit_card.sql`).
- 3.0.0 (`supabase/Versionamiento/3.0.0/`): `stellar_wallets` (solo la
  dirección `G…`; una activa por usuario y una dirección por usuario,
  `00_`), `constellation_stars` (apodo/emoji/parentesco por usuario y
  dirección, `member_id` opcional, `01_`), `family_invites` (`token_hash`
  SHA-256, 72 h, canje con `redeem_family_invite` `security definer`;
  activa `pgcrypto`, `02_`) y `academy_progress` (mejor puntaje por
  lección, `03_`). Todas con RLS + 4 policies.
- 2.8.0 (`supabase/Versionamiento/2.8.0/`): `credit_cards.cutoff_day_rolls_over`
  (T3: el día de corte pasa al corte siguiente) (`00_card_cutoff_rollover.sql`);
  `debit_cards` (RLS + 4 policies, índice único `(account_id) where not
  archived`), `transactions.debit_card_id` y `plans.debit_card_id` (`on delete
  set null`), `materialize_plan` con `debit_card_id` (`01_debit_cards.sql`);
  `transactions.account_amount` + `exchange_rate` (abono en otra moneda, M5),
  trigger `_tx_apply` y vista `balance_derived` con `coalesce(account_amount,
  amount)` del lado de la cuenta (`02_card_payment_exchange.sql`).
- 3.1.0 (continuación): `card_minimum_payments` (`03_`), `create_financing_v4`
  con moneda (`04_`), `loan_adjustments` + CHECK de préstamos que acepta el gasto
  del abono sin cuota (`05_`), `financing_prepayments` + SPs `prepay_financing` /
  `undo_financing_prepayment` (`06_`), `plans.variable` + `transactions.estimated`
  + `materialize_plan` con `estimated` (`07_`), `savings_goals.allocated` sin el
  índice único por cuenta (`08_`), `transactions.receipt_path` + bucket privado
  `receipts` (`09_`).
- 2.7.0 (`supabase/Versionamiento/2.7.0/`): `plans` (kind salary/subscription/
  insurance, frecuencia, `starts_on`/`ends_on`, `account_id`/`card_id` con
  `on delete set null`, `generated_through`; RLS + 4 policies + índice parcial),
  `transactions.plan_id` (`on delete set null`) + índice único
  `(plan_id, occurred_on)` y SP `materialize_plan(p_plan_id, p_through, p_rows)`
  (`00_plans.sql`); `savings_goals` (objetivo, moneda, fecha, cuenta, ícono;
  índice único de cuenta entre las activas) (`01_savings_goals.sql`). El
  Arranque de 0 no toca planes ni metas.
- 2.6.0 (`supabase/Versionamiento/2.6.0/`): `profiles` (una fila por usuario,
  llave `user_id`; RLS + 4 policies; índice único `lower(username)`; trigger
  `on_auth_user_created_profile` que la crea al registrarse, con el nombre del
  formulario) (`00_profiles.sql`) y bucket público `avatars` con policies por
  carpeta `<user_id>/` (`01_avatars_storage.sql`).
- 2.5.0 (`supabase/Versionamiento/2.5.0/00_category_icons.sql`): `categories.icon`
  (clave del kit, nullable) y un ícono por defecto para las existentes según el
  nombre.
- 2.3.0 (`supabase/Versionamiento/2.3.0/`): `financings.annual_rate` (0–100),
  `months` 2–72, `total_amount` = capital; `transactions.interest_amount`
  (interés de una cuota, `< amount`); SP `create_financing_v3` y
  `update_financing` (`00_financing_interest.sql`). Tablas `members`,
  `financing_shares` (`unique (financing_id, member_id)`), `member_reimbursements`
  (`unique (financing_id, member_id, installment_no)` → `23505`) y
  `member_notices` (`quincenas` 0–3, `channel` email/whatsapp), todas con RLS + 4
  policies + índice parcial y `on delete cascade` desde `financings`
  (`01_members.sql`). `mail_connections.scopes` (`02_mail_send_scope.sql`).
  `create_financing_v2` queda sin uso; se puede borrar en la versión siguiente.
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
cargo test -p family                                        # contrato Soroban (3.0.0)
stellar contract build --manifest-path contracts/family/Cargo.toml
```

Medir velocidad (3.2.0): `PERF_LOG=1` escribe en el log del servidor una línea por render con cada consulta a Supabase (`src/lib/perf.ts`); `NEXT_PUBLIC_PERF_LOG=1` (al compilar) o `localStorage.setItem("fo-perf", "1")` hace que `PerfNavTimer` mida cada navegación (toque → esqueleto → contenido). Para medir: `.env.production.local` con las dos, `npm run build` y la configuración `financeos-prod` de `.claude/launch.json` (puerto 3100). Línea base en `docs/produccion/plan-3.2.0.md`.

Variables de entorno de la importación de correo (ver `.env.example`):
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MAIL_TOKEN_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.

## Roadmap

| Paso | Alcance | Estado |
|------|---------|--------|
| 1 | Base desplegable + auth + **cuentas de débito** + **tarjetas de crédito** (saldo, corte, pago) + dashboard resumen | ✅ v1.0.0 (tag + release) |
| 2 | Movimientos / gastos e ingresos, actualización de saldos por trigger, detalle de tarjeta con pagos/abonos | ✅ v1.2.0 · estado de cuenta + alerta de atraso + categorías configurables en v1.2.1 |
| 3 | Financiamientos y préstamos (amortización) | ✅ financiamientos de tarjeta a tasa 0 en v1.2.2 · cancelar conservando cuotas cobradas en v2.0.0 · préstamos bancarios a cuota fija en v2.1.0 · **financiamiento con interés, edición, miembros, reembolsos y avisos en v2.3.0** |
| 2.0 | Rediseño por dominio (DDD) + saldo inicial como movimiento + saldos verificables + transferencias + SINPE + tarjeta bimoneda con tipo de cambio manual | ✅ v2.0.0 |
| 2.1 | Cierre de la Fase 2: catálogo por casos de uso, eliminar vs. desactivar (G5) y nada sobre lo desactivado (G4) · limpieza (SP `create_financing`) · préstamos bancarios con cuotas en el Resumen | ✅ v2.1.0 (en `main`) |
| 2.2 | Arranque de 0 (M8) | ✅ v2.2.0 (en `main`) |
| 2.3 | Financiamientos completos: con interés (F5), edición (F9), miembros con reparto por cuota (F6), reembolsos (F7) y avisos por quincena por WhatsApp/correo (F8) | ✅ v2.3.0 (en `main`) |
| 2.4 | Rediseño UI/UX: superficies, microinteracciones, cards/filas clicables enteras y tema claro/oscuro | ✅ v2.4.0 (en `main`) |
| 2.5 | Rediseño UI/UX detallado: listas separadas, Resumen con grilla y modales, gráfico de gastos, gasto rápido tipo billetera, íconos de categoría, filtros de gastos, bienvenida, fondo animado, Trading (beta) | ✅ v2.5.0 (en `main`) |
| 2.6 | Usuarios: registro con confirmación por correo, recuperar contraseña, perfil con foto, cambio de correo y contraseña, preferencias | ✅ v2.6.0 (en `main`) |
| 2.7 | Planes recurrentes (salario, gastos fijos, seguros), línea base (P4) y Ahorros y metas | ✅ v2.7.0 (en `main`) |
| 4 | Ahorros y metas | ✅ v2.7.0 |
| 2.9 | Mi bolsillo en Stellar (testnet): wallet con Cavos o extensión, USDC de persona a persona (enviar con revisión, recibir con QR), pestaña Constelación | ✅ v2.9.0 (en `main`) |
| 3.0 | Constelación familiar: contrato `family` desplegado, dominio, Supabase y pantallas de familia, invitaciones y bóveda | ✅ v3.0.0 (en `main`) |
| 3.1 | Auditoría y cierre de pendientes del BusinessLogic (`docs/dominio/pendientes.md`), historial con filtros, leyes de UX, botones de gasto e ingreso, Gastos compartidos (X1–X7), tipo de cambio del BCCR y multimoneda (G7, G9, G10), pago mínimo, abonos extraordinarios y tasa variable, monto variable y recordatorios, varias metas por cuenta, comprobantes, cuenta (Google, borrar, preferencias). La 3.0.1 de desarrollo quedó dentro | ✅ v3.1.0 (en `main`) |
| 3.2 | Salida a producción para los primeros usuarios (early birds): promesa única "no pagar intereses" con funciones por logros, buzón de comentarios, velocidad y fluidez, seguridad multiusuario y pulido UI/UX (`docs/produccion/plan-3.2.0.md`) | ✅ v3.2.0 (en `main`) |
| 3.2.1 | Fuente Oswald en títulos, cifras y botones; favoritos editables en el Resumen (U11) y Resumen reordenado | 🚧 en desarrollo (`feature/3.2.1`) |
| 4.0 | Constelación completa: Apoyos (Trustless Work), Academia, letra grande, encaje con Finance OS (Fase 7), estrella ↔ miembro (D13) y guion de prueba (Fase 8) | 📝 plan |
| 2.8 | Correcciones: día de corte al siguiente corte (BAC), abono anticipado, abono en otra moneda con tipo de cambio, SINPE y débito en el gasto rápido, tarjetas de débito y detalle de cuenta, gasto fijo con débito | ✅ v2.8.0 (en `main`) |

## Gotchas

- **Abono en otra moneda (2.8.0)**: en un `card_payment` convertido, `amount` +
  `currency` son lo que baja la TARJETA y `account_amount` lo que sale de la
  CUENTA (en la moneda de la cuenta). Toda suma de lo que salió de una cuenta
  debe usar `account_amount ?? amount` (lo hacen el trigger, `balance_derived`,
  `balanceEffects` y `TransactionList` en `context="account"`).
- **Cavos + Google (2.9.0)**: el modal de `@cavos/kit` 0.4.2 manda la página
  actual (origen + ruta) como `redirect_uri` de Google y Cavos exige esa URL
  exacta en sus Callback URLs. Por eso solo `/trading` inicia sesión
  (`WalletGate signInHere`); las demás páginas mandan ahí.
- **Stellar solo en el navegador (2.9.0)**: Cavos y Stellar Wallets Kit tocan
  `window`; se cargan con `StellarShell` (`next/dynamic`, `ssr:false`) solo en
  la pestaña Constelación. Nunca claves `S…` en el código ni en `.env`.
- **Tope de ~1000 filas (PostgREST)**: una lectura que necesita todas las filas
  (movimientos de tarjeta para el estado de cuenta) va paginada con `allRows`
  (`src/lib/supabase/all-rows.ts`) y un orden estable.

- **UI (2.4.0)**: `src/components/ui/*` ya no es el shadcn de fábrica (estados,
  alturas, superficies); un `npx shadcn add` que lo sobrescriba pierde el
  rediseño. El foco de enlaces/cards va con `outline` (`FOCUS_OUTLINE`), no con
  `ring`: el borde de `surface` es un `ring` y `dark:ring-*` le ganaría.
- **No editar a mano** el bloque de `AGENTS.md`: lo reescribe `next dev`. Commitéalo
  junto con tu trabajo para mantener el árbol limpio.
- Antes de tocar APIs de framework, leer la guía correspondiente en
  `node_modules/next/dist/docs/` — esta versión de Next tiene breaking changes.
- **Desde 3.1.0 (G7)** el Resumen convierte lo de dólares a colones con el último
  tipo de cambio (cobertura, faltante, consumo sin cortar, patrimonio); sin tipo de
  cambio, lo de dólares se lista pero no suma y el patrimonio lo indica.
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
- **Financiamiento con interés (2.3.0)**: `current_balance`/`usd_balance` incluyen
  el interés de cuotas futuras (el trigger no sabe de fechas). Toda pantalla que
  muestre saldo, disponible o patrimonio de una tarjeta debe pasarla por
  `withoutScheduledInterest` (`src/lib/card-balances.ts`); hoy lo hacen
  Tarjetas, detalle de tarjeta, Resumen y Arranque de 0.
- Gmail pide `gmail.readonly` + `gmail.send`; en Google Cloud el consent screen
  del cliente OAuth debe tener los dos scopes. Las conexiones previas a 2.3.0 no
  pueden enviar hasta reconectar.
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
