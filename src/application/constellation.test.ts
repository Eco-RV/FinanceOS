import assert from "node:assert/strict";
import { test } from "node:test";
import type { AcademyLesson } from "../domain/index.ts";
import {
  completeLesson,
  createFamilyInvite,
  deleteStar,
  linkWallet,
  markFamilyInviteAdded,
  redeemFamilyInvite,
  revokeFamilyInvite,
  saveStar,
} from "./constellation.ts";
import {
  InfrastructureError,
  type AcademyRepository,
  type FamilyInvite,
  type FamilyInviteRepository,
  type LinkedWallet,
  type NewFamilyInvite,
  type StarDirectoryRepository,
  type StarLabel,
  type WalletLinkRepository,
} from "./ports.ts";

const G1 = "G" + "A".repeat(55);
const G2 = "G" + "B".repeat(55);

function fakes() {
  let wallet: LinkedWallet | null = null;
  const wallets: WalletLinkRepository = {
    current: async () => wallet,
    link: async (w) => {
      wallet = w;
    },
    unlink: async () => {
      wallet = null;
    },
  };
  const stars = new Map<string, StarLabel>();
  const directory: StarDirectoryRepository = {
    list: async () => [...stars.values()],
    save: async (id, fields) => {
      if ([...stars.values()].some((s) => s.address === fields.address && s.id !== id)) {
        throw new InfrastructureError("Esa dirección ya está en tu constelación");
      }
      const key = id ?? `s${stars.size + 1}`;
      stars.set(key, { ...fields, id: key });
      return { id: key };
    },
    delete: async (id) => {
      stars.delete(id);
    },
  };
  const invites = new Map<string, FamilyInvite & { token_hash: string }>();
  const inviteRepo: FamilyInviteRepository = {
    create: async (i: NewFamilyInvite) => {
      const id = `i${invites.size + 1}`;
      invites.set(id, { ...i, id, redeemed_address: null, redeemed_at: null, added_at: null, revoked: false });
      return { id };
    },
    listMine: async () => [...invites.values()],
    find: async (id) => invites.get(id) ?? null,
    revoke: async (id) => {
      invites.get(id)!.revoked = true;
    },
    markAdded: async (id) => {
      invites.get(id)!.added_at = "2026-10-17T00:00:00Z";
    },
    redeem: async (token, address) => {
      const inv = [...invites.values()].find((i) => i.token_hash === `hash:${token}`);
      if (!inv || inv.revoked || inv.redeemed_at) throw new InfrastructureError("Invitación inválida o usada");
      inv.redeemed_address = address;
      inv.redeemed_at = "2026-10-17T00:00:00Z";
      return { family_id: inv.family_id, role: inv.role };
    },
  };
  let n = 0;
  const tokens = { newToken: () => ({ token: `token-${++n}-xxxxxxxxxxxx`, hash: `hash:token-${n}-xxxxxxxxxxxx` }) };
  const progress = new Map<AcademyLesson, number>();
  const academy: AcademyRepository = {
    list: async () => [...progress].map(([lesson, score]) => ({ lesson, score, completed_at: "" })),
    record: async (lesson, score) => {
      progress.set(lesson, Math.max(score, progress.get(lesson) ?? 0));
    },
  };
  return { wallets, directory, stars, inviteRepo, invites, tokens, academy, progress, wallet: () => wallet };
}

test("ligar la wallet valida la dirección", async () => {
  const f = fakes();
  assert.ok((await linkWallet(f.wallets, { address: ` ${G1} `, connector: "cavos" })).ok);
  assert.deepEqual(f.wallet(), { address: G1, connector: "cavos" });
  const bad = await linkWallet(f.wallets, { address: "GX", connector: "cavos" });
  assert.equal(!bad.ok && bad.rule, "K2");
});

test("K2/D3: agenda de estrellas", async () => {
  const f = fakes();
  const r = await saveStar(f.directory, {
    id: null,
    fields: { address: G1, nickname: " Mamá ", emoji: "🌟", relationship: "Mamá", member_id: null },
  });
  assert.ok(r.ok);
  assert.equal(f.stars.get(r.value.id)?.nickname, "Mamá");
  const dup = await saveStar(f.directory, {
    id: null,
    fields: { address: G1, nickname: "Otra", emoji: null, relationship: null, member_id: null },
  });
  assert.equal(dup.ok, false);
  assert.ok((await deleteStar(f.directory, r.value.id)).ok);
  assert.equal(f.stars.size, 0);
});

test("D2: invitar, canjear con la wallet y marcar agregada", async () => {
  const f = fakes();
  const inv = await createFamilyInvite(
    { invites: f.inviteRepo, tokens: f.tokens },
    { familyId: 0, role: "member", now: new Date("2026-10-17T12:00:00Z") },
  );
  assert.ok(inv.ok);
  assert.equal(inv.value.expiresAt, "2026-10-20T12:00:00.000Z");
  // Solo se guarda el hash.
  assert.equal(f.invites.get(inv.value.id)?.token_hash, `hash:${inv.value.token}`);

  assert.equal((await markFamilyInviteAdded(f.inviteRepo, inv.value.id)).ok, false); // sin canjear
  const redeemed = await redeemFamilyInvite(f.inviteRepo, { token: inv.value.token, address: G2 });
  assert.ok(redeemed.ok);
  assert.deepEqual(redeemed.value, { family_id: 0, role: "member" });
  assert.equal((await redeemFamilyInvite(f.inviteRepo, { token: inv.value.token, address: G2 })).ok, false);

  assert.ok((await markFamilyInviteAdded(f.inviteRepo, inv.value.id)).ok);
  assert.equal((await revokeFamilyInvite(f.inviteRepo, inv.value.id)).ok, false); // ya usada

  const bad = await createFamilyInvite(
    { invites: f.inviteRepo, tokens: f.tokens },
    { familyId: -1, role: "member", now: new Date() },
  );
  assert.equal(bad.ok, false);
  assert.equal((await redeemFamilyInvite(f.inviteRepo, { token: "corto", address: G2 })).ok, false);
});

test("Academia: se guarda el mejor puntaje", async () => {
  const f = fakes();
  const r = await completeLesson(f.academy, { lesson: "wallet", correct: 2, total: 3 });
  assert.ok(r.ok);
  assert.equal(r.value.score, 67);
  await completeLesson(f.academy, { lesson: "wallet", correct: 1, total: 3 });
  assert.equal(f.progress.get("wallet"), 67);
  assert.equal((await completeLesson(f.academy, { lesson: "nada", correct: 1, total: 1 })).ok, false);
});
