import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppBottomNav, AppTopBar } from "@/components/app-nav";
import { AppBackdrop } from "@/components/app-backdrop";
import { WelcomeSplash } from "@/components/welcome-splash";
import { EXPENSE_CATEGORIES } from "@/lib/schema";
import { categoryOptions, iconsByName } from "@/lib/categories";
import type { Account, Category, CreditCard } from "@/lib/types";
import { TransactionForm } from "./procesos/_transactions/transaction-form";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();

  const supabase = await createClient();
  const [{ data: accData }, { data: cardData }, { data: catData }] =
    await Promise.all([
      supabase.from("accounts").select("*").eq("archived", false),
      supabase.from("credit_cards").select("*").eq("archived", false),
      supabase
        .from("categories")
        .select("*")
        .eq("kind", "expense")
        .eq("archived", false)
        .order("name", { ascending: true }),
    ]);

  const accounts = (accData ?? []) as Account[];
  const cards = (cardData ?? []) as CreditCard[];
  const options = categoryOptions((catData ?? []) as Category[], EXPENSE_CATEGORIES);
  const categories = options.map((o) => o.name);
  const canRegister = accounts.length > 0 || cards.length > 0;

  return (
    <div className="flex min-h-full flex-col">
      <AppBackdrop />
      <WelcomeSplash />
      <AppTopBar email={user.email ?? ""} />
      {/* 2.5.0: el contenido crece con el monitor; en móvil sigue a lo ancho. */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-24 sm:px-6 sm:pb-12 lg:px-8 2xl:max-w-[1600px]">
        {children}
      </main>
      {canRegister ? (
        <TransactionForm
          type="expense"
          accounts={accounts}
          cards={cards}
          categories={categories}
          categoryIcons={iconsByName(options)}
          triggerLabel="Nuevo gasto"
          fab
        />
      ) : null}
      <AppBottomNav />
    </div>
  );
}

