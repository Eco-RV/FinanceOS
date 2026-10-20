import assert from "node:assert/strict";
import { test } from "node:test";
import type { ProfileFields } from "../domain/index.ts";
import {
  InfrastructureError,
  type AvatarStorage,
  type IdentityService,
  type Profile,
  type ProfileRepository,
} from "./ports.ts";
import {
  changeEmail,
  changePassword,
  deleteAccount,
  removeAvatar,
  savePreferences,
  saveProfile,
  updateAvatar,
} from "./profile.ts";

function fakes(opts: { password?: string; email?: string; takenUsernames?: string[]; recovery?: boolean } = {}) {
  let profile: Profile | null = null;
  const calls = { password: null as string | null, email: null as string | null, removed: 0, deleted: false };
  const profiles: ProfileRepository = {
    async get() {
      return profile;
    },
    async save(fields: ProfileFields) {
      if (fields.username && opts.takenUsernames?.includes(fields.username)) {
        throw new InfrastructureError("Ese usuario ya está en uso");
      }
      profile = { avatar_url: null, preferences: {}, ...profile, ...fields };
    },
    async setAvatarUrl(url) {
      profile = { full_name: null, username: null, country: null, preferences: {}, ...profile, avatar_url: url };
    },
    async savePreferences(p) {
      profile = {
        full_name: null,
        username: null,
        country: null,
        avatar_url: null,
        ...profile,
        preferences: { ...(profile?.preferences ?? {}), ...p },
      };
    },
  };
  const identity: IdentityService = {
    async email() {
      return opts.email ?? "yo@correo.com";
    },
    async verifyPassword(p) {
      return p === (opts.password ?? "actual123");
    },
    async changePassword(next) {
      calls.password = next;
    },
    async isRecoverySession() {
      return opts.recovery ?? false;
    },
    async changeEmail(next) {
      calls.email = next;
    },
    async deleteAccount() {
      calls.deleted = true;
    },
  };
  const storage: AvatarStorage = {
    async upload() {
      return "https://cdn/avatars/u1/avatar.webp";
    },
    async remove() {
      calls.removed++;
    },
  };
  return { profiles, identity, storage, calls, current: () => profile };
}

test("saveProfile normaliza y guarda; un usuario repetido es un mensaje", async () => {
  const f = fakes({ takenUsernames: ["ana"] });
  const r = await saveProfile(f.profiles, { full_name: " Oswald ", username: "@Oswald", country: "cr" });
  assert.ok(r.ok);
  assert.equal(f.current()?.username, "oswald");
  assert.equal(f.current()?.country, "CR");

  const taken = await saveProfile(f.profiles, { full_name: null, username: "ana", country: null });
  assert.deepEqual(taken, { ok: false, message: "Ese usuario ya está en uso", rule: undefined });

  const bad = await saveProfile(f.profiles, { full_name: null, username: "a", country: null });
  assert.equal(bad.ok, false);
  assert.equal(!bad.ok && bad.rule, "U1");
});

test("changePassword exige la actual correcta, salvo al restablecer", async () => {
  const f = fakes({ recovery: true });
  const wrong = await changePassword(f.identity, { current: "otra1234", next: "nueva2026" });
  assert.equal(wrong.ok, false);
  assert.equal(f.calls.password, null);

  assert.ok((await changePassword(f.identity, { current: "actual123", next: "nueva2026" })).ok);
  assert.equal(f.calls.password, "nueva2026");

  assert.ok((await changePassword(f.identity, { current: null, next: "desdecorreo1" })).ok);
  assert.equal(f.calls.password, "desdecorreo1");

  const weak = await changePassword(f.identity, { current: "actual123", next: "corta" });
  assert.equal(!weak.ok && weak.rule, "U4");
});

test("changeEmail valida y pide el cambio al proveedor", async () => {
  const f = fakes({ email: "yo@correo.com" });
  const same = await changeEmail(f.identity, { email: "YO@correo.com", redirectTo: "/" });
  assert.equal(!same.ok && same.rule, "U5");
  const r = await changeEmail(f.identity, { email: "Nuevo@Correo.com", redirectTo: "/" });
  assert.ok(r.ok);
  assert.equal(f.calls.email, "nuevo@correo.com");
});

test("foto: valida tipo y tamaño, guarda la URL y se puede quitar", async () => {
  const f = fakes();
  const gif = await updateAvatar(f.profiles, f.storage, { bytes: new ArrayBuffer(10), type: "image/gif", size: 10 });
  assert.equal(!gif.ok && gif.rule, "U6");

  const r = await updateAvatar(f.profiles, f.storage, { bytes: new ArrayBuffer(10), type: "image/webp", size: 10 });
  assert.ok(r.ok);
  assert.equal(f.current()?.avatar_url, "https://cdn/avatars/u1/avatar.webp");

  assert.ok((await removeAvatar(f.profiles, f.storage)).ok);
  assert.equal(f.current()?.avatar_url, null);
  assert.equal(f.calls.removed, 1);
});

test("preferencias se mezclan con las guardadas", async () => {
  const f = fakes();
  await savePreferences(f.profiles, { welcome: false });
  await savePreferences(f.profiles, { compact: true });
  assert.deepEqual(f.current()?.preferences, { welcome: false, compact: true });
});

test("sin la contraseña actual solo se cambia con una sesión de recuperación", async () => {
  const f = fakes({ recovery: false });
  const r = await changePassword(f.identity, { current: null, next: "nueva2026" });
  assert.equal(r.ok, false);
  assert.equal(f.calls.password, null);
});

test("U8: borrar la cuenta pide ELIMINAR y la contraseña actual", async () => {
  const f = fakes();
  const sinPalabra = await deleteAccount(f, { confirmation: "borrar", password: "actual123" });
  assert.equal(!sinPalabra.ok && sinPalabra.rule, "U8");
  const malaClave = await deleteAccount(f, { confirmation: "ELIMINAR", password: "otra" });
  assert.equal(!malaClave.ok && malaClave.rule, "U8");
  assert.equal(f.calls.deleted, false);
  assert.ok((await deleteAccount(f, { confirmation: "ELIMINAR", password: "actual123" })).ok);
  assert.equal(f.calls.deleted, true);
});
