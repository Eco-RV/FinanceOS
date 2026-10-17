# Versionamiento de contratos (Soroban)

El equivalente de `supabase/Versionamiento/` para los contratos de Stellar:
deja por escrito **qué se hizo en cada contrato, en qué orden y cuándo**, por
versión de la app. Copiado del flujo de AstrOS.

```
contracts/
  family/                 crate del contrato (src/lib.rs, src/test.rs)
  Versionamiento/
    3.0.0/
      00_despliegue_family_testnet.md
```

## Contratos por entorno (D10)

| Entorno | Dónde se usa | `family` |
| --- | --- | --- |
| `development` | local (`npm run dev`) | se redespliega libre; datos desechables |
| `testnet` (fijo) | Vercel `main` y `dev_main` (`NEXT_PUBLIC_FAMILY_CONTRACT_ID`) | `CBP3Y7EMTKUXSD3SDDC6IVM3U2KRZIO5I2XEBRGNNLO73KKTAPTN77ON` (3.0.0) |

Todo en **testnet** (K1). El `admin` (el único que puede hacer `upgrade`) es
una identidad del usuario en su Stellar CLI. **El agente nunca ve ni maneja
claves `S…`**: el usuario corre el despliegue y los `upgrade`.

## Reglas

1. **Todo cambio en un contrato desplegado** (upgrade, migración, llamada de
   configuración) va en la carpeta de la versión en desarrollo. Una carpeta
   publicada no se vuelve a tocar.
2. Archivos `NN_descripcion.md` (`00_`, `01_`, …) en orden de ejecución. Cada
   uno dice versión, qué hace, por qué y **cuándo correrlo**.
3. **Nunca redesplegar** el contrato fijo: un despliegue nuevo es una bóveda
   vacía con otro id (y los fondos de la anterior quedan allá). El código se
   cambia con `upgrade`; los datos se quedan.
4. **Compatibilidad del almacenamiento**: no cambies un `#[contracttype]` ya
   guardado (`Family`, `Member`, `Withdrawal`, `Role`, `DataKey`…). Para datos
   nuevos, variantes nuevas de `DataKey` o tipos `…V2`; una función con firma
   nueva se crea con otro nombre (`deposit_v2`) y la vieja se borra en la
   versión siguiente.
5. Antes de cualquier despliegue que guarde valor: `cargo test -p family`,
   `cargo clippy -p family --all-targets` sin avisos y el checklist de
   seguridad de la skill `soroban-contracts`. **Mainnet requiere auditoría.**

## Plantilla: upgrade

```bash
stellar contract build --manifest-path contracts/family/Cargo.toml
stellar contract upload --wasm target/wasm32v1-none/release/family.wasm --source <identidad-admin> --network testnet
stellar contract invoke --id <CONTRACT_ID> --source <identidad-admin> --network testnet -- upgrade --new_wasm_hash <HASH>
```
