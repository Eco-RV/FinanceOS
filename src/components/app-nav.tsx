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
import { ThemeToggle } from "@/components/theme-toggle";
import { FOCUS_OUTLINE } from "@/lib/interactive";

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
      className={cn(
        "size-5 transition-colors duration-150",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    />
  );
}

function Brand() {
  return (
    <Link
      href="/dashboard"
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-lg transition-opacity duration-150 active:opacity-70",
        FOCUS_OUTLINE,
      )}
    >
      <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground shadow-xs">
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
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4">
        <Brand />
        <nav className="ml-2 hidden items-center gap-0.5 rounded-full bg-muted p-1 sm:flex">
          {NAV_ITEMS.map(({ href, label }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center rounded-full px-4 py-1 text-sm transition-[color,background-color,box-shadow,scale] duration-200 ease-fluid motion-safe:active:scale-[0.96]",
                  FOCUS_OUTLINE,
                  active
                    ? "bg-card font-medium text-foreground shadow-sm dark:bg-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
                <PendingSpinner className="absolute top-1/2 right-1 size-3 -translate-y-1/2" />
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <UserMenu email={email} />
        </div>
      </div>
    </header>
  );
}

export function AppBottomNav() {
  const isActive = useIsActive();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 sm:hidden">
      <div className="mx-auto flex max-w-5xl items-stretch justify-around">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group/tab relative flex flex-1 flex-col items-center gap-1 py-2 text-[11px] transition-colors",
                FOCUS_OUTLINE,
                "focus-visible:-outline-offset-4",
              )}
            >
              <span
                className={cn(
                  "grid h-7 w-14 place-items-center rounded-full transition-[background-color,scale] duration-200 ease-fluid motion-safe:group-active/tab:scale-90",
                  active ? "bg-muted" : "group-active/tab:bg-muted/60",
                )}
              >
                <BottomIcon Icon={Icon} active={active} />
              </span>
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
