"use client";

import Link from "next/link";
import { Inbox, LogOut, MessageSquareText, SlidersHorizontal, UserRound } from "lucide-react";
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
  /** 3.2.0 (B5): respuestas del equipo sin leer en el buzón. */
  feedbackUnread?: number;
  /** 3.2.0: publicaciones sin leer en la bandeja (solo admin; si no, null). */
  feedbackInbox?: number | null;
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
  const unread = account.feedbackUnread ?? 0;
  const inbox = account.feedbackInbox ?? null;
  // 3.2.0: un punto discreto sobre la foto si hay algo por leer (no un aviso).
  const dot = unread > 0 || (inbox ?? 0) > 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={dot ? "Cuenta (hay mensajes sin leer)" : "Cuenta"}
        className="relative rounded-full ring-1 ring-foreground/5 transition-[box-shadow,scale] duration-150 ease-fluid outline-none hover:ring-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:active:scale-95"
      >
        <Avatar account={account} className="size-8" />
        {dot ? (
          <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-primary ring-2 ring-background" aria-hidden />
        ) : null}
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
        <DropdownMenuItem render={<Link href="/comentarios" />}>
          <MessageSquareText />
          Comentarios
          {unread > 0 ? (
            <span className="ml-auto rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
              {unread}
            </span>
          ) : null}
        </DropdownMenuItem>
        {inbox !== null ? (
          <DropdownMenuItem render={<Link href="/comentarios/bandeja" />}>
            <Inbox />
            Bandeja
            {inbox > 0 ? (
              <span className="ml-auto rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                {inbox}
              </span>
            ) : null}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => signOutAction()}>
          <LogOut />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
