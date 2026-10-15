# Finance OS — Marca y diseño

Guía oficial de la identidad de Finance OS. El logotipo elegido es
**Bloques** (2.5.0). Ante cualquier duda sobre cómo se ve la app, manda este
documento junto con `src/app/globals.css` (tokens) y `docs/CONTEXT.md`
(componentes).

## 1. Concepto

Seis bloques redondeados en escalera: una, dos y tres filas que suben de
izquierda a derecha. Representa **orden** (cada cosa en su bloque) y
**crecimiento** (la escalera que sube). El bloque de arriba a la derecha es el
acento: es la meta, el único al 100 % de opacidad.

El mismo lenguaje de bloques vive en el fondo animado de la app
(`AppBackdrop`): bloques que flotan sobre una cuadrícula.

## 2. Archivos oficiales

| Archivo | Uso |
|---|---|
| [`logo-app-oscuro.svg`](./logo-app-oscuro.svg) | Ícono de la app (PWA, favicon, `public/icon.svg`). Tile negro, bloques claros. |
| [`logo-app-claro.svg`](./logo-app-claro.svg) | Ícono sobre fondos oscuros o materiales impresos claros. |
| [`isotipo-negro.svg`](./isotipo-negro.svg) | Solo los bloques, sobre fondo claro. |
| [`isotipo-blanco.svg`](./isotipo-blanco.svg) | Solo los bloques, sobre fondo oscuro. |
| [`logotipo-horizontal.svg`](./logotipo-horizontal.svg) | Tile + "Finance OS", para encabezados y documentos. |

En el código: `src/components/brand-logo.tsx` → `LogoMark` (isotipo con
`currentColor`, opción `animated`) y `LogoTile` (isotipo en su tile, usa
`bg-primary` / `text-primary-foreground`, así se invierte solo en modo
oscuro).

## 3. Construcción

- Lienzo de **32 × 32** unidades.
- Cada bloque mide **7 × 7**, con radio **2**; separación de **2** entre
  bloques; margen interno de **3,5**.
- Columnas en `x = 3.5`, `12.5`, `21.5`; filas en `y = 21.5`, `12.5`, `3.5`.
- Columna 1: 1 bloque · columna 2: 2 bloques · columna 3: 3 bloques.
- Opacidades por fila: abajo **38 %**, medio **60 %**, el bloque de arriba
  **100 %**.
- Tile: cuadrado con radio del **22 %** del lado (112 en 512). El isotipo
  ocupa el **78 %** del tile (escala 12,5 desde 32, desplazado 56).

## 4. Área de respeto y tamaños

- Alrededor del tile, dejar libre al menos **¼ del lado del tile**.
- Tamaño mínimo: **16 px** el isotipo, **20 px** el tile. Por debajo de 24 px
  usar el tile (los bloques sueltos pierden lectura).
- En la barra de la app el tile mide 28 px (`size-7`); en el login, 44 px; en
  la bienvenida, 80 px.

## 5. Color

La marca es **monocroma**: el color está reservado para comunicar estado
(dinero que entra, alerta, atraso).

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--primary` | `oklch(0.205 0 0)` ≈ #171717 | `oklch(0.922 0 0)` ≈ #e5e5e5 | Tile del logo, botones principales |
| `--background` | `oklch(0.975 0 0)` | `oklch(0.145 0 0)` | Fondo de página |
| `--card` | blanco | `oklch(0.205 0 0)` | Superficies (`surface`) |
| `--success` | `oklch(0.6 0.15 155)` | `oklch(0.74 0.15 155)` | Cubierto, disponible alto, éxito |
| `--warning` | `oklch(0.7 0.16 70)` | `oklch(0.8 0.15 75)` | Atención, disponible medio |
| `--destructive` | `oklch(0.577 0.245 27)` | `oklch(0.704 0.191 22)` | Atraso, faltante, gastos |
| `--chart-1..5` | verde, azul, violeta, ámbar, rosa | (más claros) | Gráficos e íconos de categoría |
| Beta | `violet-500` | `violet-500` | Solo la leyenda "beta" |

Hex del ícono exportado: tile `#0a0a0a`, bloques `#fafafa`.

## 6. Tipografía

- **Geist** (sans) para todo; **Geist Mono** para números de tarjeta.
- Logotipo: "Finance" en peso 600 con tracking `-0.02em`; " OS" en el mismo
  peso con color atenuado (`text-muted-foreground`).
- Montos siempre con `tabular-nums`. Títulos de página `text-2xl font-semibold
  tracking-tight`.

## 7. Forma y movimiento

- Radios: superficies `rounded-xl`, diálogos `rounded-2xl`, tarjetas de
  crédito `rounded-2xl`, chips `rounded-full`.
- Superficies: utilidad `surface` (card + anillo suave + sombra).
- Movimiento corto y con propósito: `ease-fluid` para transiciones,
  `ease-spring` para entradas que "rebotan" (logo, confirmación). Entradas en
  cascada con `rise` y `--rise-i`.
- Con "reducir movimiento" del sistema todo queda quieto (`[data-motion]`).

## 8. Usos correctos e incorrectos

**Sí**
- Tile oscuro sobre fondo claro y tile claro sobre fondo oscuro.
- Isotipo solo, en `currentColor`, dentro de botones o encabezados.
- Animar la entrada de los bloques (uno por uno) en bienvenida y login.

**No**
- Cambiar el orden, la cantidad o la proporción de los bloques.
- Darle color a los bloques (verde, violeta…) o degradados.
- Rotar, deformar o agregarle sombras/contornos al isotipo.
- Poner el isotipo sobre fotos o fondos con poco contraste.
- Separar "Finance" y "OS" o cambiar la tipografía del logotipo.

## 9. Historial

- **2026-10-14 (v2.5.0)** — Se elige **Bloques** entre cinco propuestas
  (`docs/logos/`) y se publica esta guía.
