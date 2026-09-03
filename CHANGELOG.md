# Changelog

## 1.0.0 — 2026-09-02

Primera versión. Base desplegable + Paso 1.

### Añadido
- Base Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind v4 + shadcn/ui.
- Autenticación con Supabase (correo + contraseña); sesión refrescada en `src/proxy.ts`.
- RLS por usuario y capa de acceso a datos (`getUser` / `requireUser`).
- **Cuentas**: CRUD de cuentas de débito, ahorro y efectivo con saldo.
- **Tarjetas**: CRUD con cálculo del próximo corte y de la fecha límite de pago.
- **Resumen**: totales de cuentas, deuda en tarjetas, patrimonio neto y próximos pagos.
- Esquema SQL en `supabase/migrations/` y `supabase/config.toml`.

### Pendiente
- Paso 2: movimientos / gastos y actualización automática de saldos.
- Paso 3: financiamientos y préstamos.
- Paso 4: ahorros y metas.
