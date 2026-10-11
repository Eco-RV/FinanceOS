# Arquitectura objetivo (2.0.0)

> Cómo se separa la lógica de negocio del resto. Ver mapa de contextos en
> [`contextos.md`](./contextos.md).

## Capas

```
src/domain/          Reglas puras (TypeScript sin next, supabase ni zod).
                     Dinero, movimientos, saldos, estado de cuenta,
                     amortización, línea base… Se prueban con `node --test`.
src/application/     Casos de uso ("registrar abono", "aprobar pendiente") y
                     las interfaces (puertos) que necesitan: repositorios,
                     notificador, lector de avisos, tipo de cambio, reloj.
src/infrastructure/  Adaptadores: Supabase, Gmail, cifrado, correo/WhatsApp.
src/app/             Next.js: páginas y Server Actions delgadas que llaman a
                     los casos de uso.
```

Regla de dependencias: `app → application → domain` e
`infrastructure → application/domain`. **El dominio no importa nada de las
otras capas.**

## Estado actual (punto de partida, v1.3.0)

Ya cerca del dominio: `src/lib/cards.ts` (estado de cuenta), `src/lib/dates.ts`,
`src/lib/transactions.ts`, `src/lib/mail/parsers/` (contrato `MailParser`).

Reglas que hoy viven fuera del dominio y se deben mover:

- Signos y saldos: trigger `transactions_balance_sync` en Postgres.
- Cobertura del débito y totales: `src/app/(app)/dashboard/page.tsx`.
- Misma moneda en un abono: `src/app/(app)/procesos/_transactions/actions.ts`.
- Aprobar pendiente: `src/app/(app)/procesos/pendientes/actions.ts`.
- Generación de cuotas: SP `create_financing` en Postgres.

## Fases

0. **Lenguaje y reglas** (esta carpeta). ✅
1. `src/domain/` puro con tests. ✅ (ver detalle abajo)
2. Casos de uso + puertos; Server Actions delgadas; Supabase como adaptador. ✅ para los flujos con reglas (ver detalle abajo)
3. Saldos: el dominio decide; el saldo guardado (o el trigger) queda como
   proyección para rendimiento, verificable contra los movimientos. ✅ (ver detalle abajo)

## Fase 1 — qué quedó en `src/domain/`

| Módulo | Reglas | Antes vivía en |
|---|---|---|
| `shared/money.ts` | G3, reparto exacto en céntimos, conversión explícita | — (nuevo) |
| `shared/calendar.ts` | G6 (hoy en CR), T5 (meses cortos) | `src/lib/dates.ts`, `daysUntil` de `src/lib/format.ts` |
| `ledger/movement.ts` | G1 (saldos derivados), signos del trigger, G2, M1, M3, M5 | trigger SQL + `saveTransaction` |
| `cards/statement.ts` | T3–T7, M7 | `src/lib/cards.ts` |
| `financing/installments.ts` | F1, F2, M7 | SP `create_financing` (el SP sigue insertando; ahora la regla también está en TS) |
| `financing/amortization.ts` | F5 | — (nuevo, base para 2.0.0) |
| `coverage/coverage.ts` | Cobertura del débito vs. pagos de contado | `dashboard/page.tsx` |

En la Fase 3 el trigger de saldos quedó como proyección verificable y el SP
de cuotas dejó de calcular (ver abajo).

## Fase 2 — casos de uso y adaptadores

| Pieza | Archivo | Qué hace |
|---|---|---|
| Puertos | `src/application/ports.ts` | Interfaces que necesitan los casos de uso: cuentas, tarjetas, movimientos, financiamientos, pendientes, reglas de comercio. |
| Resultado | `src/application/result.ts` | `UseCaseResult` (`ok` / `fail` con id de regla); `run()` convierte `DomainError` e `InfrastructureError` en un fallo mostrable. |
| Casos de uso | `src/application/{movements,financings,pending}.ts` | `saveMovement`, `deleteMovement`, `createFinancing`, `deleteFinancing`, `approvePending`, `rejectPending`. Probados con fakes en memoria (`fakes.test-helpers.ts`). |
| Adaptador | `src/infrastructure/supabase/repositories.ts` | Implementa los puertos con Supabase (RLS por usuario). |
| Contenedor | `src/infrastructure/container.ts` | `repositories()`: el único lugar donde se elige la base de datos. |
| Server Actions | `src/app/(app)/procesos/{_transactions,_financiamientos,pendientes}/actions.ts` | Solo: sesión → validar formulario (Zod) → caso de uso → refrescar vistas. |

Decisiones de esta fase:

- **Lecturas directas (CQRS liviano)**: las páginas siguen consultando
  Supabase para mostrar datos; los cálculos sí pasan por el dominio
  (`cardStatement`, `computeCoverage`). Solo las **escrituras** pasan por casos
  de uso, que es donde viven las reglas.
- **CRUD sin reglas propias** (cuentas, tarjetas, categorías, bancos) y la
  sincronización de correo todavía hablan con Supabase desde su action; se
  migran cuando ganen reglas (p. ej. G5 desactivar vs. eliminar, C3 una
  tarjeta de débito por cuenta).
- `G4` empieza a aplicarse: una cuenta o tarjeta archivada ya no se ofrece
  como origen al registrar (el adaptador no la encuentra).

## Fase 3 — saldos como proyección verificable

| Pieza | Dónde | Qué hace |
|---|---|---|
| Saldo inicial | `opening_balance` en `domain/ledger/movement.ts` + `00_opening_balance.sql` | C1: el saldo de apertura es un movimiento con signo; un solo activo por cuenta/tarjeta (índice único parcial). |
| Casos de uso | `application/products.ts` (`saveAccount`, `saveCard`, `setOpeningBalance`) | Guardan la cuenta/tarjeta y su saldo inicial; nunca escriben `current_balance`. |
| Proyección | `01_balance_projection.sql` (`balance_derived`, `balance_drift`, `recompute_balances()`) | El trigger sigue manteniendo `current_balance` por rendimiento; estas piezas lo comparan y lo reparan. |
| Verificación | `findBalanceDrift` (dominio) + `application/balances.ts` + `/ajustes/saldos` | Compara guardado vs. derivado con la regla del dominio y ofrece recalcular. |
| Migración | `02_migrate_opening_balances.sql` | Convierte los saldos de apertura digitados en movimientos; los saldos quedan iguales. |
| Cuotas | `03_create_financing_v2.sql` + adaptador | El dominio calcula el plan (`installmentSchedule`); la base solo lo guarda y valida cantidad y suma. |

Probado contra Postgres (PGlite) con datos de 1.3.0: saldos idénticos antes y
después, `balance_drift` vacío e idempotente.

El SP `create_financing` (1.2.2) queda sin uso; se puede borrar en 2.1.

## Decisiones de infraestructura

| Tema | Decisión | Fecha |
|---|---|---|
| Base de datos | Supabase se mantiene por ahora, **siempre detrás de repositorios**. La meta de privacidad (cifrado de extremo a extremo o local-first) se decide al terminar la Fase 1. Por eso el dominio debe poder correr igual en el servidor y en el dispositivo. | 2026-10-11 |
| Login | Supabase Auth: correo + contraseña (con cambio de contraseña) y **Google**. | 2026-10-11 |
| Blockchain (Stellar, Cavos/Starknet) | Fuera de alcance: los datos viven en bancos tradicionales, un ledger público expone montos y comercios, y el negocio exige editar y eliminar. Si algún día aplica, entra como un adaptador más. | 2026-10-11 |
| Sincronización de correo | Manual. Se descarta el cron cada 2 h planeado para v1.3.1. | 2026-10-11 |
| Avisos a familia | Correo y WhatsApp vía un puerto `Notificador`. Requieren un servicio que corra aunque el dispositivo esté apagado. | 2026-10-11 |
