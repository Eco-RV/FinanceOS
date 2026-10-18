# Changelog

## 3.0.0 — sin publicar

Constelación familiar: familia y bóveda de ahorro en USDC con aprobaciones,
sobre Stellar testnet, por fases. Ver `docs/constelacion/plan-3.0.0.md`.

### Fase 0 — Lenguaje y decisiones
- Plan con las decisiones cerradas (D1–D13), reglas **K3–K7** (familia y
  bóveda), glosario y contexto (separado del libro) e historias de usuario.

### Fase 1 — Contrato `family` (Soroban)
- Familia con núcleo, guardianes y miembros (solo direcciones y roles);
  bóveda de USDC con depósitos, meta y retiros aprobados por guardianes
  distintos de quien pide, solo hacia la familia y con vencimiento de 7 días.
- Tests (`cargo test -p family`) y despliegue en testnet
  (`contracts/Versionamiento/3.0.0/`), ya hecho por el usuario.
- Cliente TS del contrato sin generar código (`contract.Client.from`).

### Fase 3 — Dominio y casos de uso
- `src/domain/constellation/family.ts`: espejo de K3–K7 para avisar antes de
  firmar (quién agrega o quita, aprobaciones requeridas, bloqueos de un
  retiro, cancelar), avance de la meta y brillo de cada estrella.
- `src/domain/constellation/directory.ts`: agenda de estrellas (apodo, emoji,
  parentesco; K2), invitaciones de 72 h y Academia (lecciones y puntaje).
- `src/application/constellation.ts`: ligar la wallet, agenda, invitar,
  canjear (con sesión, D2), revocar, marcar agregada y completar lecciones.

### Fase 4 — Supabase
- Wallet ligada (solo la dirección pública), agenda de estrellas por usuario,
  invitaciones (solo el hash del token; canje con función `security definer`)
  y progreso de la Academia. Adaptador `src/infrastructure/supabase/constellation.ts`.

### Fase 5 — Pantallas de familia, invitaciones y bóveda
- **Mi familia** (`/trading/familia`): crear la familia (quedas como núcleo),
  la constelación en SVG ("Tú" al centro, brillo según lo aportado, la bóveda
  como planeta con su avance), estrellas con apodo/emoji/parentesco propios,
  hacer guardián o miembro (núcleo), quitar y salirse.
- **Invitaciones**: enlace de 72 h (copiar o WhatsApp); quien lo abre entra con
  su cuenta, conecta su wallet y lo acepta en `/trading/unirse/<token>`; el
  núcleo la ve "Lista para agregar" y la agrega con su firma. También agregar
  por dirección.
- **Bóveda** (`/trading/boveda`): saldo y ≈ colones, meta con barra,
  depositar y pedir retiro (solo hacia la familia) con revisión antes de
  firmar, retiros pendientes con aprobar o cancelar, aportes por estrella y
  aprobaciones por retiro (núcleo).
- La wallet conectada se liga sola a la cuenta (solo la dirección).

### Base de datos (correr a mano ANTES de desplegar, después de todo 2.9.0)
1. `supabase/Versionamiento/3.0.0/00_stellar_wallets.sql`
2. `supabase/Versionamiento/3.0.0/01_constellation_stars.sql`
3. `supabase/Versionamiento/3.0.0/02_family_invites.sql` (activa `pgcrypto`)
4. `supabase/Versionamiento/3.0.0/03_academy_progress.sql`

### Contratos (los corre el usuario, testnet)
1. `contracts/Versionamiento/3.0.0/00_despliegue_family_testnet.md` ✅

### Configuración
- `NEXT_PUBLIC_FAMILY_CONTRACT_ID` (id público del contrato `family`;
  ya cargada en `.env.local` y Vercel).

## 2.9.0 — 2026-10-17

Mi bolsillo en Stellar: dólares digitales (USDC) de persona a persona, en la
red de prueba (testnet).

### Constelación (antes Trading, beta)
- La pestaña **Trading** pasa a **Constelación**: hub con la wallet y lo que
  viene (familia, bóveda, apoyos, academia y portafolio, "Próximamente").
- **Wallet**: entrar con correo o Google (Cavos, sin instalar nada) o con una
  wallet de extensión (Freighter, xBull…). Finance OS nunca ve las llaves.
- **Puesta a punto** en testnet: XLM de prueba automático (Friendbot), abrir
  el bolsillo de dólares (trustline USDC) y conseguir USDC de prueba (DEX o
  faucet de Circle).
- **Mi bolsillo** (`/trading/bolsillo`): saldo en USDC con su equivalente en
  colones (último tipo de cambio), **Enviar** a otra persona con pantalla de
  revisión y aviso de posible estafa, y **Recibir** con QR y copiar dirección.

### Base de datos
- Sin cambios.

### Configuración
- `NEXT_PUBLIC_CAVOS_APP_ID` (App ID público de Cavos) y, opcional,
  `NEXT_PUBLIC_CAVOS_ENVIRONMENT` (`development` por defecto).
- En el dashboard de Cavos: orígenes `http://localhost:3000` y
  `https://financeos-ten-rust.vercel.app`; Callback URLs con la ruta
  `/trading` (`http://localhost:3000/trading`,
  `https://financeos-ten-rust.vercel.app/trading`).
- Opcionales (por defecto testnet): `NEXT_PUBLIC_STELLAR_RPC_URL`,
  `NEXT_PUBLIC_STELLAR_HORIZON_URL`, `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE`,
  `NEXT_PUBLIC_USDC_ISSUER`, `NEXT_PUBLIC_USDC_SAC_ID`.

## 2.8.0 — 2026-10-17

Correcciones de tarjetas, SINPE y débito en el gasto rápido, abonos en dólares
y tarjetas de débito en las cuentas.

### Tarjetas de crédito
- **Corte por tarjeta**: opción "Las compras del día de corte pasan al
  siguiente corte" (así corta BAC, por fecha de proceso). Con ella, el pago de
  contado no incluye lo comprado el mismo día del corte.
- **Abonos anticipados**: lo que pagas después del corte por encima del pago
  de contado baja el **consumo sin cortar** (gastar ₡20 000 y abonar ₡20 000
  el mismo día deja la tarjeta igual). El detalle muestra cuánto se descontó.
- **Abono en otra moneda**: al registrar un pago eliges qué saldo de la
  tarjeta abonas (colones o dólares). Si la cuenta es de otra moneda, sale de
  ella el equivalente con el **último tipo de cambio** (Ajustes → Tipo de
  cambio), que queda guardado en el movimiento.
- **Arreglo**: Tarjetas y el Resumen leían como máximo 1000 movimientos de
  tarjeta; con muchas cuotas de financiamientos podían faltar gastos recientes
  en el estado de cuenta. Ahora se leen todos.

### Gastos
- El **gasto rápido** (botón + y Gastos) tiene cuatro formas de pago:
  **Crédito**, **Débito**, **SINPE** (desde una cuenta bancaria, con
  destinatario y teléfono opcionales) y **Efectivo**. "Nuevo SINPE" abre el
  mismo formulario en la pestaña SINPE.

### Cuentas
- **Tarjeta de débito** por cuenta bancaria (corriente o ahorro; una activa
  por cuenta). Se agrega, edita, elimina o desactiva desde la cuenta.
- **Detalle de cuenta** (toca una cuenta en la lista): saldo, su tarjeta de
  débito y todos sus movimientos (gastos, ingresos, transferencias y abonos,
  con el signo desde la cuenta).

### Planes
- Un gasto fijo se puede pagar con **tarjeta de débito** (sale de su cuenta).

### Base de datos (correr a mano ANTES de desplegar, después de todo 2.7.0)
1. `supabase/Versionamiento/2.8.0/00_card_cutoff_rollover.sql`
2. `supabase/Versionamiento/2.8.0/01_debit_cards.sql`
3. `supabase/Versionamiento/2.8.0/02_card_payment_exchange.sql` (al final
   verifica los saldos: debe devolver 0 filas)

### Configuración
- Sin cambios. Para la opción de corte, edita cada tarjeta BAC y marca la
  casilla.

## 2.7.0 — 2026-10-16

Planes recurrentes, línea base y Ahorros y metas.

### Planes (Procesos → Planes)
- **Salario** (semanal, bisemanal, quincenal o mensual) hacia una cuenta,
  **gastos fijos** mes a mes (renta, agua, luz, internet, suscripciones…;
  con tarjeta o desde una cuenta, categoría sugerida por el nombre) y
  **seguros de tarjeta**.
- Cada fecha se **registra sola** cuando llega (al abrir la app); las que
  vienen se ven como programadas. Un plan nuevo no registra hacia atrás.
- Pausar, reanudar, editar y eliminar (lo ya registrado se conserva).
- **Línea base**: gastos fijos (los del plan, seguros, cuotas de préstamos y
  de financiamientos) contra el salario, con tope configurable (35 % por
  defecto) y aviso si se pasa. Próximos 30 días.

### Ahorros y metas (Procesos → Ahorros y metas)
- Metas con ícono, objetivo, fecha opcional y cuenta ligada: avance, lo que
  falta, aporte mensual sugerido y estado.
- **Aportar** = transferencia hacia la cuenta de la meta.

### Resumen
- Cards de **Línea base** (con lo próximo programado) y **Metas de ahorro**.

### Base de datos (correr a mano ANTES de desplegar, después de todo 2.6.0)
1. `supabase/Versionamiento/2.7.0/00_plans.sql`
2. `supabase/Versionamiento/2.7.0/01_savings_goals.sql`

### Configuración
- Sin cambios.

## 2.6.0 — 2026-10-14

Usuarios: acceso más claro, confirmación por correo que funciona en
producción, perfil y preferencias.

### Acceso
- **Arreglo**: el enlace de confirmación del correo llevaba a `localhost` en
  producción. Ahora todo enlace del correo vuelve a la misma app desde donde
  se pidió, a la ruta nueva `/auth/confirm`.
- Registro con nombre (opcional), repetir contraseña y requisitos en vivo
  (8+ caracteres, letras y números).
- Al crear la cuenta, pantalla **"Revisa tu correo"** (ya no un mensaje rojo)
  con **Reenviar correo**; al confirmar, entra con la bienvenida.
- Login con botón para ver la contraseña, avisos claros (correo sin
  confirmar, demasiados intentos, enlace vencido) y **¿La olvidaste?** para
  restablecer la contraseña por correo.

### Mi cuenta
- **Ajustes → Mi cuenta**: foto de perfil, nombre, usuario (@), país, cambiar
  correo (con confirmación) y cambiar contraseña (pide la actual).
- La barra muestra la foto o las iniciales; el menú del avatar suma **Mi
  cuenta** y **Preferencias**; la bienvenida saluda por el nombre.

### Preferencias
- **Ajustes → Preferencias**: tema Sistema / Claro / Oscuro y accesos a las
  configuraciones de la app. Lugar listo para moneda base y formato de fecha.

### Base de datos (correr a mano ANTES de desplegar, después de todo 2.5.0)
1. `supabase/Versionamiento/2.6.0/00_profiles.sql`: tabla `profiles`, trigger
   que crea el perfil al registrarse y perfiles de los usuarios existentes.
2. `supabase/Versionamiento/2.6.0/01_avatars_storage.sql`: bucket `avatars` y
   sus permisos.

### Configuración (Supabase → Authentication → URL Configuration)
- **Site URL**: `https://financeos-ten-rust.vercel.app` (no `http://localhost:3000`).
- **Redirect URLs**: `https://financeos-ten-rust.vercel.app/**` y
  `http://localhost:3000/**` (y la de los Previews de Vercel si se usan).
- Opcional: `NEXT_PUBLIC_SITE_URL` fija el origen de los enlaces si hiciera
  falta.

## 2.5.0 — 2026-10-14

Rediseño UI/UX en detalle: Resumen nuevo, gasto rápido tipo billetera y
listas más limpias.

### Resumen
- Grilla nueva: **Liquidez** (antes "Disponible en débito") a lo ancho; luego
  A pagar de contado, Consumo sin cortar y **Financiamientos**; gastos de los
  últimos 7 días, del mes y del año; gráfico de gastos por categoría; y
  **Disponible en crédito**, Cobros a miembros y **Faltante**.
- Cada card abre un **modal con su detalle** (cuentas de la liquidez, pagos,
  tarjetas con consumo sin cortar, financiamientos con enlace a su detalle,
  disponible por tarjeta en verde / amarillo / rojo).
- **Faltante** reemplaza el aviso de cobertura y va en la segunda fila, junto
  a A pagar de contado y Consumo sin cortar: muestra solo el monto que falta
  (0 en verde si la liquidez alcanza). Financiamientos pasa a la última fila.
- El gráfico de gastos abre **Gastos** con el período ya filtrado; cada
  barra abre Gastos filtrado por esa categoría.
- En pantallas anchas, Pagos próximos y Próximos cortes van lado a lado.

### Gastos
- **Formulario rápido**: monto grande con botón de moneda (₡ / $),
  categorías con ícono en cuadrícula, **Tarjeta** (carrusel tipo billetera
  que empieza en la primera, con flechas y rueda del ratón) o **Efectivo**, y "Más opciones" para fecha y
  nota. En computadora el formulario es más ancho, en dos columnas. Ya no
  se registra un gasto directo sobre una cuenta de débito (para
  eso están SINPE y Transferencias).
- Al registrar, confirmación animada **"Gasto registrado"** al centro; los
  avisos de la app salen arriba y ya no tapan el botón flotante.
- Lista con **filtros** (texto, fechas, categoría, origen, cuotas
  programadas), total de lo filtrado y **filas por página** (5, 10, 20, 50 o
  todas).
- Botón **Financiamientos** → pantalla nueva con los financiamientos activos
  de todas las tarjetas.

### Categorías
- Cada categoría tiene un **ícono** de un kit de la app; las existentes
  reciben uno por defecto según el nombre.

### Listas
- Cuentas, Tarjetas, Gastos, Ingresos, Transferencias, Financiamientos,
  Préstamos y Miembros: en computadora cada fila es una card separada, como
  en el teléfono.
- En Tarjetas, Financiamientos y Préstamos **toda la fila abre el detalle**,
  salvo los botones.

### General
- Pantalla de **bienvenida** animada al abrir la app; login renovado.
- **Fondo** con cuadrícula y bloques que flotan; entradas en cascada.
- En computadora el contenido usa más ancho según el monitor.
- Pestaña **Trading** con la leyenda *beta* (módulo en construcción).
- Logo nuevo (bloques en escalera) y cinco propuestas en `docs/logos/`.
- **Combos propios** en toda la app (en vez del desplegable del sistema):
  lista flotante con grupos, marca de la opción elegida y buen contraste en
  claro y oscuro.
- **Confirmaciones propias** al eliminar, desactivar o deshacer (en vez del
  aviso del navegador): diálogo con ícono, explicación y botón en rojo cuando
  borra.
- **Detalle de tarjeta**: la tarjeta aparece arriba con una animación de
  entrada, igual que en el carrusel del gasto.
- **Guía de marca** oficial del logotipo Bloques en `docs/marca/`.

### Base de datos (correr a mano ANTES de desplegar, después de todo 2.3.0)
1. `supabase/Versionamiento/2.5.0/00_category_icons.sql`: columna
   `categories.icon` y ícono por defecto para las categorías existentes.
   Idempotente. Sin correrlo la app funciona, pero no guarda íconos.

### Configuración
- Sin cambios.

## 2.4.0 — 2026-10-14

Rediseño visual: superficies más limpias, microinteracciones y tema oscuro.

### Interfaz
- **Tema claro/oscuro**: sigue al del sistema y se puede fijar con el botón
  sol/luna de la barra superior (se recuerda en el dispositivo).
- Fondo gris suave con cards blancas y sombras sutiles; tipografía con más
  jerarquía en títulos.
- **Botones** que se hunden al presionarlos (también los que abren
  formularios y el botón flotante), con transiciones cortas y foco visible.
- **Procesos y Ajustes**: cada card es clicable en toda su superficie, se
  eleva al pasar el cursor y muestra un spinner mientras abre la página.
- **Resumen**: toda la fila de un pago próximo abre su detalle; las filas de
  **Próximos cortes** ahora abren el detalle de la tarjeta.
- Pestañas superiores tipo control segmentado; barra inferior con indicador
  y respuesta al toque; el botón flotante respeta el área segura del iPhone.
- Eliminar, desactivar, deshacer reembolso y avisos muestran un spinner
  mientras trabajan.
- Con "reducir movimiento" del sistema no hay escalas ni desplazamientos.

### Dependencias
- Se quitó `next-themes` (el tema lo maneja la app).

### Base de datos
- Sin cambios.

### Configuración
- Sin cambios.

## 2.3.0 — 2026-10-14

Financiamientos completos: con interés, edición, miembros, reembolsos y
avisos de cuota.

### Financiamientos (tasa 0 y con interés)
- **Tasa anual (%)** al crear un financiamiento: con 0 todo sigue igual
  (cuotas iguales); con tasa, tabla de amortización francesa (la misma de
  Préstamos, F5). El formulario muestra la cuota, los intereses y el costo
  total.
- Hasta **72 meses** (antes 48).
- **Solo el capital** baja el saldo y el disponible desde el día 1; el interés
  de cada cuota cuenta cuando llega su fecha (Tarjetas, detalle de tarjeta,
  Resumen y Arranque de 0).
- **Detalle del financiamiento**: tabla de cuotas con interés, capital, saldo,
  estado y fecha límite de pago; interés cobrado, por cobrar y costo total.
- **Editar** descripción y categoría, también en sus cuotas (F9). Los
  términos no se editan.
- En el historial de la tarjeta la cuota dice "incluye ₡X de interés" y
  enlaza a su financiamiento.

### Miembros, reembolsos y avisos (F6–F8)
- **Ajustes → Miembros**: familia que paga parte de las cuotas (correo y
  WhatsApp), con eliminar vs. desactivar.
- **Repartir cuotas**: monto fijo por cuota por miembro; el resto es del
  usuario.
- **Reembolsos**: marcar que un miembro pagó su parte (no toca la tarjeta ni
  las cuentas).
- **Procesos → Cobros a miembros**: avisos por miembro y fecha límite, una vez
  por quincena (3, 2, 1 y al vencer), por WhatsApp (mensaje listo) o correo
  desde el Gmail conectado; lista de lo que cada miembro debe. Contador en
  Procesos y aviso en el Resumen.

### Base de datos (correr a mano, en orden, DESPUÉS de todo 2.2.0)
1. `supabase/Versionamiento/2.3.0/00_financing_interest.sql`
2. `supabase/Versionamiento/2.3.0/01_members.sql`
3. `supabase/Versionamiento/2.3.0/02_mail_send_scope.sql`

### Configuración
- Google Cloud: agregar el scope `gmail.send` a la pantalla de consentimiento
  OAuth.
- Ajustes → Bancos: "Reconectar para enviar avisos".

## 2.2.0 — 2026-10-12

### Arranque de 0 (M8)
- `Ajustes → Arranque de 0`: con confirmación escrita (`ARRANCAR`) y un saldo
  inicial nuevo por cada cuenta y tarjeta (precargado con el de hoy), archiva
  todos los movimientos, borra las cuotas pendientes y elimina
  financiamientos y préstamos (las cuotas cobradas quedan archivadas). Solo
  los saldos iniciales nuevos quedan visibles. Todo en una operación atómica.

### Base de datos (correr a mano, DESPUÉS de todo 2.1.0)
1. `supabase/Versionamiento/2.2.0/00_fresh_start.sql`

## 2.1.0 — 2026-10-12

Cierre de la Fase 2 del rediseño por dominio y limpieza.

### Eliminar vs. desactivar (G4, G5)
- Cuentas, tarjetas, categorías y bancos con historia ya no se borran en
  cascada: se **desactivan** (se conservan y se pueden reactivar). Lo que no
  tiene historia se puede eliminar. El saldo inicial no cuenta como historia.
- Sobre lo desactivado no se registra ni se edita (G4): movimientos, saldo
  inicial, categoría de un gasto o ingreso nuevo, aprobar un pendiente con
  una categoría desactivada, asociar una tarjeta a un banco desactivado.
- Sección "Desactivadas" en cada página para reactivar.
- Los listados de movimientos nombran el origen desactivado como
  "<nombre> (desactivada)"; esas filas no se editan hasta reactivarlo.

### Arquitectura
- Todas las escrituras del catálogo pasan por casos de uso
  (`src/application/catalog.ts`) con reglas en `src/domain/catalog/`.

### Préstamos bancarios (nuevo)
- `/procesos/prestamos`: préstamos a cuota fija (sistema francés) con
  calendario de cuotas, interés y abono al capital, capital pendiente,
  intereses pagados y por pagar, y aviso de atraso.
- "Pagar cuota" registra un gasto desde una cuenta, en orden; "Deshacer"
  quita el último pago. El desembolso puede registrarse como ingreso.
- Reglas L1–L5 y F5 en `src/domain/loans/`.
- Resumen: las cuotas vencidas o próximas (31 días) de cada préstamo aparecen
  en "Pagos próximos" junto a las tarjetas y suman en "A pagar" y en la
  cobertura del débito (L6). Nueva tarjeta "Capital pendiente en préstamos";
  el patrimonio neto lo resta.

### Limpieza
- Se borra el SP `create_financing` (1.2.2), reemplazado por
  `create_financing_v2` en 2.0.0.
- Se quita código sin uso (`TRANSACTION_TYPE_LABELS`) y se ajusta la
  documentación de financiamientos.

### Base de datos (correr a mano, DESPUÉS de todo 2.0.0)
1. `supabase/Versionamiento/2.1.0/00_drop_create_financing.sql`
2. `supabase/Versionamiento/2.1.0/01_loans.sql`

## 2.0.0 — 2026-10-12

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

### Fase 2 — casos de uso y adaptadores
- `src/application/`: puertos (repositorios) y casos de uso para registrar,
  editar y borrar movimientos, crear y borrar financiamientos, y aprobar o
  descartar pendientes. Probados con repositorios en memoria (51 tests).
- `src/infrastructure/`: adaptador Supabase de esos puertos y un único punto
  (`container.ts`) para elegir la base de datos.
- Las Server Actions de esos flujos ya no consultan Supabase directamente.
- Una cuenta o tarjeta archivada ya no se acepta como origen de un movimiento.

### Fase 3 — saldos como proyección verificable
- **Saldo inicial como movimiento** (`opening_balance`): el formulario de cuenta y
  tarjeta pide "Saldo inicial" (con signo) y su fecha; el saldo actual ya no se
  edita a mano. En la tarjeta aparece como "Saldo inicial" y cuenta como cargo en
  su fecha.
- **Ajustes → Verificar saldos**: compara cada saldo guardado con sus movimientos y
  permite recalcular.
- Las cuotas de un financiamiento las calcula el dominio y la base las guarda tal
  cual (`create_financing_v2`, valida cantidad y suma).

### Funciones nuevas
- **Eliminar un financiamiento conserva las cuotas ya cobradas** (fecha ≤ hoy); se
  borran solo las futuras y el plan queda como "Cancelado". Las cuotas conservadas
  se pueden quitar a mano desde el historial de la tarjeta.
- **Transferencias entre cuentas propias** (`/procesos/transferencias`): misma
  moneda, cuentas distintas; no cuentan como gasto ni ingreso.
- **SINPE**: botón "Nuevo SINPE" en Gastos; gasto desde cuenta con destinatario y
  teléfono opcionales.
- **Tarjeta bimoneda**: cada tarjeta lleva saldo y estado de cuenta en colones y en
  dólares; la moneda de la tarjeta pasa a ser la del límite. Cargos con selector de
  moneda, abonos al saldo de la moneda de la cuenta, saldo inicial en ₡ y $, y
  **disponible** con el tipo de cambio manual (**Ajustes → Tipo de cambio**). Los
  pendientes del correo se aprueban contra cualquier tarjeta.

### Base de datos (correr a mano, en orden, ANTES de desplegar)
- `supabase/Versionamiento/2.0.0/00_opening_balance.sql`
- `supabase/Versionamiento/2.0.0/01_balance_projection.sql`
- `supabase/Versionamiento/2.0.0/02_migrate_opening_balances.sql`
- `supabase/Versionamiento/2.0.0/03_create_financing_v2.sql`
- `supabase/Versionamiento/2.0.0/04_cancel_financing.sql`
- `supabase/Versionamiento/2.0.0/05_transfers_and_sinpe.sql`
- `supabase/Versionamiento/2.0.0/06_multicurrency_cards.sql`

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
