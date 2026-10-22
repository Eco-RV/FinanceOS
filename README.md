# Finance OS

App personal de finanzas para Costa Rica (un solo usuario): cuentas de débito,
tarjetas de crédito con su corte y fecha de pago, gastos e ingresos,
transferencias, financiamientos con o sin interés, préstamos bancarios y cobros
a la familia. Pensada para el celular (web) e **instalable** en la pantalla de
inicio. Colones (₡) por defecto; lo que está en dólares se convierte con el tipo de
cambio del BCCR, que la app trae sola cada día.

**Versión actual:** 3.2.0 — ver [`CHANGELOG.md`](./CHANGELOG.md) y los
[releases](https://github.com/Eco-RV/FinanceOS/releases).

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript ·
Tailwind v4 · shadcn/ui · Supabase (Auth + Postgres con RLS) · Zod v4 · deploy
en Vercel.

## Qué hace

| Sección | Qué podés hacer |
|---|---|
| **Resumen** | Disponible en débito, lo que hay que pagar de contado, consumo sin cortar, gastos de 7 días / mes / año comparados con el período anterior (también por categoría), pagos próximos con alerta de atraso, cobertura del débito, próximos cortes, recordatorios y avisos por enviar. Todo en colones, con lo de dólares convertido. |
| **Cuentas** | Débito, ahorro y efectivo, con saldo inicial y saldos que se mueven solos. |
| **Tarjetas** | Corte, fecha de pago, estado de cuenta (saldo al corte, pago de contado, consumo sin cortar, pago mínimo), saldo en ₡ y $, límite y disponible con el tipo de cambio, abonos, e historial con filtros y filas por página. |
| **Financiamientos** | Compras a cuotas sobre una tarjeta (en colones o dólares), a tasa 0 o con interés, de 2 a 72 meses; abonos extraordinarios (baja plazo o cuota), editar, cancelar conservando lo cobrado y repartir cuotas entre miembros de la familia. |
| **Gastos / Ingresos** | Registro rápido (botones flotantes ↑ gasto / ↓ ingreso) con categorías configurables, SINPE, tarjeta de débito y comprobante adjunto. |
| **Gastos compartidos** | Pagas el total y lo divides entre varias personas (por monto o porcentaje); registras quién te pagó y por qué medio y les avisas por WhatsApp o correo. |
| **Transferencias** | Entre cuentas propias de la misma moneda (no cuentan como gasto). |
| **Préstamos** | Préstamos bancarios a cuota fija: calendario, intereses, capital pendiente, pago en orden, abonos extraordinarios y tasa variable. |
| **Planes y ahorros** | Salario (fijo o variable), gastos fijos y seguros que se registran solos, línea base contra el salario, y metas de ahorro (varias por cuenta, con apartados). |
| **Cobros a miembros** | Lo que te deben de cuotas y gastos compartidos, y avisos de su parte por WhatsApp o correo. |
| **Por confirmar** | Compras leídas de los correos del banco (Gmail, sin IA) para aprobar o descartar. |
| **Ajustes** | Categorías, bancos y Gmail (con reglas de comercio), miembros, verificar saldos, tipo de cambio (BCCR), Arranque de 0 (con consulta de lo archivado), cuenta (Google, borrar la cuenta) y preferencias (moneda base, formato de fecha). |

El detalle funcional de cada proceso está en
[`docs/historias-usuario/`](./docs/historias-usuario/) y las reglas de negocio
en [`docs/dominio/`](./docs/dominio/).

## Puesta en marcha

1. **Instalar dependencias**

   ```bash
   npm install
   cp .env.example .env.local
   ```

   Rellená al menos `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (Supabase → *Project Settings → API*). Sin ellas la app arranca, pero no deja
   iniciar sesión.

2. **Crear la base de datos.** En el SQL Editor de Supabase corré, en este orden,
   cada carpeta de `supabase/Versionamiento/` y dentro de cada una sus archivos en
   orden numérico:

   | Versión | Archivos |
   |---|---|
   | 1.2.1 | `20260902180000_init.sql`, `20260906120000_transactions.sql`, `20260906130000_categories.sql` |
   | 1.2.2 | `00_financings_schema.sql`, `01_create_financing_function.sql` |
   | 1.3.0 | `00_banks_and_pending.sql` |
   | 2.0.0 | `00_opening_balance.sql` … `06_multicurrency_cards.sql` |
   | 2.1.0 | `00_drop_create_financing.sql`, `01_loans.sql` |
   | 2.2.0 | `00_fresh_start.sql` |
   | 2.3.0 | `00_financing_interest.sql`, `01_members.sql`, `02_mail_send_scope.sql` |
   | 2.5.0 | `00_category_icons.sql` |
   | 2.6.0 | `00_profiles.sql`, `01_avatars_storage.sql` |
   | 2.7.0 | `00_plans.sql`, `01_savings_goals.sql` |
   | 2.8.0 | `00_card_cutoff_rollover.sql`, `01_debit_cards.sql`, `02_card_payment_exchange.sql` |
   | 3.0.0 | `00_stellar_wallets.sql`, `01_constellation_stars.sql`, `02_family_invites.sql`, `03_academy_progress.sql` |
   | 3.2.0 | `00_auditoria_rls.sql` (solo lectura), `01_feedback.sql`, `02_feedback_admin.sql` (cambiar el correo) |
   | 3.1.0 | `00_shared_expenses.sql`, `01_fresh_start_shared.sql`, `02_insurance_debit_card.sql`, `03_card_minimum_payments.sql`, `04_financing_currency.sql`, `05_loan_adjustments.sql`, `06_financing_prepayments.sql`, `07_variable_plans.sql`, `08_goal_allocations.sql`, `09_receipts.sql` |

   Al actualizar una base existente, corre solo las carpetas de las versiones
   nuevas, **antes** de desplegar el código.

3. **Correr en local**

   ```bash
   npm run dev
   ```

   Abrí <http://localhost:3000> y registrate con correo y contraseña. Si en
   Supabase está activada la confirmación por correo, confirmá antes de entrar.

### Correo (opcional)

Para importar compras desde Gmail y enviar los avisos de cuota por correo:

1. En Google Cloud creá un cliente OAuth tipo *Aplicación web* con la redirección
   `<tu-url>/api/gmail/callback`, y agregá los scopes `gmail.readonly` y
   `gmail.send` a la pantalla de consentimiento.
2. Completá en `.env.local` (y en Vercel) `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`, `MAIL_TOKEN_KEY` (`openssl rand -base64 32`),
   `SUPABASE_SERVICE_ROLE_KEY` (solo servidor) y `CRON_SECRET`.
3. En la app: **Ajustes → Bancos → Conectar Gmail**.

## Comandos

```bash
npm run dev     # servidor de desarrollo
npm run build   # build de producción
npm run lint    # ESLint
npm test        # pruebas (dominio, casos de uso, parsers de correo, cifrado)
```

## Deploy en Vercel

1. Importá el repo en Vercel (framework: Next.js, sin configuración extra).
2. Agregá las variables de `.env.example` en *Project → Settings → Environment
   Variables*.
3. En Supabase → *Authentication → URL Configuration*, agregá la URL de Vercel a
   *Site URL* y *Redirect URLs*.

## Estructura

```
src/
  domain/          reglas de negocio puras, con pruebas (dinero, calendario,
                   movimientos, tarjetas, financiamientos, préstamos, miembros…)
  application/     casos de uso y puertos (repositorios); probados con fakes
  infrastructure/  adaptador Supabase de los puertos (+ envío por Gmail)
  app/
    login/         alta e inicio de sesión
    (app)/         rutas protegidas
      dashboard/   Resumen
      procesos/    cuentas, tarjetas (+ financiamientos), gastos, ingresos,
                   transferencias, préstamos, cobros, pendientes
      ajustes/     categorías, bancos, miembros, saldos, tipo de cambio, arranque
    api/           Gmail (OAuth) y sincronización de correo
  components/      UI compartida (navegación, formularios, listas móviles)
  lib/             Supabase, auth, validación (Zod), formato es-CR, correo
supabase/Versionamiento/<versión>/   SQL de cada versión, en orden de ejecución
docs/
  historias-usuario/   qué hace cada proceso (documento vivo)
  dominio/             glosario, reglas y arquitectura
  CONTEXT.md           guía técnica para agentes y desarrollo
```

## Cómo se trabaja

- `main` es lo publicado; `dev_main` es la rama de integración.
- Cada versión o feature sale de `dev_main` en su propia rama (p. ej.
  `feature/2.3.0`) y vuelve por PR; `dev_main` pasa a `main` al publicar, con su
  etiqueta y release.
- Documentación y ajustes menores van directo en `dev_main`.
- Detalle completo (despliegue, SQL versionado, releases y checklist):
  [`docs/flujo-de-trabajo.md`](./docs/flujo-de-trabajo.md).
- El SQL nuevo va en `supabase/Versionamiento/<versión>/` y los cambios de
  comportamiento se documentan en `docs/historias-usuario/` en el mismo cambio.
