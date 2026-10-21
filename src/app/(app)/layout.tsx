import { Suspense, type ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppBottomNav, AppTopBar } from "@/components/app-nav";
import { AppBackdrop } from "@/components/app-backdrop";
import { WelcomeSplash } from "@/components/welcome-splash";
import { UrlNotice } from "@/components/url-notice";
import { initialsOf } from "@/domain";
import { getPreferences, getProfile } from "@/lib/preferences";
import { DateFormatProvider } from "@/components/date-format";
import { PerfNavTimer } from "@/components/perf-nav-timer";
import { DAILY_SYNC_COOKIE, ensureDailySync } from "@/lib/sync-plans";
import { DailySyncMark } from "@/components/daily-sync-mark";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/schema";
import { categoryOptions, iconsByName } from "@/lib/categories";
import { loadDebitCards } from "@/lib/debit-cards";
import type { Account, Category, CreditCard } from "@/lib/types";
import { QuickAdd } from "./quick-add";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  // 2.7.0: salarios, suscripciones y seguros que ya llegaron (M7).
  // 3.2.0: una vez al día (la primera visita espera; las demás solo leen una cookie).
  const [user, sync] = await Promise.all([requireUser(), ensureDailySync()]);

  const supabase = await createClient();
  // 3.2.0: todo en una sola tanda (antes el perfil iba en una segunda).
  // 2.6.0: nombre y foto para la barra y la bienvenida (si falta el SQL, vacío).
  // U9 (3.1.0): formato de fecha y moneda base del gasto rápido.
  const [{ data: accData }, { data: cardData }, { data: catData }, { data: incData }, debitCards, profile, prefs] =
    await Promise.all([
      supabase.from("accounts").select("*").eq("archived", false),
      supabase.from("credit_cards").select("*").eq("archived", false),
      supabase
        .from("categories")
        .select("*")
        .eq("kind", "expense")
        .eq("archived", false)
        .order("name", { ascending: true }),
      supabase
        .from("categories")
        .select("*")
        .eq("kind", "income")
        .eq("archived", false)
        .order("name", { ascending: true }),
      loadDebitCards(supabase),
      getProfile(),
      getPreferences(),
    ]);
  const email = user.email ?? "";
  const account = {
    email,
    name: profile?.full_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    initials: initialsOf(profile?.full_name, email),
  };

  const accounts = (accData ?? []) as Account[];
  const cards = (cardData ?? []) as CreditCard[];
  const options = categoryOptions((catData ?? []) as Category[], EXPENSE_CATEGORIES);
  const categories = options.map((o) => o.name);
  const incomeOptions = categoryOptions((incData ?? []) as Category[], INCOME_CATEGORIES);
  const canRegister = accounts.length > 0 || cards.length > 0;

  return (
    <DateFormatProvider value={prefs.dateFormat}>
      <div className="flex min-h-full flex-col">
        <AppBackdrop />
        {sync.ran ? <DailySyncMark name={DAILY_SYNC_COOKIE} mark={sync.mark} /> : null}
        <WelcomeSplash name={account.name?.split(" ")[0] ?? null} />
        <Suspense fallback={null}>
          <UrlNotice />
          <PerfNavTimer />
        </Suspense>
        <AppTopBar account={account} />
        {/* 2.5.0: el contenido crece con el monitor; en móvil sigue a lo ancho. */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-56 sm:px-6 sm:pb-40 lg:px-8 2xl:max-w-[1600px]">
          {children}
        </main>
        {/* 3.1.0: acceso rápido — gasto (sale ↑, rojo) arriba e ingreso (entra ↓, verde) abajo. */}
        {canRegister ? (
          <div className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex flex-col gap-3 sm:right-6 sm:bottom-6">
            {/* 3.2.0: los formularios se cargan cuando el navegador queda libre o al tocar. */}
            <QuickAdd
              expense={{
                type: "expense",
                accounts,
                cards,
                debitCards,
                categories,
                categoryIcons: iconsByName(options),
                triggerLabel: "Nuevo gasto",
                defaultCurrency: prefs.baseCurrency,
                fab: true,
              }}
              income={
                accounts.length > 0
                  ? {
                      type: "income",
                      accounts,
                      categories: incomeOptions.map((o) => o.name),
                      categoryIcons: iconsByName(incomeOptions),
                      triggerLabel: "Nuevo ingreso",
                      fab: true,
                    }
                  : null
              }
            />
          </div>
        ) : null}
        <AppBottomNav />
      </div>
    </DateFormatProvider>
  );
}

