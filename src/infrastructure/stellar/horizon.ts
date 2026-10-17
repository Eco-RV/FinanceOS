/**
 * Operaciones clásicas de Stellar (2.9.0, Constelación): saldos, fondeo de
 * testnet, trustline de USDC, cambio XLM→USDC y pagos de USDC. Corren en el
 * navegador: `sign` es `useWallet().signTransaction` (Cavos o extensión). El
 * servidor de Finance OS nunca tiene llaves.
 */

import { Asset, BASE_FEE, Horizon, Operation, StrKey, TransactionBuilder } from "@stellar/stellar-sdk";
import { friendbotUrl, horizonUrl, networkPassphrase, USDC, USDC_BALANCE_KEY } from "@/lib/stellar/env";

/** Misma forma que el `signTransaction` de Stellar Wallets Kit y de Cavos. */
export type SignTransactionFn = (
  xdr: string,
  opts?: { networkPassphrase?: string; address?: string },
) => Promise<{ signedTxXdr: string; signerAddress?: string }>;

export const horizon = new Horizon.Server(horizonUrl);
const usdcAsset = new Asset(USDC.code, USDC.issuer);

export type WalletBalances = {
  /** La cuenta existe en la red (recibió XLM). */
  exists: boolean;
  xlm: string | null;
  /** `null` = sin trustline de USDC (no puede recibir USDC). */
  usdc: string | null;
};

const EMPTY: WalletBalances = { exists: false, xlm: null, usdc: null };

export async function fetchBalances(address: string): Promise<WalletBalances> {
  try {
    const { balances } = await horizon.accounts().accountId(address).call();
    let xlm: string | null = null;
    let usdc: string | null = null;
    for (const b of balances) {
      if (b.asset_type === "native") xlm = b.balance;
      else if ("asset_code" in b && `${b.asset_code}:${b.asset_issuer}` === USDC_BALANCE_KEY) usdc = b.balance;
    }
    return { exists: true, xlm, usdc };
  } catch (e) {
    // "Not Found" = cuenta todavía sin fondear (esperado en una wallet nueva).
    if (!(e instanceof Error && /not found/i.test(e.message))) console.error(e);
    return EMPTY;
  }
}

/** Testnet: 10 000 XLM de prueba. Friendbot rechaza cuentas que ya existen. */
export async function fundWithFriendbot(address: string): Promise<boolean> {
  try {
    const res = await fetch(friendbotUrl(address));
    return res.ok;
  } catch {
    return false;
  }
}

async function signAndSubmit(
  address: string,
  sign: SignTransactionFn,
  build: (b: TransactionBuilder) => TransactionBuilder,
) {
  const account = await horizon.loadAccount(address);
  const tx = build(new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase }))
    .setTimeout(120)
    .build();
  const { signedTxXdr } = await sign(tx.toXDR(), { address, networkPassphrase });
  return horizon.submitTransaction(TransactionBuilder.fromXDR(signedTxXdr, networkPassphrase));
}

/** "Abrir el bolsillo de dólares": trustline de USDC (reserva de 0,5 XLM). */
export function addUsdcTrustline(address: string, sign: SignTransactionFn) {
  return signAndSubmit(address, sign, (b) => b.addOperation(Operation.changeTrust({ asset: usdcAsset })));
}

/**
 * TESTNET: cambia XLM de prueba por USDC en el DEX (pago de ruta a uno mismo,
 * 5 % de tolerancia). El faucet de Circle da poco y con espera.
 */
export async function swapXlmForUsdc(address: string, sign: SignTransactionFn, xlmAmount = "100") {
  const { records } = await horizon.strictSendPaths(Asset.native(), xlmAmount, [usdcAsset]).call();
  const best = records[0];
  if (!best) throw new Error("Ahora no hay liquidez XLM→USDC en el DEX de testnet. Prueba el faucet de Circle.");
  const destMin = (Number(best.destination_amount) * 0.95).toFixed(7);
  return signAndSubmit(address, sign, (b) =>
    b.addOperation(
      Operation.pathPaymentStrictSend({
        sendAsset: Asset.native(),
        sendAmount: xlmAmount,
        destination: address,
        destAsset: usdcAsset,
        destMin,
        path: best.path.map((p) =>
          p.asset_type === "native" ? Asset.native() : new Asset(p.asset_code as string, p.asset_issuer as string),
        ),
      }),
    ),
  );
}

/** Dirección `G…` válida (cuenta clásica). */
export function isAccountAddress(address: string): boolean {
  return StrKey.isValidEd25519PublicKey(address.trim());
}

/**
 * Envía USDC (pago clásico). `amount` con hasta 7 decimales ("10.5000000").
 * El destino debe existir y tener trustline de USDC; si no, la red lo rechaza
 * (`op_no_trust`, `op_no_destination`) y se explica con `explainStellarError`.
 */
export function sendUsdc(from: string, to: string, amount: string, sign: SignTransactionFn) {
  return signAndSubmit(from, sign, (b) =>
    b.addOperation(Operation.payment({ destination: to.trim(), asset: usdcAsset, amount })),
  );
}

/** Mensaje en español para los errores comunes de Horizon y de la wallet. */
export function explainStellarError(e: unknown): string {
  const raw = JSON.stringify(
    (e as { response?: { data?: unknown } })?.response?.data ?? (e instanceof Error ? e.message : e),
  );
  if (/rejected|denied|cancel/i.test(raw)) return "Cancelaste la firma en tu wallet.";
  if (/policy does not allow/i.test(raw)) return "Tu wallet no permite esta operación (límites de la app).";
  if (/op_no_trust/.test(raw)) return "Esa cuenta todavía no abrió su bolsillo de USDC (trustline).";
  if (/op_no_destination/.test(raw)) return "Esa cuenta todavía no existe en la red.";
  if (/op_underfunded|insufficient/i.test(raw)) return "No te alcanza el saldo.";
  if (/op_low_reserve/.test(raw)) return "Te falta XLM para la reserva mínima.";
  if (/tx_bad_seq/.test(raw)) return "La transacción quedó vieja: inténtalo de nuevo.";
  if (/network/i.test(raw) && /mismatch|wrong/i.test(raw)) return "Tu wallet está en otra red: cámbiala a Testnet.";
  return "No se pudo completar la operación en Stellar.";
}
