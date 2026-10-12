# Historias de usuario — Finance OS

Documentación funcional viva del producto, por proceso principal. Es el lugar
donde se describe **qué puede hacer el usuario y por qué**, en paralelo a
`docs/CONTEXT.md` (que describe el *cómo* — arquitectura y convenciones de
código).

## Por qué existe esta carpeta

La app se construye paso a paso y su alcance cambia de versión en versión
(ver "Roadmap" en `docs/CONTEXT.md`). Sin un lugar fijo, el conocimiento de
"qué hace cada módulo hoy" vive solo en el código o en conversaciones que se
pierden. Esta carpeta es ese lugar fijo:

- **Vive en el repo**, versionada junto al código — no en un documento suelto
  ni en un chat.
- **Se actualiza en el mismo cambio** que modifica el comportamiento descrito
  (mismo commit o PR), igual que se hace con `docs/CONTEXT.md`.
- **No se reescribe de cero ni se borra**: evoluciona. Si una historia deja de
  ser cierta, se corrige en el lugar donde vive (para que el documento siempre
  describa el presente) y se deja un rastro en el **Historial** de ese archivo
  (para no perder el pasado).

## Un archivo por proceso principal

| Archivo | Proceso |
|---|---|
| [`cuentas.md`](./cuentas.md) | Cuentas de débito, ahorro y efectivo |
| [`tarjetas.md`](./tarjetas.md) | Tarjetas de crédito, cortes/pagos y financiamientos |
| [`gastos.md`](./gastos.md) | Registro de gastos |
| [`ingresos.md`](./ingresos.md) | Registro de ingresos |
| [`bancos.md`](./bancos.md) | Bancos y correos: importación automática de compras |
| [`transferencias.md`](./transferencias.md) | Transferencias entre cuentas propias |
| [`prestamos.md`](./prestamos.md) | Préstamos bancarios a cuota fija |
| [`arranque.md`](./arranque.md) | Arranque de 0 (empezar de nuevo) |

Cuando aparezca un nuevo proceso principal (p. ej. "Préstamos" o "Ahorros y
metas" del roadmap), se agrega un archivo nuevo a esta tabla siguiendo el
mismo formato — no se mezclan procesos distintos en un solo archivo.

## Formato de cada archivo

1. **Resumen** — qué cubre el módulo, en 1-2 frases.
2. **Historias de usuario** — numeradas, formato `Como usuario quiero... para
   que...`, cada una con sus **criterios de aceptación** (comportamiento real,
   no aspiracional).
3. **Reglas de negocio** — restricciones y decisiones de diseño que no son
   obvias leyendo una sola historia (p. ej. "un pago de tarjeta exige la misma
   moneda en cuenta y tarjeta").
4. **Pendiente / fuera de alcance** — lo que el usuario podría esperar pero
   todavía no existe, para no confundir backlog con comportamiento actual.
5. **Historial** — una línea por cambio relevante, con fecha y versión de la
   app, más abajo del todo. Nunca se borran entradas viejas de esta sección.

## Cuándo actualizar esto

Cualquier cambio que toque uno de estos módulos (nueva regla, nuevo campo,
nuevo flujo, algo que se quita) debe reflejarse aquí **antes de cerrar ese
trabajo**, igual que se mantiene `docs/CONTEXT.md` al día. Si el cambio es lo
bastante grande como para no caber en una historia existente, se agrega una
historia nueva en vez de forzarla en otra.
