# Changelog

## 2.0.0 — en desarrollo

Rediseño por dominio (DDD pragmático): la lógica de negocio se separa de la
base de datos, el login y el correo para que pueda cambiar la infraestructura
sin tocar las reglas.

### Fase 0 — lenguaje y reglas
- `docs/dominio/`: glosario, mapa de contextos, reglas (rechaza vs. advierte)
  y arquitectura objetivo, a partir del documento *BusinessLogic Finance OS*.
- Historia propuesta de financiamiento con interés (tabla de amortización) en
  `docs/historias-usuario/tarjetas.md`.
- Se descarta la sincronización automática de correo (v1.3.1): siempre manual.

### Fase 1 — dominio puro
- `src/domain/`: dinero en céntimos, calendario, libro de movimientos (signos y
  saldos derivados), estado de cuenta de tarjetas, cuotas tasa 0, tabla de
  amortización (sistema francés) y cobertura del débito. 42 tests con
  `node --test`, sin base de datos.
- ESLint impide que `src/domain/` importe Next, React, Supabase, Zod o `@/`.
- El dashboard, el registro de movimientos y la aprobación de pendientes usan
  las reglas del dominio; se eliminan `src/lib/cards.ts` y `src/lib/dates.ts`.

## 1.3.0 — 2026-10-08

Compras con tarjeta importadas automáticamente desde los correos del banco,
sin IA ni tokens, con una bandeja para confirmarlas.

### Añadido
- **Bancos** (`/ajustes/bancos`): registrá los bancos con sus remitentes y el
  formato del correo; conectá tu Gmail con permiso de **solo lectura**
  (OAuth, token guardado cifrado con AES-256-GCM). Solo se leen correos de los
  remitentes que registrás.
- **Por confirmar** (`/procesos/pendientes`): las compras detectadas llegan a una
  bandeja; al aprobar eligís tarjeta y categoría y se crea el gasto (el trigger
  ajusta el saldo). Botón "Sincronizar" para leer el correo al momento. El índice
  de Procesos muestra cuántas hay pendientes.
- **Parser determinístico por banco** (`src/lib/mail/parsers/`), primero BAC
  Credomatic, con fixture real y tests. Agregar un banco = un archivo + registro.
- **Categoría sugerida por comercio** (`merchant_rules`): se aprende al aprobar.
- Selector de **banco** opcional en la tarjeta; la tarjeta se identifica por sus
  últimos 4 dígitos (`last_four`) y se desempata con el banco.
- Ruta `/api/sync-mail` (Bearer `CRON_SECRET`, service role, idempotente) lista
  para el cron de la v1.3.1.
- Página pública `/privacidad` (requisito de Google OAuth) y `npm test`.
- Historia de usuario nueva: `docs/historias-usuario/bancos.md`.

### Base de datos
- `supabase/Versionamiento/1.3.0/00_banks_and_pending.sql`: tablas `banks`,
  `mail_connections`, `pending_transactions`, `merchant_rules` y
  `credit_cards.bank_id`.

### Configuración
- Variables nuevas (ver `.env.example`): `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `MAIL_TOKEN_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `CRON_SECRET`.

### Pendiente (v1.3.1)
- Workflow de GitHub Actions que sincroniza cada 2 h (hoy la lectura es manual).

## 1.2.3 — 2026-09-11

Mejoras de UI/UX orientadas a mobile: Resumen más útil, acceso rápido a
gastos y tablas sin scroll horizontal.

### Añadido
- **Botón flotante "Nuevo gasto"** visible en todas las pantallas (Resumen,
  Procesos, Ajustes), pensado para el uso diario desde el celular.
  `TransactionForm` gana la prop `fab`; los datos se cargan una vez en
  `src/app/(app)/layout.tsx`.
- **Resumen** con dos stats nuevos: "Gasto del mes" (todos los gastos del
  mes en curso) y "Financiamientos activos" (cantidad + total pendiente en
  cuotas futuras, sumado a la línea de patrimonio neto).
- **Tablas responsive**: Cuentas, Tarjetas, Movimientos y Financiamientos se
  ven como tarjetas apiladas en mobile (`src/components/mobile-list.tsx`) —
  sin scroll horizontal y con las acciones de editar/borrar siempre a la
  vista. En pantallas `sm`+ se ven exactamente igual que antes.

## 1.2.2 — 2026-09-11

Financiamientos de tarjeta de crédito (tasa 0, sin intereses).

### Añadido
- **Financiamientos** en el detalle de tarjeta (`/procesos/tarjetas/[id]`): registrá
  una compra a cuotas (descripción, categoría, monto total, número de meses, fecha
  de la compra) y se reparte en cuotas mensuales iguales, con el mismo día de la
  compra (ajustado en meses cortos). El total baja el **disponible** de la tarjeta
  de inmediato (igual que un banco bloquea el cupo completo), aunque cada cuota
  "cae a cobro" en su mes correspondiente. Tabla `financings` + stored procedure
  `create_financing` (crea el plan y sus N cuotas en una sola transacción) —
  `supabase/Versionamiento/1.2.2/`.
- Las cuotas aparecen en "Movimientos" marcadas como "Cuota" (no editables/borrables
  individualmente); un financiamiento se borra completo desde la nueva sección, lo
  que revierte todo su efecto en el saldo.

### Cambiado
- `cardStatement` (`src/lib/cards.ts`) ahora distingue cargos/pagos **ya ocurridos**
  de los **programados a futuro** (cuotas de un financiamiento que aún no llegan a su
  fecha): estos últimos no cuentan todavía como "consumo sin cortar" ni afectan lo
  que falta pagar, aunque sí forman parte de la deuda total y del disponible.
- **Convención de base de datos**: `supabase/migrations/` queda congelada como
  historial; el SQL nuevo (esquema y funciones) se organiza por versión en
  `supabase/Versionamiento/<version>/`, numerado en orden de ejecución.

## 1.2.1 — 2026-09-07

Estado de cuenta de tarjetas, alerta de atraso y categorías configurables.

### Añadido
- **Estado de cuenta por tarjeta** (`cardStatement` en `src/lib/cards.ts`): saldo al
  corte, pagos aplicados desde el corte, **cuánto falta pagar de contado** antes de la
  fecha límite y consumo aún sin cortar. Se calcula desde los movimientos con fecha.
- **Alerta de atraso**: si venció la fecha límite y queda saldo de contado sin pagar,
  banner rojo "Atrasada N días — genera intereses" en el detalle de la tarjeta y en el
  Resumen.
- **Categorías configurables** (`/ajustes/categorias`): CRUD de categorías de gastos e
  ingresos, con botón "cargar categorías sugeridas". Los selectores de gasto/ingreso
  usan estas; las listas fijas quedan como fallback. Tabla `categories` —
  `supabase/migrations/20260906130000_categories.sql`.
- **Botón "ver detalle"** (ícono de ojo) en cada fila de la lista de tarjetas.
- **Botón de regresar** (`← <sección>`) arriba a la izquierda en las sub-páginas
  (`src/components/back-link.tsx`).

### Cambiado
- **Resumen** rediseñado: los montos a pagar son ahora **de contado** (`dueAmount`),
  no el saldo total; pagos agrupados en "Atrasadas" / "Por vencer"; stat "Consumo sin
  cortar"; banner de tarjetas atrasadas.
- La lista de tarjetas muestra una columna **Estado** (al día / pendiente / atrasada) y
  cuánto falta pagar.

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
