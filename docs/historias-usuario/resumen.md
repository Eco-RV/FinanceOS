# Resumen

> Ver convención general en [`README.md`](./README.md).

## Resumen

La pantalla de inicio (`/dashboard`): de un vistazo, cuánta liquidez hay,
qué toca pagar, cuánto crédito queda y en qué se va el dinero. Cada card
abre un modal con su detalle. Todo suma en colones: desde 3.0.1 (G7) lo que
está en dólares (cuentas corrientes, tarjetas, cuotas de préstamo) se
convierte con el último tipo de cambio, que la app trae del BCCR una vez al
día al abrir el Resumen (T10).

## Historias de usuario

### 1. Ver mi liquidez
Como usuario quiero ver cuánto dinero tengo disponible en mis cuentas de
débito, para saber con qué cuento para pagar.

**Criterios de aceptación**
- Card **Liquidez** (antes "Disponible en débito"), a lo ancho, primera fila:
  suma de las cuentas de débito en colones. No cuenta efectivo ni ahorros.
- Al tocarla, un modal lista las cuentas que la forman (saldo mayor que 0),
  con su parte del total.

### 2. Ver qué toca pagar, el consumo sin cortar y los financiamientos
Como usuario quiero ver juntos lo que debo pagar de contado, lo que llevo
consumido desde el corte y mis financiamientos.

**Criterios de aceptación**
- Segunda fila, tres cards: A pagar de contado, Consumo sin cortar y
  **Faltante** (historia 4).
  - **A pagar de contado** (o "A pagar (tarjetas y préstamos)"): modal con
    los pagos atrasados y por vencer, cada uno lleva a su tarjeta o préstamo.
  - **Consumo sin cortar**: modal con las tarjetas con consumo después del
    corte, su fecha de corte y el total.
  - **Financiamientos** (antes "Financiamientos activos", ahora en la quinta
    fila): cantidad de planes
    con cuotas por cobrar; el modal lista cada uno con su próxima cuota y
    lleva a su detalle; "Ver todos" abre `/procesos/financiamientos`.

### 3. Ver mis gastos por categoría
Como usuario quiero ver cuánto gasté y en qué categorías, para entender en
qué se me va el dinero.

**Criterios de aceptación**
- Tercera fila: tres cards con el total de gastos de los **últimos 7 días**,
  **este mes** y **este año**; la elegida define la vista del gráfico.
- Cuarta fila: card grande con el total arriba y barras por categoría (de la
  más usada a la menos; desde la sexta se agrupan en "Otras"), con ícono,
  monto y porcentaje.
- Solo gastos ya ocurridos (las cuotas futuras de financiamientos no
  cuentan) y en colones.
- Tocar la card del gráfico abre **Gastos** filtrado por el período elegido;
  tocar una barra lo filtra además por esa categoría ("Otras" no filtra).

### 4. Ver mi crédito disponible, los cobros y el faltante
Como usuario quiero saber cuánto crédito me queda, cuánto me deben y si mi
débito alcanza para pagar de contado.

**Criterios de aceptación**
- Quinta fila: Disponible en crédito, Cobros a miembros y Financiamientos.
  Faltante va en la segunda fila.
  - **Disponible en crédito**: Σ (límite − lo usado) de las tarjetas con
    límite, incluido el capital de los financiamientos y el consumo sin
    cortar (T2), convertido a colones con el último tipo de cambio. El modal
    muestra cada tarjeta con su disponible en **verde** (≥ 50 % del límite),
    **amarillo** (≥ 20 %) o **rojo** (menos).
  - **Cobros a miembros**: lo que deben de cuotas ya cobradas y los avisos
    por enviar; lleva a Cobros.
  - **Faltante**: lo que le falta a la liquidez para cubrir todo "A pagar de
    contado"; 0 en verde si alcanza, amarillo si alcanza para los próximos 10
    días pero no para todo, rojo si ya no alcanza para los próximos 10 días.
    No tiene modal.
- El aviso grande de cobertura ("Con tu débito te faltan…") se quitó: lo
  reemplaza la card Faltante.

### 5. Ver los pagos próximos y los cortes
**Criterios de aceptación**
- Debajo de la grilla siguen "Pagos próximos" (Atrasadas / Por vencer) y
  "Próximos cortes"; en pantallas anchas van lado a lado.
- El aviso de atraso (tarjetas o préstamos) sigue arriba de todo.

### 6. Gastos en dólares y comparar períodos (3.1.0)
Como usuario quiero ver todos mis gastos (también los de dólares) y saber si
estoy gastando más o menos que antes.

**Criterios de aceptación**
- Las cards 7 días / Mes / Año y el gráfico por categoría suman los gastos en
  dólares convertidos a colones con el último tipo de cambio (G9). Sin tipo de
  cambio, quedan fuera y la card dice cuántos.
- Cada card muestra la variación contra el período anterior equivalente (G10):
  los 7 días previos, el mes pasado hasta el mismo día y el año pasado hasta el
  mismo día. Más gasto en rojo (↑), menos en verde (↓); "nuevo" si antes no hubo
  gastos.
- El gráfico muestra debajo del total "vs. ₡X en el mes pasado a esta fecha" y,
  en cada categoría, su variación.

## Reglas de negocio

- Cobertura y faltante: `computeCoverage` y `coverageShortfall`
  (`src/domain/coverage/coverage.ts`).
- Semáforo del disponible: `availabilityLevel`
  (`src/domain/cards/multicurrency.ts`).
- Todo lo que suma en el Resumen es en colones (G7): la cobertura, el
  faltante, los pagos de contado, el consumo sin cortar y el patrimonio neto
  convierten lo de dólares con el último tipo de cambio. Sin tipo de cambio, lo
  de dólares se lista pero no suma, y el patrimonio lo indica.

## Pendiente / fuera de alcance

- Comparar contra un presupuesto (comparar períodos ya existe, G10).

## Historial

- **2026-10-14 (v2.5.0, en desarrollo)** — Archivo nuevo. Grilla nueva del
  Resumen con modales de detalle, Liquidez, gráfico de gastos por categoría,
  Disponible en crédito con semáforo y Faltante (reemplaza el aviso de
  cobertura).
- **2026-10-18 (v3.0.1, en desarrollo)** — Multimoneda en la cobertura y el
  patrimonio (G7) con el tipo de cambio del BCCR traído una vez al día (T10).
- **2026-10-19 (v3.0.1, en desarrollo)** — Card "Recordatorios" (P8).
- **2026-10-20 (v3.1.0, en desarrollo)** — Gastos en dólares en el gráfico y
  las cards (G9) y comparación con el período anterior (G10).
