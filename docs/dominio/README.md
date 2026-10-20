# Dominio — Finance OS

Modelo de negocio de la app, independiente de la tecnología. Aquí vive el
**qué** y las **reglas**; la base de datos, el login, el correo o la interfaz
son detalles que pueden cambiar sin tocar lo que se describe acá.

Se abrió en la versión **2.0.0** (Fase 0 del rediseño por dominio, DDD
pragmático) a partir del documento del usuario *BusinessLogic Finance OS*.

| Archivo | Contenido |
|---|---|
| [`glosario.md`](./glosario.md) | Lenguaje ubicuo: un término = un significado, igual en conversación, docs y código. |
| [`contextos.md`](./contextos.md) | Mapa de contextos delimitados y cómo se relacionan. |
| [`reglas.md`](./reglas.md) | Invariantes: qué rechaza el sistema y qué solo advierte. |
| [`arquitectura.md`](./arquitectura.md) | Cómo se separa el dominio del resto (puertos y adaptadores) y decisiones de infraestructura. |
| [`pendientes.md`](./pendientes.md) | Lo que falta de la lógica de negocio: reglas sin implementar, historias pendientes y fases abiertas (auditoría 3.1.0). |

## Relación con el resto de la documentación

- `docs/historias-usuario/` describe **qué puede hacer el usuario** (casos de
  uso, criterios de aceptación). Debe usar los términos de `glosario.md`.
- `docs/CONTEXT.md` describe **cómo está construido** hoy (archivos,
  convenciones).
- Esta carpeta es la referencia cuando hay duda sobre el significado de un
  término o sobre una regla. Si una historia o el código contradicen
  `reglas.md`, se corrige uno de los dos en el mismo cambio.

## Estado de las decisiones

Cada regla o término lleva una marca:

- **Decidido** — confirmado por el usuario.
- **Propuesta** — redactado por el equipo de desarrollo a partir de lo
  conversado; vale como regla hasta que el usuario lo corrija.

## Historial

- **2026-10-11 (v2.0.0, en desarrollo)** — Primera versión: glosario, mapa de
  contextos, reglas y arquitectura objetivo.
- **2026-10-18 (v3.1.0, en desarrollo)** — Auditoría de pendientes
  (`pendientes.md`), estados al día en reglas y glosario, ahorros renumerados
  A1–A3 y reglas nuevas X1–X6 (gastos compartidos).
