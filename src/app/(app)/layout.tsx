import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppBottomNav, AppTopBar } from "@/components/app-nav";
import { EXPENSE_CATEGORIES } from "@/lib/schema";
import { categoryNames } from "@/lib/categories";
import type { Account, CreditCard } from "@/lib/types";
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
        .select("name")
        .eq("kind", "expense")
        .eq("archived", false)
        .order("name", { ascending: true }),
    ]);

  const accounts = (accData ?? []) as Account[];
  const cards = (cardData ?? []) as CreditCard[];
  const categories = categoryNames(catData ?? [], EXPENSE_CATEGORIES);
  const canRegister = accounts.length > 0 || cards.length > 0;

  return (
    <div className="flex min-h-full flex-col">
      <AppTopBar email={user.email ?? ""} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-24 sm:pb-12">
        {children}
      </main>
      {canRegister ? (
        <TransactionForm
          type="expense"
          accounts={accounts}
          cards={cards}
          categories={categories}
          triggerLabel="Nuevo gasto"
          fab
        />
      ) : null}
      <AppBottomNav />
    </div>
  );
}
