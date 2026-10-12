import assert from "node:assert/strict";
import { test } from "node:test";
import { originLabel, productLabel, touchesInactive } from "./transactions.ts";
import type { Account, CreditCard, Transaction } from "./types.ts";

const account = (id: string, archived = false) => ({ id, name: id.toUpperCase(), archived }) as Account;
const card = (id: string, archived = false) => ({ id, name: id.toUpperCase(), archived }) as CreditCard;
const tx = (fields: Partial<Transaction>) =>
  ({ account_id: null, card_id: null, to_account_id: null, ...fields }) as Transaction;

test("originLabel nombra también lo desactivado, marcándolo", () => {
  const accounts = [account("bcr"), account("viejo", true)];
  assert.equal(originLabel(tx({ account_id: "bcr" }), accounts, []), "BCR");
  assert.equal(originLabel(tx({ account_id: "viejo" }), accounts, []), "VIEJO (desactivada)");
  assert.equal(originLabel(tx({ card_id: "visa" }), [], [card("visa", true)]), "VISA (desactivada)");
  assert.equal(originLabel(tx({ account_id: "borrada" }), accounts, []), "—");
  assert.equal(productLabel(undefined), "—");
});

test("touchesInactive: origen, destino o tarjeta desactivados bloquean la fila (G4)", () => {
  const accounts = [account("bcr"), account("ahorro", true)];
  const cards = [card("visa"), card("amex", true)];
  assert.equal(touchesInactive(tx({ account_id: "bcr" }), accounts, cards), false);
  assert.equal(touchesInactive(tx({ account_id: "ahorro" }), accounts, cards), true);
  assert.equal(touchesInactive(tx({ account_id: "bcr", to_account_id: "ahorro" }), accounts, cards), true);
  assert.equal(touchesInactive(tx({ account_id: "bcr", card_id: "amex" }), accounts, cards), true);
  assert.equal(touchesInactive(tx({ card_id: "visa" }), accounts, cards), false);
});
