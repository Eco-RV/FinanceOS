# Constelación (Stellar)

> Ver convención general en [`README.md`](./README.md).

## Resumen

Bolsillo de dólares digitales (**USDC**) sobre **Stellar testnet**: cada
persona tiene su propia wallet, envía y recibe de persona a persona. Vive en la
pestaña **Constelación** (antes Trading). La familia, la bóveda con
aprobaciones, los apoyos y la academia llegan en la 3.0.0.

## Historias de usuario

### 1. Tener mi bolsillo de dólares
Como usuario quiero entrar con mi correo o Google y tener una wallet con USDC,
para ahorrar en dólares sin instalar nada.

**Criterios de aceptación**
- En **Constelación**: "Entrar con correo o Google" (Cavos) o "Usar una wallet
  de extensión". Solo el hub inicia sesión; Mi bolsillo manda ahí si no hay
  wallet.
- Una wallet nueva recibe sola XLM de prueba (Friendbot). Después: "Abrir mi
  bolsillo de dólares" (trustline) y "Conseguir USDC de prueba" (cambio de 100
  XLM en el DEX, o el faucet de Circle).
- Se ve el saldo en USDC grande y su equivalente aproximado en colones con el
  último tipo de cambio de Ajustes, más el XLM para comisiones y un enlace al
  explorador.
- **Recibir**: QR con mi dirección y botón copiar.
- Desconectar desde la barra de la wallet.

### 2. Enviar dinero a otra persona
Como usuario quiero enviar USDC a otra persona sin miedo a equivocarme.

**Criterios de aceptación**
- Escribo la dirección (`G…`) y el monto; se rechaza una dirección inválida,
  la mía, más de 7 decimales o más que mi saldo.
- Pantalla de revisión: "Vas a enviar $X a GABC…WXYZ", la dirección completa,
  aviso de que no está en mi constelación (K9) y "No se puede deshacer" (K8).
- Firmo en mi wallet; al confirmarse, confirmación animada y el saldo se
  actualiza.
- Si el destino no abrió su bolsillo de USDC o no existe, el error lo explica
  en español.

> **3.0.0 (en construcción):** las historias 3 a 8 son de la Constelación
> familiar. El contrato `family` ya está escrito, probado y desplegado en
> testnet (historias 4–6 en la cadena); las pantallas vienen en las fases
> siguientes de `docs/constelacion/plan-3.0.0.md`.

### 3. Armar mi constelación
Como núcleo quiero crear la familia e invitar a los míos.

**Criterios de aceptación**
- Crear la familia me deja como **núcleo** (guardián que no sale ni se
  quita, K6).
- Invito con un enlace; quien lo abre inicia sesión o se registra en Finance
  OS, conecta su wallet y queda su dirección; después la agrego a la familia
  (firma mía) como miembro o guardián.
- Apodo, emoji y parentesco los guardo yo en Finance OS; **nunca** van a la
  cadena (K2). Cada usuario pone sus propios apodos.
- Máximo 12 estrellas por familia.

### 4. Ahorrar juntos en la bóveda
Como estrella quiero depositar en la bóveda familiar y ver el avance hacia la
meta.

**Criterios de aceptación**
- Solo una estrella de la familia deposita; monto mayor que 0 (K3).
- La bóveda muestra saldo, meta, avance y cuánto aportó cada estrella (en la
  constelación, el brillo de cada estrella).
- Un guardián fija la meta.

### 5. Pedir y aprobar un retiro
Como estrella quiero sacar dinero de la bóveda con la aprobación de otro
guardián, para que nadie (ni un estafador) la vacíe solo.

**Criterios de aceptación**
- Pido un retiro hacia una estrella de la familia (K5) por un monto que la
  bóveda tiene.
- Lo aprueban guardianes distintos de quien pide (K4); con las aprobaciones
  necesarias se ejecuta y el USDC llega al destino. Si el núcleo pide y es el
  único guardián, se ejecuta directo.
- Un pedido vence a los 7 días; lo cancela quien pidió o un guardián (K7).
- Lista de retiros pendientes con quién pidió, a dónde y cuánto.

### 6. Administrar la familia
Como núcleo quiero cambiar roles y sacar a alguien si hace falta.

**Criterios de aceptación**
- Solo el núcleo nombra o quita guardianes, cambia roles y fija cuántas aprobaciones
  pide un retiro (mínimo 1). Cualquier guardián agrega y quita
  miembros (K6).
- Una estrella (que no sea el núcleo) puede salirse sola.

### 7. Pagar con condición (apoyo)
Como estrella quiero aportar a un pago que solo se libera cuando se cumple lo
acordado (p. ej. la matrícula).

**Criterios de aceptación**
- Pago con destino (escrow single-release de Trustless Work): aportan una o
  varias estrellas; un guardián aprueba y libera hacia quien recibe.
- Comisión de plataforma 0 % en testnet (D9).

### 8. Aprender
Como estrella quiero entender qué es una wallet, la blockchain y USDC con
palabras sencillas.

**Criterios de aceptación**
- Cinco lecciones cortas con mini-quiz: wallet, blockchain, USDC, enviar sin
  miedo, la bóveda familiar. Progreso guardado en Finance OS.
- Interruptor de **letra grande** en Preferencias.

## Reglas de negocio

- K1–K10 en [`docs/dominio/reglas.md`](../dominio/reglas.md).
- La Constelación **no toca el libro**: su dinero vive en la cadena.

## Pendiente / fuera de alcance

- 3.1.0: apoyos por hitos (mesada) y meta con fecha.
- Mainnet.

## Historial

- **2026-10-17 (v2.9.0, en desarrollo)** — Archivo nuevo: wallet y Mi bolsillo
  (enviar y recibir USDC de persona a persona).
- **2026-10-17 (v3.0.0, en desarrollo)** — Historias 3–8 (familia, bóveda,
  retiros, administración, apoyos y academia); contrato `family` desplegado.
- **2026-10-17 (v3.0.0, en desarrollo)** — Fases 3 y 4: dominio, casos de uso y tablas de Supabase (wallet ligada, agenda, invitaciones y Academia).
