# Finance OS

App personal de finanzas: cortes y pagos de tarjetas de crédito, financiamientos,
préstamos, gastos, saldos de cuentas de débito y ahorros. Se construye por pasos.
Pensada para móvil (web) e **instalable** en la pantalla de inicio.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui ·
Supabase (Auth + Postgres con RLS) · deploy en Vercel.

## Estado

| Paso | Alcance | Estado |
|------|---------|--------|
| 1 | Base desplegable + auth + módulo de **cuentas de débito** y **tarjetas de crédito** (saldo, corte, pago) | ✅ |
| 2 | Movimientos / gastos y actualización de saldos | ⏳ |
| 3 | Financiamientos y préstamos (amortización) | ⏳ |
| 4 | Ahorros y metas | ⏳ |

## Puesta en marcha

1. **Crear proyecto en Supabase** y copiar las llaves:

   ```bash
   cp .env.example .env.local
   # rellena NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```

2. **Aplicar el esquema**: pega `supabase/migrations/20260902180000_init.sql` en el
   SQL Editor de Supabase (o `supabase db push` con la CLI).

3. **Correr en local**:

   ```bash
   npm run dev
   ```

   Abre <http://localhost:3000>, regístrate con correo y contraseña. Si en
   Supabase tienes activada la confirmación por email, confirma antes de entrar.

## Deploy en Vercel

1. Importa el repo en Vercel (framework: Next.js, sin configuración extra).
2. Añade las variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   en *Project → Settings → Environment Variables*.
3. En Supabase → *Authentication → URL Configuration*, agrega la URL de Vercel a
   *Site URL* y *Redirect URLs*.

## Estructura

```
src/
  proxy.ts                 refresco de sesión + guardas de ruta (antes middleware)
  lib/
    supabase/{client,server,proxy}.ts
    auth.ts                getUser / requireUser (DAL)
    schema.ts              validación Zod de formularios
    cards.ts               cálculo de próximo corte y fecha de pago
    dates.ts               crToday() — "hoy" en la zona de Costa Rica
    format.ts              moneda (CRC / ₡) / fechas (es-CR)
    session-actions.ts     signOutAction()
  components/
    app-nav.tsx            barra superior + barra inferior de pestañas (móvil)
    user-menu.tsx          avatar + menú de sesión
  app/
    layout.tsx             metadata, viewport, theme-color
    manifest.ts            web manifest (instalable)
    login/                 alta e inicio de sesión
    (app)/
      loading.tsx          esqueleto de carga entre vistas
      dashboard/           resumen: próximos pagos y cortes
      cuentas/             CRUD de cuentas
      tarjetas/            CRUD de tarjetas
public/icon.svg            ícono de la app
supabase/migrations/       SQL del esquema
```
