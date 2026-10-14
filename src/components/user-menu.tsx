"use client";

import { LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/lib/session-actions";

function initials(email: string): string {
  const local = email.split("@")[0]?.trim();
  if (!local) return "?";
  const parts = local.split(/[.\-_+]+/).filter(Boolean);
  const raw =
    parts.length > 1 ? parts[0][0] + parts[1][0] : local.slice(0, 2);
  return raw.toUpperCase();
}

export function UserMenu({ email }: { email: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Cuenta"
        className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-foreground ring-1 ring-foreground/5 transition-[background-color,box-shadow,scale] duration-150 ease-fluid outline-none hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-foreground/10 motion-safe:active:scale-95"
      >
        {initials(email)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56">
        <div className="px-2 py-1.5">
          <p className="text-xs text-muted-foreground">Sesión iniciada como</p>
          <p className="truncate text-sm font-medium">{email || "—"}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => signOutAction()}>
          <LogOut />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
