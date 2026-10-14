# Flujo de trabajo: ramas, despliegue, SQL versionado y releases

Así funciona hoy Finance OS (Next.js + Supabase + Vercel). Sirve como plantilla
para otro proyecto con el mismo stack.

---

## 1. Ramas

| Rama | Para qué | Cómo entra el código |
|---|---|---|
| `main` | Lo publicado (producción). Nunca se trabaja directo. | Solo por PR desde `dev_main`. |
| `dev_main` | Integración: lo que va en la próxima versión. | PR desde las ramas de feature; docs y ajustes menores van directo. |
| `feature/<versión>` (p. ej. `feature/2.3.0`) | Una versión o feature nueva. | Sale de `dev_main` y vuelve por PR a `dev_main`. |

Reglas:
- Las ramas son **solo para features nuevas**. Docs, README, CHANGELOG y ajustes
  menores se commitean directo en `dev_main`.
- PRs con **merge commit** (sin squash ni rebase), así cada versión queda
  identificable en el historial.
- Publicar = PR `dev_main → main` + etiqueta + release (ver sección 5).

```
feature/2.3.0 ──PR──▶ dev_main ──PR──▶ main ──▶ etiqueta v2.3.0 + release
     ▲                   │
     └── sale de ────────┘
```

## 2. Entornos y despliegue

**Vercel** (integración de GitHub, sin `vercel.json` ni configuración extra):
- Cada push a **cualquier rama** genera un **Preview** con su propia URL. Vercel
  la comenta en el PR ("Vercel Preview Comments").
- Cada commit que cae en **`main`** se despliega a **Producción**.
- Las variables de entorno se cargan en *Project → Settings → Environment
  Variables*. Se pueden separar por entorno (Production / Preview /
  Development). Si no las separás, los Previews usan las mismas que producción,
  incluido el mismo proyecto de Supabase.

**Supabase**:
- Un solo proyecto (producción). La integración con GitHub está instalada, pero
  sin *Branching*: el check "Supabase Preview" sale como `skipped`.
- **El SQL no se aplica solo.** Se corre a mano en el SQL Editor, desde la
  carpeta de la versión (sección 4), **antes** de que el código llegue a `main`.

> Si querés un staging real: creá un segundo proyecto de Supabase y poné sus
> llaves en las variables de **Preview** de Vercel. Así `dev_main` y las ramas
> de feature prueban contra staging y `main` contra producción. El SQL nuevo se
> corre primero en staging y después en producción.

## 3. Chequeos (CI)

- No hay GitHub Actions. Antes de cada PR se corre local:
  ```bash
  npm run lint
  npm test        # node --test: dominio, casos de uso, parsers
  npm run build
  ```
- El build de Vercel en cada Preview funciona como chequeo de build: si falla,
  el PR lo muestra en rojo.
- Opcional, para replicarlo con CI: `.github/workflows/ci.yml` que en cada PR
  corra `npm ci`, `npm run lint`, `npm test` y `npm run build`, y en GitHub una
  regla de protección que pida ese check verde para fusionar en `dev_main` y
  `main`.

## 4. SQL versionado (`supabase/Versionamiento/`)

Estructura: una carpeta por versión de la app y, dentro, los archivos numerados
en **orden de ejecución**.

```
supabase/Versionamiento/
  1.2.2/
    00_financings_schema.sql
    01_create_financing_function.sql
  2.3.0/
    00_financing_interest.sql
    01_members.sql
    02_mail_send_scope.sql
```

Reglas:
1. **Todo SQL nuevo** (tablas, columnas, RLS, índices, funciones/SP) va en la
   carpeta de la versión en desarrollo. Una carpeta publicada no se vuelve a
   tocar: queda como respaldo de lo que se corrió.
2. Nombres `NN_descripcion.sql` (`00_`, `01_`, …) en el orden en que hay que
   correrlos.
3. Cada archivo empieza con un comentario: versión, qué hace, por qué y
   **cuándo correrlo** ("Ejecutar ANTES de desplegar el código 2.3.0",
   "DESPUÉS de 00_…").
4. **Idempotente** siempre que se pueda: `create table if not exists`,
   `add column if not exists`, `create or replace function`,
   `drop policy if exists` antes de `create policy`,
   `drop constraint if exists` antes de `add constraint`.
5. Cambios compatibles con el código anterior: una función con firma nueva se
   crea con otro nombre (`create_financing_v3`) y la vieja se borra en la
   versión siguiente, no en la misma. Así se puede correr el SQL antes de
   desplegar sin romper producción.
6. Cada tabla nueva lleva el patrón de seguridad del proyecto: `user_id` con
   default `auth.uid()`, RLS activado, 4 policies (select/insert/update/delete
   own) e índice parcial `where not archived`.
7. Base nueva desde cero: correr todas las carpetas en orden de versión (el
   README tiene la tabla). Base existente: solo las carpetas nuevas.

## 5. Publicar una versión (release)

1. En la rama de la feature: subir la versión en `package.json` (`npm version
   2.3.0 --no-git-tag-version`) y escribir la sección en `CHANGELOG.md`.
2. PR `feature/x.y.z → dev_main` y fusionar.
3. **Correr el SQL** de `supabase/Versionamiento/x.y.z/` en Supabase, en orden.
4. PR `dev_main → main` y fusionar. Vercel despliega a producción.
5. Etiqueta sobre el commit de `main`:
   ```bash
   git fetch origin
   git tag -a vx.y.z origin/main -m "vx.y.z"
   git push origin vx.y.z
   ```
6. GitHub → Releases → *Draft a new release* → etiqueta `vx.y.z`, título
   `vx.y.z — <resumen>` y como cuerpo la sección del CHANGELOG, que siempre
   incluye:
   - qué cambió (por área);
   - **Base de datos**: la lista de archivos SQL en orden y cuándo correrlos;
   - **Configuración**: variables nuevas, permisos (OAuth, etc.).

### Formato de `CHANGELOG.md`

```markdown
## 2.3.0 — 2026-10-14

Una línea con el resumen.

### <Área>
- Cambio visible para el usuario.

### Base de datos (correr a mano, en orden, DESPUÉS de todo 2.2.0)
1. `supabase/Versionamiento/2.3.0/00_....sql`

### Configuración
- Variable o permiso nuevo.
```

Mientras se desarrolla, la versión va como `## x.y.z — sin publicar`; al
publicar se cambia por la fecha.

## 6. Documentación que acompaña cada cambio

- `docs/CONTEXT.md`: guía técnica (arquitectura, convenciones, roadmap,
  gotchas). Se actualiza en el mismo cambio.
- `docs/historias-usuario/<proceso>.md`: qué hace cada módulo, con un
  historial fechado por versión.
- `docs/dominio/`: glosario y reglas de negocio.
- `README.md`: qué hace la app, puesta en marcha (con la tabla de SQL) y este
  flujo en corto.

## Checklist por versión

- [ ] Rama `feature/x.y.z` desde `dev_main`
- [ ] SQL en `supabase/Versionamiento/x.y.z/`, numerado e idempotente
- [ ] `npm run lint`, `npm test` y `npm run build` en verde
- [ ] Docs, CHANGELOG y versión en `package.json`
- [ ] PR → `dev_main`, Preview de Vercel OK
- [ ] SQL corrido en Supabase
- [ ] PR `dev_main` → `main` (despliega producción)
- [ ] Etiqueta `vx.y.z` + release con notas, SQL y configuración
