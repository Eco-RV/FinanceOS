# Comentarios (buzón)

> Ver convención general en [`README.md`](./README.md).

## Resumen

Un lugar privado y tranquilo (`/comentarios`) para que cada usuario cuente
su experiencia, pregunte o proponga mejoras, y el equipo de Finance OS le
responda ahí mismo. No usa ventanas emergentes ni avisos que interrumpan. El
equipo (admin) lo lee todo desde la **Bandeja**.

## Historias de usuario

### 1. Escribirle al equipo
Como usuario quiero contar cómo me va, preguntar o pedir algo, sin salir de
la app.

**Criterios de aceptación**
- **Escribir** (en Comentarios) abre un formulario: tipo (Experiencia, Duda,
  Mejora, Me gustaría que tuviera, con una ayuda de qué escribir en cada uno),
  título, mensaje y una captura opcional (JPG, PNG o WebP de hasta 5 MB)
  (B1, B4).
- Va con mi nombre del perfil o, si no tengo, con mi correo (B2). Solo yo y
  el equipo lo leemos.
- Al enviar, abre la conversación. Si la captura no se pudo subir, la
  publicación queda y se avisa.

### 2. Seguir mis publicaciones
Como usuario quiero ver lo que escribí, en qué estado está y si me
respondieron.

**Criterios de aceptación**
- Comentarios lista mis publicaciones con su tipo, la última actividad y su
  estado (Recibido, En revisión, En planes, Hecho, No por ahora).
- Un punto marca las que tienen una respuesta o un cambio de estado sin leer
  (B5). El menú del usuario también muestra un punto y cuántas son.
- Sin publicaciones, un texto que invita a escribir y el botón "Escribir el
  primero".

### 3. Conversar
Como usuario quiero responderle al equipo en la misma publicación.

**Criterios de aceptación**
- La conversación muestra los mensajes en orden (los míos a la derecha), el
  estado y qué significa, y la captura ("Ver la captura").
- Abrirla la marca leída (B5).
- Respondo con el cuadro de abajo. Si está Hecho o No por ahora, la
  conversación se cerró: me invita a escribir una nueva (B6).

### 4. Atender el buzón (equipo)
Como equipo quiero leer todo lo que llega, responder y avisar en qué quedó.

**Criterios de aceptación**
- **Bandeja** (`/comentarios/bandeja`, en el menú del usuario solo para el
  admin) lista todas las publicaciones con autor, tipo, actividad y estado.
  Filtros: Sin leer (por defecto), Abiertas, Cerradas, Todas, y por tipo.
  Quien no es admin recibe 404.
- En la conversación, el admin responde como "Equipo Finance OS" y cambia el
  estado. Si es No por ahora, el motivo es obligatorio y se envía como
  respuesta (B3). Un cambio de estado le aparece al usuario como sin leer.

### 5. Encontrar el buzón sin que me interrumpa
Como usuario quiero saber dónde escribir, sin avisos encima.

**Criterios de aceptación**
- Entradas: menú del usuario → Comentarios, Ajustes → Comentarios y un
  enlace al pie del Resumen ("¿Algo que contarnos? Escríbenos").

## Reglas de negocio

- B1–B6 en [`docs/dominio/reglas.md`](../dominio/reglas.md).
- El rol de admin va en `app_metadata.role` y lo pone un SQL
  (`supabase/Versionamiento/3.2.0/02_feedback_admin.sql`); el usuario no lo
  puede cambiar. Después de darlo, hay que cerrar sesión y volver a entrar.
- Los mensajes no se editan ni se borran. Borrar la cuenta borra lo publicado.

## Pendiente / fuera de alcance

- Aviso por correo al equipo cuando llega una publicación nueva (hoy, el
  contador del menú y la bandeja).
- Publicaciones visibles para todos (votos, "a mí también"): se decidió que
  fuera privado.

## Historial

- **2026-10-21 (v3.2.0, en desarrollo)** — Archivo nuevo: buzón privado,
  conversación, estados y bandeja del equipo (B1–B6).
