# 3.0.0 · 00 — Despliegue inicial del contrato `family` (testnet)

- **Qué hace:** despliega la bóveda familiar (Constelación) en Stellar
  **testnet** con su `admin` y el SAC de USDC de testnet.
- **Por qué:** la Constelación familiar (3.0.0) guarda la familia y la bóveda
  en este contrato. Ver `docs/constelacion/plan-3.0.0.md`.
- **Cuándo:** ANTES de desplegar a Vercel el código 3.0.0 que use
  `NEXT_PUBLIC_FAMILY_CONTRACT_ID` (Fase 2 del plan). Una sola vez: después,
  solo `upgrade`.
- **Quién:** el usuario, en su terminal (Git Bash), desde la raíz del repo.
  Nunca pegues una clave `S…` ni una frase semilla en el chat ni en el repo.

## 1. Probar y compilar

```bash
cargo test -p family
stellar contract build --manifest-path contracts/family/Cargo.toml
```

## 2. Identidad admin (solo si no tienes una)

El `admin` solo puede hacer `upgrade` (no toca familias ni fondos). Conviene
una identidad del Stellar CLI, guardada en tu máquina, para poder correr los
`upgrade` desde la terminal. Respáldala fuera del repo: si se pierde, el
contrato ya no se puede actualizar.

```bash
stellar keys generate financeos-admin --network testnet --fund
stellar keys address financeos-admin
```

## 3. Desplegar

SAC de USDC (Circle) en testnet:
`CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`.

```bash
stellar contract deploy --wasm target/wasm32v1-none/release/family.wasm --source financeos-admin --network testnet --alias family -- --admin financeos-admin --usdc CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
```

Devuelve el id del contrato (`C…`). Anótalo:

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-17 |
| Contract id | `CBP3Y7EMTKUXSD3SDDC6IVM3U2KRZIO5I2XEBRGNNLO73KKTAPTN77ON` |
| Wasm hash | `34ae3b35a77ff3e6d4563619635c23508a2bfea39c87dcb7097af6b02397e6bd` |
| Admin | `GBJ5F7OIHOIJFCSWSHZDGFVZV3MLOOMJY34ITMD7RCPOZELG3EPFOHVM` (`financeos-admin`) |
| USDC (SAC) | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` (verificado con `usdc`) |

Estado: ✅ desplegado por el usuario. Verificado el 2026-10-17: el wasm
publicado (`stellar contract fetch`) tiene el mismo hash que el compilado en
el repo; todavía no hay familias (`get_family 0` → error #1, "Esa familia no
existe").

Y cárgalo en Vercel (Production y Preview) y en `.env.local` como
`NEXT_PUBLIC_FAMILY_CONTRACT_ID`.

## 4. Prueba rápida (opcional)

```bash
stellar contract invoke --id family --source financeos-admin --network testnet -- create_family --creator financeos-admin
stellar contract invoke --id family --network testnet -- get_family --family_id 0
stellar contract invoke --id family --network testnet -- usdc
```

Debe devolver la familia `0` con `financeos-admin` como núcleo (`core`) y el
SAC de USDC. Esa familia de prueba queda en el contrato (no molesta: la app
busca las familias de cada dirección con `families_of`).
