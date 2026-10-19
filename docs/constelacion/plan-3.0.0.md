# Plan 3.0.0 — Constelación familiar (Stellar)

> Estado: **decidido** (2026-10-17). Versión **3.0.0**, rama `feature/3.0.0` (sobre la 2.9.0, que trae la wallet y el bolsillo).
> Fuente: kit de traspaso de AstrOS (`C:\dev\AstrOS\docs\handoff\finance-os\`),
> skills copiadas en `.claude/skills/` y los documentos de `docs/dominio/` y
> `docs/historias-usuario/`. Todavía no hay código.

## 1. Qué se construye

Un sistema de ahorro familiar en **USDC sobre Stellar (solo testnet)** dentro de
Finance OS. La familia se ve como una **constelación**: cada persona es una
estrella.

| Pieza | Qué es | Dónde vive la verdad |
|---|---|---|
| **Bolsillo** | La wallet USDC de cada persona: ver saldo, recibir (QR), enviar a la familia. | Cadena (Horizon). Pagos clásicos, sin contrato. |
| **Bóveda** | Ahorro común con meta. Todos depositan; **retirar requiere la aprobación de otro guardián**. | Contrato Soroban `family` (propio). |
| **Apoyos** (nuevo) | Dinero que **espera una condición**: "la matrícula se paga cuando el colegio confirma", "la mesada por hitos". | Escrow de **Trustless Work** (uno por apoyo). |
| **Academia** | 5 lecciones cortas con mini-quiz (wallet, blockchain, USDC, enviar sin miedo, bóveda). | Contenido en el repo; progreso en Supabase. |
| **Directorio** | Apodos, emoji, parentesco, vínculo usuario ↔ dirección `G…`. | Supabase con RLS. **Nunca en la cadena.** |

Regla de colocación (skill `build-dapp`, `data-placement.md`): en la cadena
solo hay direcciones `G…`, montos, roles y reglas que mueven dinero. Lo
personal queda en Supabase.

### Choque con una decisión vigente

`docs/dominio/arquitectura.md` dice (2026-10-11): *"Blockchain: fuera de
alcance"*. Las razones siguen valiendo para el **libro** (datos bancarios,
montos y comercios públicos, el negocio necesita editar y borrar). La 3.0.0 no
cambia eso: la Constelación es un **contexto nuevo con su propia fuente de
verdad (la cadena)**. No toca el libro ni los saldos de Movimientos. La Fase 0
reescribe la decisión con ese alcance.

## 2. Cómo participan los familiares (decidido)

Ya lo decidiste: **un usuario núcleo, familiares gestionados por el núcleo, y
también familiares con cuenta propia que se unen**. Lo traduzco así:

| Tipo de estrella | Cuenta en Finance OS | Wallet | Qué ve | Quién la crea |
|---|---|---|---|---|
| **Núcleo** | Sí | La suya (Cavos o extensión) | Todo: sus finanzas + la Constelación | Él mismo; crea la familia y queda como guardián |
| **Gestionada** (p. ej. abuela) | **Sí** (decidido D2: se registra desde la invitación del núcleo) | **La suya**: Cavos con su correo o Google | Una vista simplificada: su bolsillo, enviar a la familia, la bóveda, la academia | El núcleo: pone apodo, emoji y parentesco, envía la invitación y la agrega al contrato |
| **Con cuenta propia** | Sí | La suya | Sus finanzas (privadas) + la Constelación compartida | Se une con un código o enlace del núcleo |

**"Gestionada" no quiere decir que el núcleo maneje su llave.** Eso sería
custodia: el núcleo guardaría la plata de otra persona, y va contra la regla de
oro (nunca manejar claves `S…`). Lo que sí controla el núcleo:

- el perfil (apodo, emoji, parentesco);
- su rol en la bóveda (miembro o guardián);
- sacarla de la familia;
- la protección: sus retiros de la bóveda necesitan aprobación, y la app solo
  le ofrece enviar a direcciones de la familia (ver K5).

La familia compartida vive **en el contrato** (`families_of(address)`). Por eso
Supabase no necesita políticas entre usuarios para leerla. Cada usuario guarda
**sus propios** apodos de las direcciones, igual que una agenda de contactos.
Así se mantiene el patrón de 4 policies "own". La única pieza entre usuarios es
**canjear una invitación**, con una función `security definer` que recibe el
token.

## 3. Fases

### Fase 0 — Decisiones y lenguaje (sin código)

- Responder las decisiones de la sección 5.
- `docs/dominio/glosario.md`: Constelación, Estrella, Núcleo, Estrella
  gestionada, Bolsillo, Bóveda, Guardián, Apoyo, Academia. El contexto actual
  **Familia** (cobros de cuotas) pasa a llamarse **"Familia (cobros)"** para
  no confundirlo.
- `docs/dominio/contextos.md`: contexto **Constelación** (no toca Movimientos)
  y puertos nuevos.
- `docs/dominio/reglas.md`: reglas **K1–K10** (sección 4).
- `docs/dominio/arquitectura.md`: reemplazar la decisión "Blockchain fuera de
  alcance" por la de esta versión.
- `docs/historias-usuario/constelacion.md` (archivo nuevo): historias de
  bolsillo, familia, bóveda, apoyos, academia y vista ligera.
- Skills en `.claude/skills/` ✅ (stellar-basics, soroban-contracts, cavos,
  scaffold-stellar, build-dapp, trustless-work).

### Fase 1 — Contrato `family` (Rust/Soroban) y sus tests

Estructura (copiada de AstrOS, con `soroban-sdk` 26 fijado):

```
Cargo.toml, rust-toolchain.toml          workspace, target wasm32v1-none
contracts/family/{Cargo.toml,src/lib.rs,src/test.rs}
contracts/Versionamiento/3.0.0/00_deploy_family_testnet.md
contracts/environments.md                 ids por entorno (development/staging/production)
```

- Base: la especificación de `constelacion-familiar.md` (constructor
  `admin` + `usdc` SAC; `create_family`, `add_member`, `remove_member`,
  `leave_family`, `set_goal`, `deposit`, `request_withdrawal`,
  `approve_withdrawal`, `cancel_withdrawal`, lecturas, `upgrade`).
- Ajustes que propongo sobre esa especificación:
  - **Protección de mayores**: `request_withdrawal` solo acepta un `to` que sea
    **miembro de la familia** (K5). Así un estafador no puede hacer que la
    abuela pida un retiro a su cuenta.
  - **Guardián núcleo** (D4): la familia guarda quién es el `core` (quien la
    crea). El núcleo no sale ni se quita; aprueba los retiros de los demás y,
    si es el único guardián, sus propios retiros se ejecutan directo.
  - **Vencimiento**: un retiro pendiente vence a los 7 días (lo puede cancelar
    cualquiera después de esa fecha), para que no quede abierto para siempre.
  - Un índice por familia de retiros pendientes con tope, una clave por
    retiro (`DataKey::Withdrawal(id)`) y TTL extendido al escribir.
  - Errores `#[contracterror]` con `///` en español (es lo que ve el usuario).
- Tests (`cargo test -p family`): SAC de prueba con
  `register_stellar_asset_contract_v2` + `mint`; un caso por error, auth
  (`env.auths()`), flujo completo depósito → solicitud → aprobación →
  ejecución, saldos finales, vencimiento con `set_timestamp` y el último
  guardián.
- Checklist de seguridad de `soroban-contracts` antes de desplegar. **Tú
  corres el despliegue** con tu identidad; yo dejo el guion en
  `contracts/Versionamiento/3.0.0/`.

### Fase 2 — Stellar en Next.js (cliente, wallet, clientes TS)

- Dependencias fijas: `@stellar/stellar-sdk` (una sola copia en todo el
  proyecto), `@cavos/kit@0.4.2`, `@creit.tech/stellar-wallets-kit`,
  `uqr@0.1.3`, `@trustless-work/escrow@3.0.5` (API V1). Nunca
  `npm audit fix --force`.
- `src/lib/stellar/env.ts`: variables `NEXT_PUBLIC_*` leídas **por nombre
  literal**.
- Wallet, solo en el cliente: `src/components/stellar/` con `CavosRoot` →
  `WalletProvider` → `useWallet()` (cargado con `next/dynamic` y `ssr:false`
  si hace falta). **Un solo `signTransaction`**: ninguna pantalla importa
  Cavos ni Wallets Kit directo.
- Arranque de la wallet (lecciones de AstrOS): Friendbot **primero**, después
  la trustline USDC, después el cambio XLM→USDC en el DEX de testnet (o el
  faucet de Circle).
- Cliente TS del contrato: se genera con
  `stellar contract bindings typescript` en `src/infrastructure/stellar/family-client/`
  (no se edita a mano). Para Vercel, un script estilo
  `scripts/ci-clients.mjs` que lo genera desde el id desplegado, sin Rust.
- Antes de tocar APIs de Next: leer `node_modules/next/dist/docs/` (carga
  dinámica, client components, variables de entorno).

### Fase 3 — Dominio y aplicación (contexto Constelación)

| Capa | Contenido |
|---|---|
| `src/domain/constellation/` | `usdc.ts`: monto USDC de 7 decimales (`bigint`) ↔ `Money` USD en céntimos. Al pasar a céntimos se trunca hacia abajo, para nunca mostrar más de lo que hay. `send.ts`: validar un envío (monto > 0, destino ≠ origen, destino con trustline, reserva de XLM). `vault.ts`: espejo de las reglas del contrato para avisar **antes** de firmar (K3–K7) y el avance de la meta con la regla de `goalProgress` (S3). `academy.ts`: lecciones, quiz y progreso. `escrow.ts`: armar un apoyo (roles, monto, comisión). Cada uno con su `*.test.ts`. |
| `src/application/` | Puertos nuevos en `ports.ts`: `StellarWallet` (saldos, trustline, preparar pago), `FamilyVault` (leer familia, preparar depósito/retiro/aprobación), `EscrowService` (preparar apoyo, fondear, aprobar, liberar), `ConstellationDirectory` (wallets, estrellas, invitaciones), `AcademyRepository`. Casos de uso en `constellation.ts`. Las escrituras de la cadena **devuelven una transacción sin firmar**; el navegador la firma y la envía. |
| `src/infrastructure/stellar/` | Adaptadores con `stellar-sdk` (Horizon/RPC), el cliente generado de `family` y Trustless Work. No guarda llaves. |
| `src/infrastructure/supabase/constellation.ts` | Directorio, invitaciones y academia, siempre detrás de repositorios. |

Los casos de uso que tocan la cadena corren en el **cliente**. El dominio y
la aplicación son puros y ya pueden correr ahí. Las Server Actions solo
escriben en Supabase (directorio, invitaciones, academia) con el patrón de
siempre: `requireUser()` → Zod → caso de uso → `revalidatePath()`.

### Fase 4 — Supabase (`supabase/Versionamiento/3.0.0/`)

| Archivo | Tabla / función | Notas |
|---|---|---|
| `00_stellar_wallets.sql` | `stellar_wallets` (`address`, `connector` cavos/extension, `network`) | Una activa por usuario. Solo la dirección pública. RLS + 4 policies + índice parcial. |
| `01_constellation_stars.sql` | `constellation_stars` (`address`, `nickname`, `emoji`, `relationship`, `kind` managed/linked/contact, `member_id` → `members` opcional) | La agenda **de cada usuario**. Único `(user_id, address)` entre activas. 4 policies "own". |
| `02_family_invites.sql` | `family_invites` (`onchain_family_id`, `token_hash`, `role`, `expires_at`, `redeemed_address`, `redeemed_by`) + `redeem_family_invite(token, address)` `security definer` | Solo se guarda el **hash** del token. Vence a las 72 h y se puede revocar. La función solo escribe la dirección que canjeó; el núcleo la agrega después al contrato y firma él. |
| `03_academy_progress.sql` | `academy_progress` (`lesson_key`, `score`, `completed_at`) | 4 policies. |
| — | `profiles.preferences.largeText` | Letra grande, sin SQL (ya es jsonb). |

Las estrellas gestionadas no tienen fila de usuario. Su progreso en la
academia y su vista ligera se apoyan en la wallet (decisión D2).

### Fase 5 — Pantallas (pestaña Trading → hub Stellar)

Pediste trabajar en el menú Trading. Propongo convertir la pestaña beta en el
**hub Stellar** y dejar el portafolio de trading para después:

| Ruta | Pantalla |
|---|---|
| `/trading` | Hub: tarjeta de la Constelación, estado de la wallet (checklist: crear → fondear → bolsillo USDC) y lo "Próximamente" de hoy. |
| `/trading/constelacion` | **Constelación**: SVG con "Tú" al centro; el brillo de cada estrella = su aporte; la bóveda como planeta con anillo de progreso. Tocar una estrella → enviar. |
| `/trading/bolsillo` | **Mi ahorro**: saldo USDC grande + ≈ colones (último `exchange_rates`), Enviar / Recibir (QR) / Conseguir USDC de prueba, movimientos en lenguaje simple. |
| `/trading/enviar` | Elegir estrella → monto → revisión ("Vas a enviar 10 USDC a Mamá. No se puede deshacer.") → aviso del modal de Cavos → firma → animación de estrella viajera. |
| `/trading/boveda` | Saldo, meta, aportes por persona, Depositar, Pedir retiro, pendientes para aprobar o cancelar. |
| `/trading/apoyos` | Apoyos con Trustless Work (Fase 6). |
| `/trading/academia` | 5 lecciones + quiz + progreso; supernova al terminar. |
| `/ajustes/constelacion` | Familia: invitar, roles, sacar estrellas, wallet vinculada. |
| `/unirse/[token]` | Canje de invitación **con sesión de Finance OS** (D2): si no tiene cuenta, se registra y vuelve aquí (`next`). Una estrella gestionada entra a una vista simplificada (letra grande, solo la Constelación). |

Diseño: mobile first para personas mayores (botones grandes, inputs de 16 px,
`safe-area-inset-bottom`, confirmación antes de mover dinero, sin jerga).
Marca de AstrOS pasada a tokens de Tailwind v4 en un tema `constelacion`
(Noche `#0B0820`, Nebulosa `#1A1438`, Aurora, Estrella `#FFD66B`) y a
animaciones en `globals.css`, respetando `[data-motion]`. Interruptor **Letra
grande** en Preferencias. Sin `npx shadcn add` que sobrescriba `ui/*`.

### Fase 6 — Apoyos familiares con Trustless Work

La bóveda (aportes recurrentes y retiros libres con aprobación) **no** encaja
en un escrow por hitos: por eso tiene contrato propio. Trustless Work sí
encaja cuando **el dinero espera una condición**:

| Caso | Tipo de escrow | Roles (V1) |
|---|---|---|
| **Pago con destino**: "₡ para la matrícula; se libera cuando el colegio o un guardián confirma." | single-release | funder = quien aporta (pueden ser varios); `approver` = guardián; `serviceProvider` = quien recibe; `releaseSigner` = guardián; `receiver` = beneficiario |
| **Mesada por hitos**: "$20 por cada mes que mantenga las notas." | multi-release | un hito por mes, cada uno con su `receiver` |
| **Meta con fecha**: "No se toca hasta diciembre." | single-release | `releaseSigner` = un guardián distinto del beneficiario |

- `platformAddress` y `disputeResolver`: dirección de la plataforma Finance
  OS (`NEXT_PUBLIC_PLATFORM_ADDRESS`). En modo demo es la wallet conectada,
  con aviso.
- La API key de Trustless Work queda **en el servidor**: una route handler
  `/api/trustless/*` le agrega `x-api-key` y respeta el límite de unas 50
  solicitudes por minuto. Así la key no se expone como en AstrOS. El servidor
  solo construye y reenvía; nunca firma.
- `engagementId` = `finance-os:<familyId>:<uuid>` para listar los apoyos de
  una familia en el indexador.

### Fase 7 — Encaje con el resto de Finance OS

- **Resumen**: card "Ahorro en Stellar" (bolsillo + tu parte de la bóveda) en
  USD y ≈ CRC. No entra en la cobertura ni en el libro (G1 sigue intacta).
- **Ahorros y metas**: la meta de la bóveda aparece como meta de solo lectura
  (avance leído de la cadena, S3), sin cuenta ligada.
- **Miembros (2.3.0)**: una estrella se puede ligar a un `member`. Más
  adelante, cobrar la parte de una cuota en USDC.
- **Arranque de 0**: no toca la Constelación (la cadena no se archiva).

### Fase 8 — Calidad, prueba manual y release

- `npm run lint`, `npm test` (dominio + aplicación con fakes) y
  `npm run build` en verde; `cargo test -p family`.
- **Guion de prueba manual** para todo lo que pide firma (no lo puedo probar
  yo): crear wallet → fondear → bolsillo → enviar → crear familia → invitar →
  depositar → pedir retiro → aprobar con la segunda wallet → apoyo de punta a
  punta.
- Docs (CONTEXT, glosario, reglas, historias), `CHANGELOG.md` `## 3.0.0 — sin
  publicar`, `package.json` 3.0.0, PR `feature_Stellar → dev_main` (lo
  fusionas tú).

## 4. Reglas nuevas (K1–K10)

Copia de `docs/dominio/reglas.md` (manda la de allá).

| Id | Regla | Tipo | Estado |
|---|---|---|---|
| K1 | Solo **testnet**. La app rechaza una wallet en otra red. | Rechaza | Decidido 2026-10-17 |
| K2 | En la cadena solo van direcciones `G…`, montos, roles y reglas. **Nunca** nombres, apodos, parentescos ni fotos (viven en Supabase con RLS). | — | Decidido 2026-10-17 |
| K3 | Solo una estrella de la familia deposita en su bóveda; monto mayor que 0 (USDC). | Rechaza | Decidido 2026-10-17 |
| K4 | Un retiro de la bóveda necesita `min(aprobaciones configuradas, guardianes distintos de quien pide)` aprobaciones de guardianes **distintos de quien pide**. Si quien pide es el núcleo y es el único guardián, se ejecuta directo. Al ejecutarse, la bóveda debe tener saldo. | Rechaza | Decidido 2026-10-17 |
| K5 | El destino de un retiro es una estrella de la misma familia (protege de estafas). | Rechaza | Decidido 2026-10-17 |
| K6 | La familia tiene un **núcleo** (quien la crea): siempre guardián, no sale ni se quita. Solo el núcleo nombra o quita guardianes, cambia roles y fija las aprobaciones; cualquier guardián agrega miembros, quita miembros y fija la meta. Máximo 12 estrellas por familia y 5 familias por dirección. | Rechaza | Decidido 2026-10-17 |
| K7 | Un retiro pendiente vence a los **7 días**: ya no se aprueba (se puede cancelar). Máximo 10 retiros pendientes por familia. Cancela quien pidió o un guardián. | Rechaza | Decidido 2026-10-17 |
| K8 | Antes de mover dinero siempre hay una pantalla de revisión con destino (apodo + dirección corta), monto y "no se puede deshacer". | — | Decidido 2026-10-17 |
| K9 | Enviar a una dirección que no está en la Constelación se advierte de forma destacada (posible estafa). | Advierte | Decidido 2026-10-17 |
| K10 | Los montos USDC tienen 7 decimales en la cadena (`i128`); en la app se muestran en céntimos, truncados hacia abajo. | — | Decidido 2026-10-17 |

## 5. Decisiones (cerradas el 2026-10-17)

Las del usuario (2026-10-16) y, en lo que quedaba abierto, las recomendaciones
de este plan, aceptadas por el usuario el 2026-10-17.

| # | Decisión |
|---|---|
| D1 | Cada estrella tiene **su propia wallet** (Cavos con su correo o Google, o extensión). Nadie maneja la llave de otro: no hay custodia. |
| D2 | Toda estrella, también la gestionada, **tiene cuenta en Finance OS**. No hay vista sin sesión; la invitación se canjea con sesión. |
| D3 | **Apodos por usuario** (agenda propia, RLS "own"); nadie ve cómo lo nombra otro. |
| D4 | La familia tiene un **núcleo** (quien la crea), siempre guardián, que no puede salir ni ser quitado. El núcleo lleva el control de la bóveda: los retiros de los demás necesitan la aprobación de un guardián distinto de quien pide. **Retiro del propio núcleo**: si hay otro guardián, lo aprueba él; si el núcleo es el único guardián, se ejecuta directo. |
| D5 | Aprobaciones configurables por el núcleo (`approvals_needed`, mínimo 1, por defecto 1). Al pedir un retiro se exige `min(approvals_needed, guardianes distintos de quien pide)`. |
| D6 | El contrato admite varias familias por dirección (máximo 5); en la 3.0.0 la interfaz muestra una. |
| D7 | La pestaña **Trading** pasa a ser el hub **Constelación** (rutas `/trading/*`, badge beta); el portafolio de trading queda como "Próximamente". |
| D8 | **Apoyos** (Trustless Work): en la 3.0.0 solo **Pago con destino** (single-release). Mesada por hitos y meta con fecha, en la 3.1.0. |
| D9 | Modelo de negocio y porcentajes se definen más adelante. Mientras tanto `platformFee` = 0 en testnet. |
| D10 | Dos entornos del contrato: **development** (local, redesplegable) y **producción-testnet** (Vercel `main` y `dev_main`, id fijo, cambios solo con `upgrade`). |
| D11 | `admin` del contrato y `platformAddress` = la dirección `G…` del usuario (la pega él; nunca la clave). |
| D12 | Cavos (correo/Google) como wallet principal + extensión como secundaria. El usuario crea la app en el dashboard de Cavos y registra los orígenes. |
| D13 | Una estrella se puede ligar a un Miembro (2.3.0) de forma opcional; los cobros en USDC quedan para después. |

## 6. Modelo de negocio y comisiones (Trustless Work)

Lo que dice la documentación de Trustless Work:

- **Comisión de protocolo**: fija, del **0,3 %** sobre lo que se **libera** de
  un escrow en **mainnet**. La API la presenta como el modelo de negocio de
  Trustless Work; otra página habla de 0,3–0,5 % y la sección está "en
  construcción", así que se toma como plan, no como precio final.
- **Comisión de plataforma** (`platformFee`, en %): la define quien integra
  (nosotros) y va a la `platformAddress`. La suma de plataforma + protocolo no
  puede pasar el 100 %.
- **Las dos se descuentan al liberar**, no se cobran encima: quien fondea pone
  el monto y el receptor recibe el neto. En **testnet** no hay plata real (la
  comisión de protocolo se pasa como parámetro), así que la 3.0.0 no genera
  ingresos: valida el modelo.
- La `platformAddress` necesita trustline USDC para recibir la comisión.

Propuesta de modelo para Finance OS (para el pitch):

1. **Gratis lo que protege**: bolsillo, envíos entre familia y bóveda, sin
   comisión. Cobrar por mover plata entre familiares rompe la confianza, y el
   costo de red es de fracciones de centavo.
2. **Comisión pequeña donde hay servicio**: los **Apoyos** (escrow con
   condición, árbitro y trazabilidad) llevan `platformFee` de 0,5 % (sumado
   al 0,3 % del protocolo = 0,8 % total; como referencia, el Banco Mundial
   ubica el costo promedio de una remesa alrededor del 6 %; verificar la
   cifra antes del pitch).
3. **Finance OS Pro** (más adelante): suscripción con familias más grandes,
   varios apoyos activos sin comisión y reportes.
4. **Futuro, solo en mainnet y con revisión legal**: entrada y salida a
   colones con un *anchor* (SEP-24). Antes de mainnet hay que revisar la
   regulación de Costa Rica (custodia, remesas, SUGEF/CONASSIF) y auditar el
   contrato `family`.

## 7. Versionado

- Una versión mayor, **3.0.0**, en la rama `feature_Stellar` (sale de
  `dev_main`, vuelve por PR a `dev_main`; tú fusionas).
- SQL: `supabase/Versionamiento/3.0.0/00_…03_` (idempotentes, comentario de
  "cuándo correrlo").
- Contrato: `contracts/Versionamiento/3.0.0/` con el despliegue (wasm hash,
  id, red, argumentos del constructor) y, después, cada `upgrade` en la carpeta
  de su versión. Un contrato con id fijo **no se redespliega**: se cambia con
  `upgrade` sin romper los `#[contracttype]` ya guardados (tipos nuevos
  `_v2`).
- Variables nuevas (`.env.example` y Vercel por entorno):

| Variable | Pública | Nota |
|---|---|---|
| `NEXT_PUBLIC_STELLAR_NETWORK` | Sí | `testnet` |
| `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE` | Sí | `Test SDF Network ; September 2015` |
| `NEXT_PUBLIC_STELLAR_RPC_URL` | Sí | `https://soroban-testnet.stellar.org` |
| `NEXT_PUBLIC_STELLAR_HORIZON_URL` | Sí | `https://horizon-testnet.stellar.org` |
| `NEXT_PUBLIC_USDC_ISSUER` / `NEXT_PUBLIC_USDC_SAC_ID` | Sí | Emisor `GBBD47…` y SAC `CBIELT…` de testnet |
| `NEXT_PUBLIC_FAMILY_CONTRACT_ID` | Sí | Por entorno |
| `NEXT_PUBLIC_CAVOS_APP_ID`, `NEXT_PUBLIC_CAVOS_ENVIRONMENT` | Sí | App ID público por diseño; nunca una API key `cav_…` |
| `NEXT_PUBLIC_PLATFORM_ADDRESS` | Sí | `G…` que recibe la comisión de los apoyos |
| `TRUSTLESS_WORK_API_URL`, `TRUSTLESS_WORK_API_KEY` | **No** | Solo en el servidor (route handler) |

Ningún secreto `S…` ni frase semilla en `.env`, en el repo ni en el chat.

## 8. Orden sugerido de trabajo

Fase 0 → 1 (contrato y tests, sin depender de la app) → 2 (wallet y bolsillo:
ya da una demo de envío) → 3 + 4 (dominio y Supabase) → 5 (pantallas) → 6
(apoyos) → 7 → 8. Las fases 1 y 2 pueden avanzar en paralelo porque tocan
archivos distintos (`contracts/` contra `src/`).

## 9. Lo que quedó distinto al plan (auditoría 3.0.1)

- **Fase 2**: no hay un cliente TS generado en `src/infrastructure/stellar/family-client/`
  ni un script `ci-clients`. El cliente se arma en tiempo de ejecución con
  `contract.Client.from` (`src/infrastructure/stellar/family.ts`).
- **Fase 3**: el dominio quedó en `usdc.ts`, `family.ts` y `directory.ts`. Los
  puertos quedaron en `WalletLinkRepository`, `StarDirectoryRepository`,
  `FamilyInviteRepository`, `InviteTokenService` y `AcademyRepository`.
  Siguen pendientes `escrow.ts` y `EscrowService` (Fase 6).
- **Fase 5**:
  - La constelación y el envío viven en `/trading/familia` y `/trading/bolsillo`.
  - La invitación vive en `/trading/unirse/[token]`.
  - No existen `/ajustes/constelacion`, `/trading/apoyos` ni
    `/trading/academia`; Apoyos y Academia son cards "Próximamente".
- **Fases 6–8**: pendientes para 3.1.0. El detalle está en
  `docs/dominio/pendientes.md`.
