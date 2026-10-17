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

## Reglas de negocio

- K1, K2, K8–K10 en [`docs/dominio/reglas.md`](../dominio/reglas.md).
- La Constelación **no toca el libro**: su dinero vive en la cadena.

## Pendiente / fuera de alcance

- 3.0.0: familia (constelación), bóveda con aprobaciones (contrato `family`),
  apoyos (Trustless Work) y academia.
- Mainnet.

## Historial

- **2026-10-17 (v2.9.0, en desarrollo)** — Archivo nuevo: wallet y Mi bolsillo
  (enviar y recibir USDC de persona a persona).
