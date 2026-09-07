# Changelog

## 1.2.0 — 2026-09-06

Paso 2: movimientos y actualización automática de saldos.

### Añadido
- **Procesos**: nueva sección índice (`/procesos`) que agrupa Cuentas, Tarjetas,
  Gastos e Ingresos.
- **Gastos** (`/procesos/gastos`) e **Ingresos** (`/procesos/ingresos`): CRUD de
  movimientos. Un gasto sale de una cuenta de débito o se carga a una tarjeta; un
  ingreso entra a una cuenta.
- **Saldos automáticos**: trigger de Postgres `transactions_balance_sync` que
  ajusta el saldo de la cuenta y/o tarjeta en cada alta, edición o baja de
  movimiento (las filas archivadas no afectan saldos).
- **Detalle de tarjeta** (`/procesos/tarjetas/[id]`): saldo, límite, disponible,
  próximo corte y pago, historial de cargos y pagos, y acción "Registrar pago /
  abono" que baja el saldo de la cuenta origen y de la tarjeta.
- **Ajustes** (`/ajustes`): correo, cerrar sesión y secciones "próximamente"
  (Cuenta / App / Parámetros).
- Tabla `transactions` (RLS por usuario) —
  `supabase/migrations/20260906120000_transactions.sql`.

### Cambiado
- **Navegación**: 3 pestañas — Resumen · Procesos · Ajustes.
- `/cuentas` y `/tarjetas` se movieron a `/procesos/cuentas` y `/procesos/tarjetas`
  (redirección 308 desde las rutas viejas en `next.config.ts`).
- El campo "Saldo actual" de cuentas y tarjetas pasa a ser **saldo de apertura /
  ajuste manual**; los movimientos lo modifican por deltas.

## 1.1.0 — 2026-09-02

App nativa para Costa Rica, orientada a móvil.

### Añadido
- **Resumen** rediseñado: sección de próximos pagos ordenada por urgencia
  (vencido/hoy · ≤3 · ≤10 · +10 días) con semáforo y barra de cuenta regresiva,
  cobertura acumulada de los pagos contra el saldo de débito, y sección aparte de
  próximos cortes.
- Pantalla de **carga** al navegar entre vistas (`src/app/(app)/loading.tsx`) +
  spinner en la pestaña tocada (`useLinkStatus`).
- App **instalable** en el celular: `manifest.webmanifest`, ícono, `theme-color` y
  modo `standalone` (agregar a pantalla de inicio).

### Cambiado
- **Navegación** rediseñada para móvil: barra inferior de pestañas en el celular,
  barra superior pegajosa con la marca, y menú de usuario con avatar e iniciales en
  vez del correo suelto + botón "Salir".
- Nombre visible de la app: **Finance OS** (antes `FinanceOS`).
- Moneda base a **colón costarricense** (`CRC`, símbolo ₡); locale `es-CR`.
  Monedas soportadas: `CRC` (por defecto) y `USD`. La columna `currency` cambia su
  default a `'CRC'` y añade `check (currency in ('CRC', 'USD'))`.
- Las fechas de corte/pago y el "en X días" se calculan contra la fecha de
  **Costa Rica** (`America/Costa_Rica`), no la del servidor (`src/lib/dates.ts`).

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
- Paso 3: financiamientos y préstamos.
- Paso 4: ahorros y metas.
