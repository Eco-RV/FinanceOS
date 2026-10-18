/**
 * Constelación familiar (3.0.0): espejo en el dominio de las reglas K3–K7 del
 * contrato `family`. El contrato es quien decide; esto sirve para avisar
 * ANTES de pedir una firma (botones que no aplican, mensajes claros) y para
 * calcular lo que se muestra (avance de la meta, brillo de cada estrella).
 * Montos en unidades de 7 decimales (`bigint`, K10).
 */

import { DomainError } from "../shared/errors.ts";

export const MAX_STARS = 12;
export const MAX_FAMILIES_PER_ADDRESS = 5;
export const MAX_PENDING_WITHDRAWALS = 10;
/** K7: un retiro pendiente vence a los 7 días (en segundos). */
export const WITHDRAWAL_TTL_SECONDS = 7 * 24 * 60 * 60;

export type StarRole = "guardian" | "member";

export type FamilyStar = { address: string; role: StarRole };

export type FamilyView = {
  id: number;
  core: string;
  stars: FamilyStar[];
  goal: bigint;
  balance: bigint;
  approvalsNeeded: number;
};

export type WithdrawalStatus = "pending" | "executed" | "cancelled";

export type WithdrawalView = {
  id: number;
  familyId: number;
  to: string;
  amount: bigint;
  requestedBy: string;
  approvals: string[];
  required: number;
  status: WithdrawalStatus;
  /** Unix segundos. */
  createdAt: number;
};

export function roleOf(family: FamilyView, address: string): StarRole | null {
  return family.stars.find((s) => s.address === address)?.role ?? null;
}

export function isCore(family: FamilyView, address: string): boolean {
  return family.core === address;
}

export function isGuardian(family: FamilyView, address: string): boolean {
  return roleOf(family, address) === "guardian";
}

/** K4: guardianes que pueden aprobar un retiro de `requester` (todos menos él). */
export function eligibleApprovers(family: FamilyView, requester: string): number {
  return family.stars.filter((s) => s.role === "guardian" && s.address !== requester).length;
}

/** K4 + D5: aprobaciones que pedirá un retiro; 0 = se ejecuta directo. */
export function requiredApprovals(family: FamilyView, requester: string): number {
  return Math.min(Math.max(1, family.approvalsNeeded), eligibleApprovers(family, requester));
}

/** K6: quién puede agregar a alguien con qué rol. */
export function assertCanAddStar(family: FamilyView, by: string, newcomer: string, role: StarRole): void {
  if (!isGuardian(family, by)) throw new DomainError("K6", "Solo un guardián agrega estrellas");
  if (role === "guardian" && !isCore(family, by)) {
    throw new DomainError("K6", "Solo el núcleo nombra guardianes");
  }
  if (roleOf(family, newcomer)) throw new DomainError("K6", "Esa dirección ya es parte de la familia");
  if (family.stars.length >= MAX_STARS) {
    throw new DomainError("K6", `La familia ya tiene el máximo de ${MAX_STARS} estrellas`);
  }
}

/** K6: quitar a alguien. */
export function assertCanRemoveStar(family: FamilyView, by: string, star: string): void {
  if (isCore(family, star)) throw new DomainError("K6", "El núcleo no se puede quitar");
  const role = roleOf(family, star);
  if (!role) throw new DomainError("K6", "Esa dirección no es parte de la familia");
  if (by === star) return; // salirse
  if (!isGuardian(family, by)) throw new DomainError("K6", "Solo un guardián quita estrellas");
  if (role === "guardian" && !isCore(family, by)) {
    throw new DomainError("K6", "Solo el núcleo quita guardianes");
  }
}

/** K3: depositar en la bóveda. */
export function assertCanDeposit(family: FamilyView, from: string, amount: bigint): void {
  if (!roleOf(family, from)) throw new DomainError("K3", "Solo una estrella de la familia deposita");
  if (amount <= BigInt(0)) throw new DomainError("K3", "El monto debe ser mayor que 0");
}

/** K4/K5/K7: pedir un retiro. */
export function assertCanRequestWithdrawal(
  family: FamilyView,
  input: { requester: string; to: string; amount: bigint; pending: number },
): void {
  if (!roleOf(family, input.requester)) throw new DomainError("K4", "Solo una estrella de la familia pide retiros");
  if (!roleOf(family, input.to)) {
    throw new DomainError("K5", "El retiro solo puede ir a una estrella de la familia");
  }
  if (input.amount <= BigInt(0)) throw new DomainError("K4", "El monto debe ser mayor que 0");
  if (input.amount > family.balance) throw new DomainError("K4", "La bóveda no tiene saldo suficiente");
  if (requiredApprovals(family, input.requester) > 0 && input.pending >= MAX_PENDING_WITHDRAWALS) {
    throw new DomainError("K7", "Hay demasiados retiros pendientes: resuelve alguno primero");
  }
}

export function isExpired(w: WithdrawalView, nowSeconds: number): boolean {
  return nowSeconds > w.createdAt + WITHDRAWAL_TTL_SECONDS;
}

/** K4/K7: ¿puede `guardian` aprobar este retiro ahora? `null` = sí; si no, por qué. */
export function approvalBlocker(
  family: FamilyView,
  w: WithdrawalView,
  guardian: string,
  nowSeconds: number,
): string | null {
  if (w.status !== "pending") return "Ese retiro ya se resolvió";
  if (!isGuardian(family, guardian)) return "Solo un guardián aprueba retiros";
  if (guardian === w.requestedBy) return "No puedes aprobar tu propio retiro";
  if (w.approvals.includes(guardian)) return "Ya aprobaste este retiro";
  if (isExpired(w, nowSeconds)) return "Este retiro venció: pide uno nuevo";
  if (w.amount > family.balance) return "La bóveda ya no tiene saldo para este retiro";
  return null;
}

/** K7: cancela quien pidió o un guardián. */
export function canCancelWithdrawal(family: FamilyView, w: WithdrawalView, caller: string): boolean {
  return w.status === "pending" && (caller === w.requestedBy || isGuardian(family, caller));
}

/** Avance de la meta de la bóveda (0..1); `null` sin meta. */
export function vaultProgress(family: Pick<FamilyView, "goal" | "balance">): number | null {
  if (family.goal <= BigInt(0)) return null;
  const ratio = Number((family.balance * BigInt(10_000)) / family.goal) / 10_000;
  return Math.max(0, Math.min(1, ratio));
}

/**
 * Brillo de cada estrella en la constelación (0.25..1): proporcional a lo que
 * aportó a la bóveda frente a quien más aportó. Sin aportes, brillo mínimo.
 */
export function starBrightness(contributions: Record<string, bigint>): Record<string, number> {
  const values = Object.values(contributions);
  const max = values.reduce((m, v) => (v > m ? v : m), BigInt(0));
  const out: Record<string, number> = {};
  for (const [address, value] of Object.entries(contributions)) {
    out[address] = max > BigInt(0) ? 0.25 + 0.75 * (Number((value * BigInt(1000)) / max) / 1000) : 0.25;
  }
  return out;
}
