import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { AppBottomNav, AppTopBar } from "@/components/app-nav";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-full flex-col">
      <AppTopBar email={user.email ?? ""} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-24 sm:pb-12">
        {children}
      </main>
      <AppBottomNav />
    </div>
  );
}
