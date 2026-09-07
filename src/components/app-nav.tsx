"use client";

import type { ComponentType } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  LoaderCircle,
  Settings2,
  Wallet,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/user-menu";

type IconType = ComponentType<{ className?: string }>;

type NavItem = { href: string; label: string; icon: IconType };

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Resumen", icon: LayoutDashboard },
  { href: "/procesos", label: "Procesos", icon: Workflow },
  { href: "/ajustes", label: "Ajustes", icon: Settings2 },
];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) =>
    pathname === href || pathname.startsWith(href + "/");
}

/** Spinner que aparece en el link tocado mientras la navegación está pendiente. */
function PendingSpinner({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <LoaderCircle
      aria-hidden
      className={cn(
        "animate-spin transition-opacity duration-150",
        pending ? "opacity-100" : "opacity-0",
        className,
      )}
    />
  );
}

function BottomIcon({ Icon, active }: { Icon: IconType; active: boolean }) {
  const { pending } = useLinkStatus();
  if (pending) return <LoaderCircle className="size-5 animate-spin" />;
  return (
    <Icon
      className={cn("size-5", active ? "text-foreground" : "text-muted-foreground")}
    />
  );
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
      <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
        <Wallet className="size-4" />
      </span>
      <span className="text-sm font-semibold tracking-tight">
        Finance<span className="text-muted-foreground"> OS</span>
      </span>
    </Link>
  );
}

export function AppTopBar({ email }: { email: string }) {
  const isActive = useIsActive();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4">
        <Brand />
        <nav className="ml-2 hidden items-center gap-1 sm:flex">
          {NAV_ITEMS.map(({ href, label }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {label}
                <PendingSpinner className="size-3.5" />
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto">
          <UserMenu email={email} />
        </div>
      </div>
    </header>
  );
}

export function AppBottomNav() {
  const isActive = useIsActive();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden">
      <div className="mx-auto flex max-w-5xl items-stretch justify-around">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors"
            >
              {active ? (
                <span className="absolute inset-x-0 top-0 mx-auto h-0.5 w-8 rounded-full bg-primary" />
              ) : null}
              <BottomIcon Icon={Icon} active={active} />
              <span
                className={
                  active ? "font-medium text-foreground" : "text-muted-foreground"
                }
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
