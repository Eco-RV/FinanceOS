"use client";

import Link from "next/link";
import { LogOut, SlidersHorizontal, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/lib/session-actions";
import { cn } from "@/lib/utils";

/** Lo que la barra muestra del usuario (2.6.0). */
export type AccountSummary = {
  email: string;
  name: string | null;
  avatarUrl: string | null;
  initials: string;
};

/** Foto de perfil o, si no hay, las iniciales. */
export function Avatar({
  account,
  className,
}: {
  account: Pick<AccountSummary, "avatarUrl" | "initials">;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-xs font-semibold text-foreground",
        className,
      )}
    >
      {account.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL pública de Supabase Storage
        <img src={account.avatarUrl} alt="" className="size-full object-cover" />
      ) : (
        account.initials
      )}
    </span>
  );
}

export function UserMenu({ account }: { account: AccountSummary }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Cuenta"
        className="rounded-full ring-1 ring-foreground/5 transition-[box-shadow,scale] duration-150 ease-fluid outline-none hover:ring-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:active:scale-95"
      >
        <Avatar account={account} className="size-8" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar account={account} className="size-10 text-sm" />
          <div className="min-w-0">
            {account.name ? (
              <p className="truncate text-sm font-medium">{account.name}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Sesión iniciada como</p>
            )}
            <p className={cn("truncate", account.name ? "text-xs text-muted-foreground" : "text-sm font-medium")}>
              {account.email || "—"}
            </p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/ajustes/cuenta" />}>
          <UserRound />
          Mi cuenta
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/ajustes/preferencias" />}>
          <SlidersHorizontal />
          Preferencias
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => signOutAction()}>
          <LogOut />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
