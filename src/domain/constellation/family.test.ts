import assert from "node:assert/strict";
import { test } from "node:test";
import {
  approvalBlocker,
  assertCanAddStar,
  assertCanDeposit,
  assertCanRemoveStar,
  assertCanRequestWithdrawal,
  canCancelWithdrawal,
  requiredApprovals,
  starBrightness,
  vaultProgress,
  WITHDRAWAL_TTL_SECONDS,
  type FamilyView,
  type WithdrawalView,
} from "./family.ts";
import {
  inviteExpiresAt,
  inviteState,
  isStellarAddress,
  normalizeStarLabel,
  quizScore,
} from "./directory.ts";

const U = BigInt(10_000_000); // 1 USDC
const CORE = "GCORE";
const MOM = "GMOM";
const KID = "GKID";

const fam = (over: Partial<FamilyView> = {}): FamilyView => ({
  id: 0,
  core: CORE,
  stars: [
    { address: CORE, role: "guardian" },
    { address: MOM, role: "guardian" },
    { address: KID, role: "member" },
  ],
  goal: BigInt(500) * U,
  balance: BigInt(100) * U,
  approvalsNeeded: 1,
  ...over,
});

test("K4/D5: aprobaciones requeridas", () => {
  assert.equal(requiredApprovals(fam(), KID), 1);
  assert.equal(requiredApprovals(fam({ approvalsNeeded: 5 }), KID), 2); // solo 2 guardianes
  assert.equal(requiredApprovals(fam({ approvalsNeeded: 5 }), CORE), 1);
  const alone = fam({ stars: [{ address: CORE, role: "guardian" }] });
  assert.equal(requiredApprovals(alone, CORE), 0); // núcleo solo: directo
});

test("K6: agregar y quitar estrellas", () => {
  assertCanAddStar(fam(), MOM, "GNEW", "member");
  assert.throws(() => assertCanAddStar(fam(), MOM, "GNEW", "guardian"), /núcleo nombra/);
  assert.throws(() => assertCanAddStar(fam(), KID, "GNEW", "member"), /Solo un guardián/);
  assert.throws(() => assertCanAddStar(fam(), CORE, KID, "member"), /ya es parte/);
  assertCanRemoveStar(fam(), MOM, KID);
  assertCanRemoveStar(fam(), KID, KID); // salirse
  assert.throws(() => assertCanRemoveStar(fam(), MOM, CORE), /núcleo no se puede/);
  assert.throws(() => assertCanRemoveStar(fam({ stars: [...fam().stars, { address: "GG2", role: "guardian" }] }), MOM, "GG2"), /núcleo quita/);
});

test("K3/K4/K5: depósitos y pedidos de retiro", () => {
  assertCanDeposit(fam(), KID, U);
  assert.throws(() => assertCanDeposit(fam(), "GSTRANGER", U), /Solo una estrella/);
  assert.throws(() => assertCanDeposit(fam(), KID, BigInt(0)), /mayor que 0/);

  assertCanRequestWithdrawal(fam(), { requester: KID, to: KID, amount: U, pending: 0 });
  assert.throws(
    () => assertCanRequestWithdrawal(fam(), { requester: KID, to: "GSCAM", amount: U, pending: 0 }),
    /estrella de la familia/,
  );
  assert.throws(
    () => assertCanRequestWithdrawal(fam(), { requester: KID, to: KID, amount: BigInt(101) * U, pending: 0 }),
    /saldo/,
  );
  assert.throws(
    () => assertCanRequestWithdrawal(fam(), { requester: KID, to: KID, amount: U, pending: 10 }),
    /pendientes/,
  );
});

test("K4/K7: quién aprueba y quién cancela", () => {
  const w: WithdrawalView = {
    id: 1,
    familyId: 0,
    to: KID,
    amount: U,
    requestedBy: KID,
    approvals: [],
    required: 1,
    status: "pending",
    createdAt: 1_000,
  };
  assert.equal(approvalBlocker(fam(), w, MOM, 1_000), null);
  assert.match(approvalBlocker(fam(), w, KID, 1_000)!, /Solo un guardián/);
  assert.match(approvalBlocker(fam(), { ...w, requestedBy: MOM }, MOM, 1_000)!, /propio/);
  assert.match(approvalBlocker(fam(), { ...w, approvals: [MOM] }, MOM, 1_000)!, /Ya aprobaste/);
  assert.match(approvalBlocker(fam(), w, MOM, 1_000 + WITHDRAWAL_TTL_SECONDS + 1)!, /venció/);
  assert.match(approvalBlocker(fam({ balance: BigInt(0) }), w, MOM, 1_000)!, /saldo/);
  assert.equal(canCancelWithdrawal(fam(), w, KID), true);
  assert.equal(canCancelWithdrawal(fam(), w, MOM), true);
  assert.equal(canCancelWithdrawal(fam(), w, "GSTRANGER"), false);
});

test("meta y brillo", () => {
  assert.equal(vaultProgress(fam()), 0.2);
  assert.equal(vaultProgress(fam({ goal: BigInt(0) })), null);
  assert.equal(vaultProgress(fam({ balance: BigInt(900) * U })), 1);
  assert.deepEqual(starBrightness({ a: BigInt(100), b: BigInt(50), c: BigInt(0) }), { a: 1, b: 0.625, c: 0.25 });
  assert.deepEqual(starBrightness({ a: BigInt(0) }), { a: 0.25 });
});

test("K2: directorio, invitaciones y academia", () => {
  const g = "G" + "A".repeat(55);
  assert.equal(isStellarAddress(g), true);
  assert.equal(isStellarAddress("GABC"), false);
  assert.deepEqual(
    normalizeStarLabel({ address: ` ${g} `, nickname: " Mamá ", emoji: "", relationship: " Mamá ", member_id: null }),
    { address: g, nickname: "Mamá", emoji: null, relationship: "Mamá", member_id: null },
  );
  assert.throws(() => normalizeStarLabel({ address: g, nickname: " ", emoji: null, relationship: null, member_id: null }), /apodo/);
  assert.throws(() => normalizeStarLabel({ address: "GX", nickname: "x", emoji: null, relationship: null, member_id: null }), /no es válida/);

  const now = new Date("2026-10-17T12:00:00Z");
  const exp = inviteExpiresAt(now).toISOString();
  assert.equal(exp, "2026-10-20T12:00:00.000Z");
  const base = { expires_at: exp, redeemed_at: null, added_at: null, revoked: false };
  assert.equal(inviteState(base, now), "pending");
  assert.equal(inviteState(base, new Date("2026-10-21T00:00:00Z")), "expired");
  assert.equal(inviteState({ ...base, redeemed_at: exp }, now), "redeemed");
  assert.equal(inviteState({ ...base, redeemed_at: exp, added_at: exp }, now), "added");
  assert.equal(inviteState({ ...base, revoked: true }, now), "revoked");

  assert.equal(quizScore(2, 3), 67);
  assert.throws(() => quizScore(4, 3), /inválido/);
});
