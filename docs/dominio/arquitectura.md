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
1. `src/domain/` puro con tests.
2. Casos de uso + puertos; Server Actions delgadas; Supabase como adaptador.
3. Saldos: el dominio decide; el saldo guardado (o el trigger) queda como
   proyección para rendimiento, verificable contra los movimientos.

## Decisiones de infraestructura

| Tema | Decisión | Fecha |
|---|---|---|
| Base de datos | Supabase se mantiene por ahora, **siempre detrás de repositorios**. La meta de privacidad (cifrado de extremo a extremo o local-first) se decide al terminar la Fase 1. Por eso el dominio debe poder correr igual en el servidor y en el dispositivo. | 2026-10-11 |
| Login | Supabase Auth: correo + contraseña (con cambio de contraseña) y **Google**. | 2026-10-11 |
| Blockchain (Stellar, Cavos/Starknet) | Fuera de alcance: los datos viven en bancos tradicionales, un ledger público expone montos y comercios, y el negocio exige editar y eliminar. Si algún día aplica, entra como un adaptador más. | 2026-10-11 |
| Sincronización de correo | Manual. Se descarta el cron cada 2 h planeado para v1.3.1. | 2026-10-11 |
| Avisos a familia | Correo y WhatsApp vía un puerto `Notificador`. Requieren un servicio que corra aunque el dispositivo esté apagado. | 2026-10-11 |
