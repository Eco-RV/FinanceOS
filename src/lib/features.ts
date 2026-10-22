import "server-only";

import { cache } from "react";
import {
  enabledFeatures,
  initialFeatureState,
  readFeatureState,
  type FeatureKey,
  type FeatureState,
} from "@/domain";
import { savePreferences, seedCategories } from "@/application";
import { repositories } from "@/infrastructure/container";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/preferences";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/schema";

/**
 * 3.2.0 · Fase 2: funciones activas del usuario (E1–E3 en
 * `src/domain/account/features.ts`), una vez por request.
 *
 * La primera vez que una cuenta entra a la 3.2.0 no hay estado guardado: si ya
 * tenía cuentas o tarjetas, queda con todo encendido (`legacy`); si es nueva,
 * solo el núcleo, y se le cargan las categorías sugeridas. Ese estado se
 * guarda en `profiles.preferences.features`. Sin la tabla de perfiles (SQL
 * 2.6.0) se trata como una cuenta de antes: todo encendido.
 */
export const getFeatureState = cache(async (): Promise<FeatureState> => {
  const profile = await getProfile();
  if (!profile) return initialFeatureState(true);
  const stored = readFeatureState(profile.preferences.features);
  if (stored) return stored;

  const supabase = await createClient();
  const [{ count: accounts }, { count: cards }] = await Promise.all([
    supabase.from("accounts").select("id", { count: "exact", head: true }),
    supabase.from("credit_cards").select("id", { count: "exact", head: true }),
  ]);
  const hasData = (accounts ?? 0) + (cards ?? 0) > 0;
  const state = initialFeatureState(hasData);

  const repos = await repositories();
  await Promise.all([
    savePreferences(repos.profiles, { features: state }),
    // Usuario nuevo: categorías sugeridas listas desde el primer gasto.
    ...(hasData
      ? []
      : [
          seedCategories(repos.categories, "expense", EXPENSE_CATEGORIES),
          seedCategories(repos.categories, "income", INCOME_CATEGORIES),
        ]),
  ]);
  return state;
});

/** Funciones encendidas en este request. */
export const getEnabledFeatures = cache(async (): Promise<Set<FeatureKey>> => enabledFeatures(await getFeatureState()));

