# Finance OS

App personal de finanzas para Costa Rica (un solo usuario): cuentas de débito,
tarjetas de crédito con su corte y fecha de pago, gastos e ingresos,
transferencias, financiamientos con o sin interés, préstamos bancarios y cobros
a la familia. Pensada para el celular (web) e **instalable** en la pantalla de
inicio. Colones (₡) por defecto, con dólares en tarjetas bimoneda.

**Versión actual:** 2.5.0 — ver [`CHANGELOG.md`](./CHANGELOG.md) y los
[releases](https://github.com/Eco-RV/FinanceOS/releases).

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript ·
Tailwind v4 · shadcn/ui · Supabase (Auth + Postgres con RLS) · Zod v4 · deploy
en Vercel.

## Qué hace

| Sección | Qué podés hacer |
|---|---|
| **Resumen** | Disponible en débito, lo que hay que pagar de contado, consumo sin cortar, gasto del mes, pagos próximos (tarjetas y cuotas de préstamos) con alerta de atraso, cobertura del débito, próximos cortes y avisos de cuota por enviar. |
| **Cuentas** | Débito, ahorro y efectivo, con saldo inicial y saldos que se mueven solos. |
| **Tarjetas** | Corte, fecha de pago, estado de cuenta (saldo al corte, pago de contado, consumo sin cortar), saldo en ₡ y $, límite y disponible con tipo de cambio manual, abonos. |
| **Financiamientos** | Compras a cuotas sobre una tarjeta, a tasa 0 o con interés (tabla de amortización), de 2 a 72 meses; editar, cancelar conservando lo cobrado y repartir cuotas entre miembros de la familia. |
| **Gastos / Ingresos** | Registro con categorías configurables; gastos por SINPE. |
| **Transferencias** | Entre cuentas propias de la misma moneda (no cuentan como gasto). |
| **Préstamos** | Préstamos bancarios a cuota fija: calendario, intereses, capital pendiente, pago en orden. |
| **Cobros a miembros** | Lo que te debe cada familiar y avisos de su parte por WhatsApp o correo, una vez por quincena. |
| **Por confirmar** | Compras leídas de los correos del banco (Gmail, sin IA) para aprobar o descartar. |
| **Ajustes** | Categorías, bancos y Gmail, miembros, verificar saldos, tipo de cambio y Arranque de 0. |

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

   Al actualizar una base existente, corré solo las carpetas de las versiones
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
