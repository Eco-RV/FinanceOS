# Enfoque y funciones

> Ver convención general en [`README.md`](./README.md).

## Resumen

Desde la 3.2.0 Finance OS arranca con una sola promesa: **no pagar intereses
en las tarjetas**. Una cuenta nueva ve solo el núcleo (Resumen, Tarjetas,
Cuentas, Gastos y el gasto rápido) y descubre el resto en el camino: por
sugerencias que salen de lo que ya hizo, o activándolo en **Más funciones**
(`/procesos/funciones`). La página de inicio pública (`/`) cuenta esa misma
promesa.

## Historias de usuario

### 1. Entender qué resuelve la app antes de registrarme
Como visitante quiero ver en una pantalla qué hace Finance OS, para decidir
si me registro.

**Criterios de aceptación**
- `/` sin sesión muestra la promesa, los 3 pasos (tarjeta, cuenta, cuánto
  pagar y si alcanza) con un ejemplo de cada uno, "Crear cuenta" (abre el
  registro) y "Ya tengo cuenta". Con sesión, va directo al Resumen.
- Enlace a la política de privacidad.

### 2. Empezar sin que la app me abrume
Como usuario nuevo quiero ver solo lo necesario para no pagar intereses.

**Criterios de aceptación**
- Una cuenta nueva ve el núcleo (E1, E3): Procesos muestra Cuentas, Tarjetas,
  Gastos y "Más funciones"; Ajustes, Mi cuenta, Preferencias, Funciones y
  Categorías; solo el botón de nuevo gasto.
- Las categorías sugeridas de gastos e ingresos ya están cargadas.
- El Resumen muestra los primeros pasos (ver `resumen.md`).
- La bienvenida animada sale solo la primera vez en cada dispositivo.

### 3. Activar o apagar funciones
Como usuario quiero elegir qué partes de la app uso.

**Criterios de aceptación**
- **Más funciones** (desde Procesos o Ajustes → Funciones) lista cada función
  con una línea de qué resuelve, si está activa y, si lo está, "Abrir".
  Primero las activas.
- **Activar** / **Apagar** guarda la elección en la cuenta (sirve en todos los
  dispositivos) y cambia la navegación de inmediato (E2, E3).
- Apagar no borra datos ni bloquea su URL.
- "Ver de nuevo los primeros pasos" los vuelve a mostrar en el Resumen.

### 4. Recibir la función que sigue cuando me sirve
Como usuario quiero que la app me proponga algo nuevo cuando ya estoy listo,
no antes.

**Criterios de aceptación**
- Con los primeros pasos cerrados, el Resumen propone una función a la vez
  según un logro (E4), con el motivo en una línea.
- **Activar** la enciende y abre su pantalla; **Ahora no** la descarta (sigue
  disponible en el catálogo).
- Una cuenta que ya tenía todo encendido no recibe sugerencias.

## Reglas de negocio

- E1–E5 en [`docs/dominio/reglas.md`](../dominio/reglas.md).
- Las elecciones se guardan en `profiles.preferences.features` (sin SQL
  nuevo). Una cuenta que ya tenía datos al llegar a la 3.2.0 queda con todo
  encendido (no cambia lo que veía).
- La Constelación no es una función del catálogo: se enciende solo por
  entorno (`NEXT_PUBLIC_FEATURE_CONSTELLATION`) y vuelve en la 4.0.0.

### 5. Que cada pantalla vacía me diga qué hacer
Como usuario nuevo quiero que una lista vacía me lleve al paso que sigue.

**Criterios de aceptación**
- Tarjetas y Cuentas vacías explican para qué sirve agregar una y traen el
  botón "Nueva tarjeta" / "Nueva cuenta". Gastos vacío trae "Nuevo gasto"; sin
  tarjeta ni cuenta, "Agregar tarjeta" y "Agregar cuenta".
- El historial vacío de una tarjeta o cuenta explica cómo anotar una compra.
- Los enlaces de los primeros pasos abren directo el diálogo:
  `/procesos/tarjetas?nueva=1`, `/procesos/cuentas?nueva=1`,
  `/procesos/gastos?nuevo=1` y, con una sola tarjeta, su detalle con
  `?pago=1` ("Registrar pago / abono"). El parámetro se quita de la URL al
  abrir (recargar no lo reabre).

### 6. No ver acciones de lo que apagué
Como usuario quiero que, si apago una función, sus botones no aparezcan en
las pantallas del núcleo.

**Criterios de aceptación**
- Con "Gastos compartidos" apagada, los gastos no ofrecen "Compartir" (lo ya
  compartido sigue enlazado: "Ver en Compartidos").
- Con "Financiamientos" apagada, el detalle de una tarjeta no ofrece crear
  uno y su sección solo aparece si ya hay financiamientos; Gastos no muestra el
  botón "Financiamientos".

## Pendiente / fuera de alcance

- Probar el registro real de una cuenta nueva de punta a punta (necesita una
  cuenta de prueba).

## Historial

- **2026-10-21 (v3.2.0, en desarrollo)** — Archivo nuevo: página de inicio
  pública, modo enfocado, catálogo "Más funciones", sugerencias por logro y
  primeros pasos (E1–E5). Constelación detrás de su interruptor de entorno.
- **2026-10-21 (v3.2.0, en desarrollo)** — Estados vacíos con acción, enlaces
  que abren el diálogo directo (`?nueva=1`, `?nuevo=1`, `?pago=1`) y sin
  "Compartir" ni "Financiar" con esas funciones apagadas.
