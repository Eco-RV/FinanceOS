# Guion de prueba manual · early bird (3.2.0)

Para correr **en el preview de Vercel** (o en producción antes de anunciar)
con una cuenta **nueva**, en un teléfono y en una computadora. Cada paso dice
qué hacer y qué debe pasar. Marca ✅ / ❌ y anota lo raro en la columna de
notas (o publícalo en Comentarios desde la misma app).

Preparación:
- Un correo que no tenga cuenta (por ejemplo `tucorreo+eb1@gmail.com`).
- En otra ventana, la cuenta admin abierta (para la parte del buzón).
- Teléfono con la app abierta en el navegador (y, si se puede, instalada en
  la pantalla de inicio).

| # | Paso | Debe pasar | ✅/❌ | Notas |
|---|---|---|---|---|
| **Entrada** | | | | |
| 1 | Abrir `/` sin sesión | Inicio con "No vuelvas a pagar intereses…", 3 pasos, "Crear cuenta" y "Ya tengo cuenta"; Términos y Privacidad al pie. | | |
| 2 | "Crear cuenta" | Abre el login ya en la pestaña de registro, con "Al crear tu cuenta aceptas…". | | |
| 3 | Registrarse con nombre, correo y contraseña | "Revisa tu correo". Llega el correo de confirmación (en español si ya se pegaron las plantillas). | | |
| 4 | Abrir el enlace del correo | Entra a la app con la bienvenida animada (solo esta vez) y el aviso de cuenta confirmada. | | |
| **Modo enfocado** | | | | |
| 5 | Mirar el Resumen | Card **Primeros pasos · 0 de 4**; sin Análisis, Cobros, Financiamientos ni Línea base. Solo el botón rojo (gasto), no el verde. | | |
| 6 | Procesos y Ajustes | Procesos: Cuentas, Tarjetas, Gastos y "Más funciones". Ajustes: Mi cuenta, Preferencias, Comentarios, Funciones y Categorías. Sin pestaña Constelación. | | |
| 7 | Ajustes → Categorías | Las categorías sugeridas ya están cargadas. | | |
| **No pagar intereses** | | | | |
| 8 | Primeros pasos → "Agregar tarjeta" | Abre directo el diálogo "Nueva tarjeta". Crear una con corte, pago, límite y saldo de hoy. | | |
| 9 | Primeros pasos → "Agregar cuenta" | Abre "Nueva cuenta". Crear la cuenta de débito con su saldo. | | |
| 10 | Volver al Resumen | 2 de 4; avisa que abajo ya se ve cuánto pagar. Se ven "A pagar", "Faltante" y "Próximos cortes" con la tarjeta. | | |
| 11 | "Anotar compra" | Abre "Nuevo gasto" con la tarjeta. Registrar una compra. 3 de 4. | | |
| 12 | Forzar un error en un formulario (p. ej. una categoría que ya existe) | Sale el error y **no se borra** lo escrito. | | |
| 13 | "Registrar pago" | Con una sola tarjeta, abre el pago en su detalle. Registrar el pago. **Listo** en Primeros pasos. | | |
| 14 | "Cerrar" en Primeros pasos | Aparece una sugerencia: **Planes** ("Ya registraste el pago…"). | | |
| **Funciones** | | | | |
| 15 | "Ahora no" en la sugerencia | Desaparece y no vuelve a salir esa. | | |
| 16 | Procesos → Más funciones → Activar "Ingresos y transferencias" | Aparece en Procesos y sale el botón verde (ingreso). | | |
| 17 | Apagar "Ingresos y transferencias" | Se va de Procesos y el botón verde desaparece; los datos siguen. | | |
| **Buzón** | | | | |
| 18 | Menú de usuario → Comentarios → Escribir (con una captura) | Abre la conversación en "Recibido"; "Ver la captura" funciona. | | |
| 19 | (Admin) Bandeja | Aparece la publicación con punto de sin leer; el menú del admin tiene punto. | | |
| 20 | (Admin) Responder y pasar a "En planes" | La conversación muestra la respuesta del equipo y el estado nuevo. | | |
| 21 | (Usuario) Mirar el menú | Punto en la foto y contador en "Comentarios"; al abrir la conversación se apaga. | | |
| 22 | (Admin) "Hecho" | (Usuario) La conversación ya no deja responder: "Escribir de nuevo". | | |
| **Velocidad y teléfono** | | | | |
| 23 | Navegar por las pestañas en el teléfono | Cada toque cambia de pantalla al instante (esqueleto) y el contenido llega en menos de ~1 s. | | |
| 24 | Botones pequeños (paginación, cerrar diálogos) | Fáciles de tocar con el dedo. | | |
| 25 | Cambiar a tema claro y oscuro | Todo legible; verdes y rojos con buen contraste. | | |
| **Cuenta** | | | | |
| 26 | Cerrar sesión → "¿La olvidaste?" | Llega el correo de restablecer; el enlace deja poner una contraseña nueva. | | |
| 27 | Mi cuenta → Borrar la cuenta (`ELIMINAR` + contraseña) | La cuenta y sus datos se borran; vuelve al inicio. | | |
| **Errores** | | | | |
| 28 | Abrir `/no-existe` | Página "No encontramos esta página" con "Ir al Resumen". | | |
| 29 | (Con Sentry) Revisar Issues en sentry.io | Llegan los errores del preview, sin datos del usuario. | | |

Si algo falla: anotar el número de paso, la pantalla, el teléfono o el navegador
y, si se puede, una captura.
