/**
 * Configuración de Stellar (2.9.0, Constelación). Solo **testnet** (K1): los
 * valores por defecto son los de testnet y cada `NEXT_PUBLIC_*` se lee por su
 * nombre literal para que Next lo reemplace en el bundle del navegador.
 */

export const STELLAR_NETWORK = "TESTNET" as const;

export const networkPassphrase =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015";

export const rpcUrl = process.env.NEXT_PUBLIC_STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";

export const horizonUrl =
  process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org";

/** USDC de Circle en testnet: emisor (trustline) y SAC (contratos). */
export const USDC = {
  code: "USDC",
  issuer:
    process.env.NEXT_PUBLIC_USDC_ISSUER || "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  sac: process.env.NEXT_PUBLIC_USDC_SAC_ID || "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
} as const;

/** Clave del saldo de USDC en Horizon (`CODE:ISSUER`). */
export const USDC_BALANCE_KEY = `${USDC.code}:${USDC.issuer}`;

/** Contrato `family` desplegado (3.0.0) (ver contracts/Versionamiento/). */
export const familyContractId = process.env.NEXT_PUBLIC_FAMILY_CONTRACT_ID?.trim() || "";

/** Cavos (wallet con correo/Google). Sin App ID solo se ofrecen extensiones. */
export const cavosAppId = process.env.NEXT_PUBLIC_CAVOS_APP_ID?.trim() || "";
export const cavosEnvironment: "development" | "production" =
  process.env.NEXT_PUBLIC_CAVOS_ENVIRONMENT === "production" ? "production" : "development";
export const isCavosConfigured = cavosAppId.length > 0;

/**
 * NUNCA cambiar después de que haya usuarios: es la sal (HKDF) de la llave de
 * la wallet de Cavos; cambiarla le da a cada usuario una wallet nueva y vacía.
 */
export const CAVOS_APP_SALT = "financeos-constelacion";

/** Stellar Expert (testnet). */
export const explorerAccount = (address: string) =>
  `https://stellar.expert/explorer/testnet/account/${address}`;
export const explorerTx = (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`;
export const explorerContract = (id: string) =>
  `https://stellar.expert/explorer/testnet/contract/${id}`;

export const friendbotUrl = (address: string) =>
  `https://friendbot.stellar.org/?addr=${encodeURIComponent(address)}`;
