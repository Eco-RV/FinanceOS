# Pendientes de la lógica de negocio

> Auditoría de la 3.0.1 (2026-10-18). Muestra **qué falta**, regla por regla
> y fase por fase, comparando [`reglas.md`](./reglas.md), las historias de
> [`../historias-usuario/`](../historias-usuario/) y el código (`src/domain`,
> `src/application`). Cada cambio que cierre o abra un pendiente lo actualiza
> aquí, en el mismo cambio.

## 1. Reglas decididas

| Regla | Qué falta | Estado |
|---|---|---|
| C2 | Avisar cuando un gasto deja la cuenta en negativo. | ✅ Implementado 3.0.1 (`overdraftWarning`) |
| M4 | Avisar cuando un abono supera la deuda. | ✅ Implementado 3.0.1 (`overpaymentWarning`) |
| K9 | El envío advertía **todas** las direcciones, incluidas las de la familia. | ✅ Completado 3.0.1 (`Pocket` pasa `knownAddresses`) |
| T8 | Pago mínimo digitado desde el estado de cuenta. | ✅ Implementado 3.0.1 (`minimumPaymentStatus`) |
| G6 | "Hoy" = día en Costa Rica. Está en el código (`crToday`) y no necesita historia propia. | ✅ (sin historia, por diseño) |
| M6, F3, I1–I3 | Están en el código, pero sin el id de la regla (I1–I3 viven en `src/lib/mail/`, fuera de `src/domain`). | ✅ Implementado · deuda menor: mover I1–I3 al dominio si crece la importación |

Estados corregidos en 3.0.1: G2 y M7 pasan a "Implementado". K3–K7 pasan a
"Implementado 3.0.0". Las reglas de ahorro **S1–S3 pasan a A1–A3**, porque
S1 ya era la regla de SINPE.

## 2. Fases abiertas de la Constelación (3.1.0)

- **Fase 6 · Apoyos** (Trustless Work): falta el puerto `EscrowService`, el
  dominio `escrow.ts` y la ruta `/api/trustless`. No hay nada de esto en el
  código (historia 7 de `constelacion.md`).
- **Academia**: el dominio, el caso de uso `completeLesson` y la tabla
  `academy_progress` ya existen; falta la pantalla (historia 8).
- **Letra grande** en Preferencias: no existe.
- **Fase 7 · integración con Finance OS**: falta la card "Ahorro en Stellar"
  en el Resumen, la meta de la bóveda (solo lectura) en Ahorros y el pago de
  cobros en USDC.
- **Estrella ↔ miembro (D13)**: la columna `constellation_stars.member_id`
  existe, pero no se usa en la pantalla.
- **Fase 8**: no está en el repo el guion de prueba manual.

## 3. "Pendiente / fuera de alcance" por proceso

Resuelto en 3.0.1 (2026-10-19): tipo de cambio del BCCR (T10) y multimoneda
en el Resumen (G7), financiamiento en la otra moneda (F10), abonos
extraordinarios (L7, F11) y tasa variable (L8), comprobantes (G8), reglas de
comercio (I6), consulta de lo archivado (M9), entrar con Google (U10), borrar
la cuenta (U8), moneda base y formato de fecha (U9), monto variable (P7),
recordatorios en la app (P8) y varias metas por cuenta (A4).

| Proceso | Lo que sigue pendiente |
|---|---|
| Financiamientos | Avisos automáticos (por decisión, solo dentro de la app, P8); editar los términos. |
| Gastos | (Hecho en 3.1.0, G9) Gastos en dólares en las cards y el gráfico. |
| Bancos | Solo Gmail; parsers de otros bancos (BCR, BN, Promerica) y de débitos de BAC: esperan correos de ejemplo. |
| Préstamos | Seguros o comisiones dentro de la cuota. |
| Arranque de 0 | Restaurar lo archivado (por diseño no se hace, M9). |
| Resumen | Comparar contra un presupuesto (comparar períodos ya existe, G10, 3.1.0). |
| Cuenta | El tema sigue siendo por dispositivo. |
| Planes | (Hecho en 3.1.0, P4) Línea base con dólares. |
| Ahorros | Aportes automáticos (metas en USD en el total: hecho en 3.1.0, A5). |
| Gastos compartidos (3.0.1) | Cobro en USDC (Fase 7). Por porcentaje: hecho en 3.1.0 (X7). |

## 4. Documentación corregida en 3.0.1

- Historias desactualizadas:
  - `cuentas.md`: el saldo ya no se edita a mano y las metas ya existen.
  - `gastos.md`: el formulario rápido ya tiene débito y SINPE, y los gastos
    recurrentes viven en Planes.
  - `ingresos.md`: la historia 3 no tenía criterios, y ya existen ingresos
    recurrentes (salario).
  - `bancos.md`: la lectura es siempre manual (I2).
  - `prestamos.md`: a la historia 6 le faltaba el "Como usuario…".
  - `constelacion.md`: la Academia, la letra grande y D13 quedan como
    pendientes.
- Glosario: Desactivar, Eliminar, Movimiento programado y Archivar ya no son
  "Propuesta". Banco = dato del usuario.
- Contextos: el Notificador (Gmail y WhatsApp) y el tipo de cambio manual ya
  tienen adaptador.

## Historial

- **2026-10-18 (v3.0.1, en desarrollo)** — Primera auditoría.
- **2026-10-19 (v3.0.1, en desarrollo)** — Se cierran T8 y los pendientes de
  tarjetas, financiamientos, préstamos, gastos, bancos (pantalla de reglas),
  arranque, resumen, cuenta, planes y ahorros. Quedan los de la tabla 3 y la
  Constelación 3.1.0.
- **2026-10-20 (v3.1.0, en desarrollo)** — Se cierran las mejoras chicas: G9,
  G10, P4 con dólares, A5 y X7.
