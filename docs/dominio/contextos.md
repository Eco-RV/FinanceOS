# Mapa de contextos

> Cada contexto tiene su propio modelo y sus propias reglas. Un contexto no
> modifica directamente los datos de otro: le pide algo o reacciona a algo
> que pasó. Ver términos en [`glosario.md`](./glosario.md).

## Contextos

| Contexto | Responsabilidad | Conceptos principales |
|---|---|---|
| **Identidad** | Quién es el usuario y cómo entra. | Usuario, sesión, cambio de contraseña, login con Google |
| **Catálogo** | Datos de referencia que configuran el resto. | Banco, tipo de cuenta, categoría de gasto, categoría de ingreso, moneda |
| **Cuentas** | Dónde tiene dinero el usuario. | Cuenta bancaria de débito, efectivo, tarjeta de débito, saldo inicial |
| **Tarjetas de crédito** | Deuda revolvente y su ciclo. | Tarjeta, límite, disponible, corte, fecha límite, saldo al corte, pago mínimo, saldo real, estado, seguro |
| **Movimientos (libro)** | El registro de hechos que cambian saldos. **Fuente de verdad.** | Movimiento, gasto, ingreso, transferencia, SINPE, abono, archivar, arranque de 0 |
| **Planes** | Cosas que generan movimientos a futuro. | Salario, suscripción, seguro, movimiento programado |
| **Financiamientos y préstamos** | Deuda a plazos. | Financiamiento con o sin interés, préstamo, cuota, tabla de amortización, abono a cuota |
| **Familia** | Repartir cuotas con contactos y avisarles. | Familia, miembro, parte, reembolso, aviso de cuota |
| **Constelación** (2.9.0 · 3.0.0) | Bolsillo en USDC sobre Stellar testnet (2.9.0); familia, bóveda con aprobaciones, apoyos y academia (3.0.0). Fuente de verdad: la cadena. No confundir con **Familia** (cobros de cuotas). | Wallet, bolsillo, USDC, trustline, estrella, núcleo, guardián, bóveda, retiro, apoyo |
| **Presupuesto** | Liquidez y gastos fijos. | Línea base financiera, periodo, tope de línea base |
| **Importación** | Traer compras desde los correos del banco. | Aviso bancario, plantilla, sincronizar, pendiente, aprobar, regla de comercio |

## Cómo se relacionan

```
Catálogo ──────────────► (lo usan todos)

Planes ──── genera movimientos programados ───► Movimientos
Financiamientos ── genera cuotas ─────────────► Movimientos
Importación ── al aprobar crea un gasto ──────► Movimientos

Movimientos ── derivan saldos ──► Cuentas
Movimientos ── derivan saldos ──► Tarjetas de crédito (estado de cuenta, disponible)

Familia ── lee cuotas y fechas límite ── de Financiamientos y Tarjetas
Familia ── envía avisos ──► (puerto Notificador: correo, WhatsApp)

Presupuesto ── lee salario ── de Planes
```

Reglas de la relación:

- **Movimientos es el centro.** Cuentas y Tarjetas no guardan saldos
  "verdaderos": los calculan desde Movimientos.
- **Planes, Financiamientos e Importación producen movimientos**, pero no los
  editan después de creados. Si se borra un plan, se borran solo sus
  movimientos **futuros**; los ya ocurridos quedan.
- **Familia no toca la tarjeta.** Los reembolsos de miembros son su propio
  registro; el abono al banco es un movimiento normal.
- **Importación no toca saldos** hasta que el usuario aprueba.
- **Constelación no toca el libro** (2.9.0): su dinero vive en la cadena;
  Finance OS solo lo lee para mostrarlo.

## Lo que está fuera del dominio (adaptadores)

Estos cambian sin tocar las reglas. Ver [`arquitectura.md`](./arquitectura.md).

| Puerto (lo que el dominio necesita) | Adaptador actual | Alternativas |
|---|---|---|
| Guardar y leer datos (repositorios) | Supabase / Postgres | Otro Postgres, cifrado de extremo a extremo, local-first |
| Identidad | Supabase Auth (correo + contraseña, Google) | Otro proveedor |
| Leer avisos bancarios | Gmail API (solo lectura) | Otro proveedor de correo |
| Notificador | Gmail del usuario (`gmail.send`) y enlace `wa.me` (envío manual, 2.3.0) | API de WhatsApp Business, envío automático |
| Tipo de cambio | Digitado a mano (Ajustes → Tipo de cambio, 2.0.0) | BCCR (pendiente) |
| Reloj ("hoy") | `crToday()` (America/Costa_Rica) | — |
