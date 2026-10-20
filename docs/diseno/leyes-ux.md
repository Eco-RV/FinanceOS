# Leyes de UX de Finance OS

> Reglas de diseño que se aplican en **toda pantalla nueva o rediseñada**
> (desde 3.1.0). Antes de cerrar un cambio de UI, revisa la lista de chequeo
> de cada ley. Se complementa con la guía de marca
> ([`../marca/README.md`](../marca/README.md)) y con la sección "Diseño e
> interacción" de [`../CONTEXT.md`](../CONTEXT.md).

| # | Ley | En una frase | Dato de referencia |
|---|---|---|---|
| 01 | Cierre (*closure*) | Deja asomar la siguiente card | Si no se ve nada de la siguiente (0 %), casi nadie desliza; si se ve un 32 %, sí |
| 02 | Figura-fondo | Oscurece lo que está detrás del foco | El contraste del fondo baja de 17,4:1 a ~2,5:1 |
| 03 | Ceguera a los banners | Lo importante no se ve como un anuncio | Las cajas de colores arriba de la página se ignoran |
| 04 | Ley de Parkinson | Llena lo que ya sabes | 30 teclas → 7 |
| 05 | Conexión | Une los pasos de un flujo | Los elementos conectados se leen como un grupo |
| 06 | Exceso de opciones | Muestra pocas opciones de entrada | Compraron 3 % con muchas opciones vs. 30 % con pocas |

---

## 01 · Cierre: deja asomar la siguiente card

**Qué dice.** El ojo completa lo que ve cortado. Una card a medias en el borde
invita a deslizar; una lista que termina justo en el borde parece completa.

**Cómo se aplica aquí**
- Todo carrusel horizontal deja ver **~30 % de la siguiente card** en cualquier
  ancho. Las medidas van en unidades del contenedor (`@container` + `cqw`), no
  en píxeles fijos.
- No se ocultan los bordes con degradados que tapen la card siguiente.

**Dónde ya se aplica**
- `wallet-carousel.tsx` (gasto rápido): la card mide `min(15rem, 60cqw)`.

**Chequeo**
- [ ] A 375 px y en escritorio se ve una parte de la siguiente card.
- [ ] Hay otra pista además del corte (puntos o flechas).

## 02 · Figura-fondo: oscurece lo que está detrás

**Qué dice.** Para que algo esté en foco, lo de atrás tiene que bajar de
contraste. Un velo suave (25 %) deja el fondo casi igual de legible y compite
con el diálogo.

**Cómo se aplica aquí**
- Fondo de los diálogos (`ui/dialog.tsx`) y de las confirmaciones
  (`confirm-host.tsx`): `bg-black/65` (`/70` en oscuro) con desenfoque. El
  texto de atrás queda alrededor de 3:1 o menos.
- Dentro de una vista, un estado seleccionado resalta y los demás se atenúan,
  como el carrusel de tarjetas.

**Chequeo**
- [ ] Con el diálogo abierto, lo de atrás no se puede leer de corrido.
- [ ] El diálogo tiene su propia superficie y sombra (no depende del velo).

## 03 · Ceguera a los banners

**Qué dice.** Las personas ignoran lo que tiene forma de anuncio: cajas de
colores a lo ancho, arriba de la página, con degradados o íconos grandes.

**Cómo se aplica aquí**
- Un aviso importante va **pegado a lo que describe**: un badge en la card o
  fila, o una línea junto al título de la sección.
  - El estado "Atrasada" y "Al día" del detalle de tarjeta va al lado de
    "Estado de cuenta".
  - Los avisos de cobro van como badge en la card "Cobros a miembros" del
    Resumen y en Procesos.
- Nada importante lleva degradados, ilustraciones ni formato de promoción. Los
  degradados son solo para las tarjetas dibujadas (marca).
- Un aviso de "esto puede salir mal" (C2, M4) va como una línea `bg-warning/15`
  justo debajo del campo que lo causa.

**Chequeo**
- [ ] El aviso está dentro del bloque al que se refiere, no flotando arriba.
- [ ] No compite visualmente con la acción principal de la pantalla.

## 04 · Ley de Parkinson: llena lo que ya sabes

**Qué dice.** Una tarea se estira hasta ocupar el tiempo que se le da. Si un
formulario pide lo que la app ya sabe, el usuario tarda más y abandona.

**Cómo se aplica aquí**
- Las fechas vienen en hoy (`crToday()`).
- La moneda sale del origen elegido.
- Los montos se sugieren:
  - El pago de tarjeta propone lo que falta pagar.
  - Un gasto compartido propone partes iguales.
- Se recuerda lo último elegido en este navegador (`src/lib/last-used.ts`):
  - En el gasto rápido: la forma de pago y la tarjeta o cuenta.
  - En el ingreso: la cuenta y la categoría.
  - Al cobrar un gasto compartido: la cuenta.
- Las opciones se esconden cuando hay una sola: una sola cuenta de efectivo
  no se elige, se usa.

**Chequeo**
- [ ] ¿Qué campos podría adivinar la app? Ya vienen llenos.
- [ ] Lo recordado se puede cambiar y nunca se envía sin que el usuario lo vea.
- [ ] Toda lectura de `localStorage` va en un try/catch y la pantalla funciona
  sin él.

## 05 · Conexión: une los pasos de un flujo

**Qué dice.** Los elementos unidos por una línea o un contenedor se perciben
como uno solo, más que los que solo están cerca.

**Cómo se aplica aquí**
- Un flujo de varios pasos usa `Stepper` (`src/components/stepper.tsx`):
  círculos numerados unidos por una línea, con check en lo hecho y el paso
  actual resaltado.
- Dónde se usa:
  - El alta de gasto compartido (Gasto → Personas → Revisar).
  - La puesta a punto de la wallet (Combustible → Bolsillo USDC → USDC de
    prueba).
- Los campos que van juntos (monto + moneda, desde + hasta) comparten fila o
  contenedor.

**Chequeo**
- [ ] Un proceso de más de un paso muestra en qué paso estás y cuántos faltan.
- [ ] Se puede volver a un paso anterior sin perder lo escrito.

## 06 · Exceso de opciones: muestra pocas de entrada

**Qué dice.** Con demasiadas opciones a la vez, la gente no elige ninguna.
Menos opciones visibles = más decisiones tomadas.

**Cómo se aplica aquí**
- Procesos muestra arriba lo de todos los días (Gastos, Ingresos, Tarjetas,
  Cuentas) y lo que pide atención (con badge). El resto va en "Más
  procesos".
- Los filtros de los historiales muestran Buscar, Tipo y "Incluir futuras".
  Fechas y moneda van en "Más filtros".
- El gasto rápido deja fecha y nota en "Más opciones".
- El acceso rápido tiene solo dos botones: gasto (↑, rojo) e ingreso (↓, verde).

**Chequeo**
- [ ] Hay 7 opciones o menos a la vista en la decisión principal.
- [ ] Lo secundario se puede alcanzar en un toque ("Más …").

---

## Cómo se usa este documento

- Si una pantalla rompe una ley a propósito, se explica en el PR.
- Las leyes nuevas se agregan a la tabla con su número, igual que las reglas
  de `docs/dominio/reglas.md`.

## Historial

- **2026-10-18 (v3.1.0)** — Primera versión: leyes 01 a 06 y dónde se
  aplicaron.
