# FinanceOS

App personal de finanzas: cortes y pagos de tarjetas de crédito, financiamientos,
préstamos, gastos, saldos de cuentas de débito y ahorros. Se construye por pasos.

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

2. **Aplicar el esquema**: pega `supabase/migrations/0001_init.sql` en el
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
    format.ts              moneda / fechas (es-MX)
  app/
    login/                 alta e inicio de sesión
    (app)/                 rutas protegidas
      dashboard/           resumen y próximos pagos
      cuentas/             CRUD de cuentas
      tarjetas/            CRUD de tarjetas
supabase/migrations/       SQL del esquema
```
