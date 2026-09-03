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
| Server Actions | `src/app/(app)/<modulo>/actions.ts` | `"use server"`. Devuelven `FormResult` (`src/lib/forms.ts`). Patrón: `requireUser()` → `schema.safeParse(Object.fromEntries(formData))` → si falla `fieldErrors()` → insert/update por `id` → `revalidatePath()` de la ruta y `/dashboard`. Sesión: `signOutAction()` en `src/lib/session-actions.ts`. |
| Validación | `src/lib/schema.ts` | Zod: `accountSchema`, `creditCardSchema` + tipos inferidos. `ACCOUNT_TYPES`, `CURRENCIES`. |
| Formularios CRUD en diálogo | `src/lib/use-dialog-form.ts` + `<modulo>/{account,card}-form.tsx` | Componentes de apoyo: `src/components/form-field.tsx`, `delete-button.tsx`, `ui/dialog.tsx`. |
| Fecha "hoy" | `src/lib/dates.ts` | `crToday()` → día calendario actual en `America/Costa_Rica` (UTC-6, sin DST) como Date a medianoche local. Es el default de `from` en `cards.ts` y `daysUntil`, para no depender de la zona del servidor (Vercel = UTC). |
| Lógica de tarjetas | `src/lib/cards.ts` | `nextCutoffDate(cutoffDay)`, `nextPaymentDate(cutoffDay, paymentDueDay)` (ambas `from = crToday()`). Maneja meses cortos (clamp de día). |
| Formato es-CR | `src/lib/format.ts` | `formatCurrency` (default `CRC`, símbolo ₡ forzado con `narrowSymbol`), `formatDate`, `daysUntil` (`from = crToday()`), `relativeDayLabel` ("hoy" / "mañana" / "en 5 días" / "hace 2 días"). Monedas soportadas: `CRC` (default) y `USD` — ver `CURRENCIES` en `src/lib/schema.ts`. |
| Resumen / dashboard | `src/app/(app)/dashboard/page.tsx` | Server component; calcula contra `crToday()`. Secciones: próximos pagos (ordenados por urgencia, semáforo vencido/hoy·≤3·≤10·+10, cobertura acumulada contra el débito en `checking`/`CRC`) y próximos cortes. |
| Tipos de dominio | `src/lib/types.ts` | `Account`, `CreditCard`. |
| Rutas | `src/app/login/` (auth), grupo `src/app/(app)/` (protegido: `layout.tsx` llama `requireUser()`) | `src/app/(app)/loading.tsx` = esqueleto de carga entre vistas (envuelve `page`, no el layout). |
| Navegación | `src/components/app-nav.tsx` (`"use client"`) | `AppTopBar` (marca "Finance OS" + pestañas en `sm+` + `UserMenu`) y `AppBottomNav` (tabs inferiores en móvil, `sm:hidden`). `useLinkStatus` para el spinner en la pestaña tocada. `UserMenu` (`src/components/user-menu.tsx`): avatar con iniciales + dropdown con correo y cerrar sesión. |
| Instalable (PWA-lite) | `src/app/manifest.ts`, `public/icon.svg`, `viewport`/`metadata` en `src/app/layout.tsx` | `display: standalone`, `theme-color` claro/oscuro, `apple-touch-icon`. Sin service worker. |

- **Degrada con gracia sin variables de Supabase**: `getUser()` atrapa el error; útil
  para CI y primer arranque. No romper este comportamiento.

## Base de datos

- Esquema: `supabase/migrations/` (p. ej. `20260902180000_init.sql`). Aplicar en el
  SQL Editor de Supabase o con `supabase db push`.
- Config local: `supabase/config.toml`.
- Tablas: `accounts` (checking/savings/cash) y `credit_cards` (con `cutoff_day`,
  `payment_due_day`, `current_balance`). **Ambas con RLS por `auth.uid()`** y columna
  `user_id` con default `auth.uid()`. Cada tabla nueva debe seguir el mismo patrón de
  4 policies (select/insert/update/delete own) + índice parcial `where not archived`.
- Columna `currency`: `text not null default 'CRC' check (currency in ('CRC', 'USD'))`.

## Comandos

```bash
npm run dev     # next dev (Turbopack)
npm run build
npm run lint     # eslint
```

## Roadmap

| Paso | Alcance | Estado |
|------|---------|--------|
| 1 | Base desplegable + auth + **cuentas de débito** + **tarjetas de crédito** (saldo, corte, pago) + dashboard resumen | ✅ v1.0.0 (tag + release) |
| 2 | Movimientos / gastos y actualización de saldos | ⏳ |
| 3 | Financiamientos y préstamos (amortización) | ⏳ |
| 4 | Ahorros y metas | ⏳ |

## Gotchas

- **No editar a mano** el bloque de `AGENTS.md`: lo reescribe `next dev`. Commitéalo
  junto con tu trabajo para mantener el árbol limpio.
- Antes de tocar APIs de framework, leer la guía correspondiente en
  `node_modules/next/dist/docs/` — esta versión de Next tiene breaking changes.
- El dashboard acota sus totales y la cobertura a `CRC`; las tarjetas en `USD` se
  listan pero **no** entran en la matemática de cobertura. `Patrimonio neto` sí
  suma todo de forma naïve — pendiente multi-moneda de verdad.
