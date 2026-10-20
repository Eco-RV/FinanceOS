/**
 * I6 (3.1.0): reglas de comercio (comercio → categoría) que se aprenden al
 * aprobar un pendiente. El usuario las puede corregir o borrar; una regla
 * borrada se vuelve a aprender la próxima vez que apruebe ese comercio.
 */

import { assertCategoryUsable } from "../domain/index.ts";
import type { CategoryRepository, MerchantRuleRepository } from "./ports.ts";
import { fail, ok, run, type UseCaseResult } from "./result.ts";

export function changeMerchantRule(
  deps: { merchantRules: MerchantRuleRepository; categories: CategoryRepository },
  input: { id: string; category: string },
): Promise<UseCaseResult> {
  return run(async () => {
    const category = input.category.trim();
    if (!category || category.length > 40) return fail("Elige una categoría", "I6");
    // G4: no se apunta una regla a una categoría desactivada.
    assertCategoryUsable({ category, deactivated: await deps.categories.isDeactivated("expense", category) });
    await deps.merchantRules.update(input.id, category);
    return ok();
  });
}

export function deleteMerchantRule(merchantRules: MerchantRuleRepository, id: string): Promise<UseCaseResult> {
  return run(async () => {
    await merchantRules.delete(id);
    return ok();
  });
}
