/**
 * Cliente del contrato `family` (3.0.0). Se arma en tiempo de ejecución con
 * `contract.Client.from` (lee la especificación del contrato desplegado), así
 * que no hace falta generar código con Rust en Vercel. Los tipos de abajo
 * reflejan `contracts/family/src/lib.rs`: si cambia el contrato, cambian aquí.
 */

import { contract } from "@stellar/stellar-sdk";
import { familyContractId, networkPassphrase, rpcUrl } from "@/lib/stellar/env";
import type { SignTransactionFn } from "./horizon";

type Tx<T> = contract.AssembledTransaction<T>;
type R<T> = contract.Result<T>;
type Role = { tag: "Guardian"; values: void } | { tag: "Member"; values: void };

export type FamilyMember = { address: string; role: Role };
export type FamilyOnChain = {
  id: number;
  core: string;
  members: FamilyMember[];
  goal: bigint;
  balance: bigint;
  approvals_needed: number;
};
export type WithdrawalOnChain = {
  id: number;
  family_id: number;
  to: string;
  amount: bigint;
  requested_by: string;
  approvals: string[];
  required: number;
  status: { tag: "Pending" | "Executed" | "Cancelled"; values: void };
  created_at: bigint;
};

/** Métodos del contrato (los nombres y argumentos son los de Rust). */
export interface FamilyContract {
  create_family(a: { creator: string }): Promise<Tx<R<number>>>;
  add_member(a: { guardian: string; family_id: number; member: string; role: Role }): Promise<Tx<R<void>>>;
  remove_member(a: { guardian: string; family_id: number; member: string }): Promise<Tx<R<void>>>;
  leave_family(a: { member: string; family_id: number }): Promise<Tx<R<void>>>;
  set_role(a: { core: string; family_id: number; member: string; role: Role }): Promise<Tx<R<void>>>;
  set_approvals(a: { core: string; family_id: number; approvals_needed: number }): Promise<Tx<R<void>>>;
  set_goal(a: { guardian: string; family_id: number; goal: bigint }): Promise<Tx<R<void>>>;
  deposit(a: { from: string; family_id: number; amount: bigint }): Promise<Tx<R<void>>>;
  request_withdrawal(a: { member: string; family_id: number; to: string; amount: bigint }): Promise<Tx<R<number>>>;
  approve_withdrawal(a: { guardian: string; withdrawal_id: number }): Promise<Tx<R<boolean>>>;
  cancel_withdrawal(a: { caller: string; withdrawal_id: number }): Promise<Tx<R<void>>>;
  get_family(a: { family_id: number }): Promise<Tx<R<FamilyOnChain>>>;
  families_of(a: { address: string }): Promise<Tx<number[]>>;
  contribution_of(a: { family_id: number; address: string }): Promise<Tx<bigint>>;
  get_withdrawal(a: { withdrawal_id: number }): Promise<Tx<R<WithdrawalOnChain>>>;
  pending_withdrawals(a: { family_id: number }): Promise<Tx<WithdrawalOnChain[]>>;
}

export const GUARDIAN: Role = { tag: "Guardian", values: undefined };
export const MEMBER: Role = { tag: "Member", values: undefined };

export const isFamilyContractConfigured = familyContractId.length > 0;

/**
 * Cliente del contrato. Para escribir pasa la dirección y el `signTransaction`
 * de `useWallet()`; para leer basta sin nada.
 */
export function familyClient(signer?: { address: string; sign: SignTransactionFn }) {
  if (!isFamilyContractConfigured) throw new Error("Falta NEXT_PUBLIC_FAMILY_CONTRACT_ID");
  return contract.Client.from<FamilyContract>({
    contractId: familyContractId,
    networkPassphrase,
    rpcUrl,
    publicKey: signer?.address,
    signTransaction: signer?.sign,
  });
}

/** Valor de un `Result` del contrato, o lanza con su mensaje en español. */
export function unwrap<T>(result: R<T>): T {
  if (result.isErr()) throw new Error(result.unwrapErr().message || "El contrato rechazó la operación");
  return result.unwrap();
}

/** Simula → firma en la wallet → envía, y devuelve el valor (o el error del contrato). */
export async function signAndSendResult<T>(tx: Tx<R<T>>): Promise<T> {
  const sent = await tx.signAndSend();
  return unwrap(sent.result as R<T>);
}

/** Familias a las que pertenece una dirección (lectura, sin firma). */
export async function familiesOf(address: string): Promise<number[]> {
  const client = await familyClient();
  const tx = await client.families_of({ address });
  return tx.result.map(Number);
}

export async function readFamily(familyId: number): Promise<FamilyOnChain | null> {
  const client = await familyClient();
  const tx = await client.get_family({ family_id: familyId });
  return tx.result.isOk() ? tx.result.unwrap() : null;
}
