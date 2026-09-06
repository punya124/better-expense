"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  GiftIcon,
  HomeIcon,
  ListIcon,
  PlusIcon,
  TargetIcon,
} from "@/components/icons";

function classNames(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const tab = (href: string, label: string, Icon: typeof HomeIcon, active: boolean) => (
    <Link
      href={href}
      aria-label={label}
      className={classNames(
        "flex w-16 flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors",
        active ? "text-emerald-600" : "text-stone-400 hover:text-stone-600",
      )}
    >
      <Icon className="h-6 w-6" />
      {label}
    </Link>
  );

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <main className="flex-1 px-4 pb-28 pt-3">{children}</main>

      <nav
        className="nav-safe fixed bottom-0 left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-stone-200 bg-stone-50/90 backdrop-blur-md"
        style={{ height: "calc(64px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="grid h-full grid-cols-5 items-center">
          {tab("/", "Home", HomeIcon, isActive("/"))}
          {tab("/transactions", "Activity", ListIcon, isActive("/transactions"))}
          <div className="flex justify-center">
            <Link
              href="/add"
              aria-label="Add entry"
              className={classNames(
                "-mt-6 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95",
                isActive("/add")
                  ? "bg-emerald-500 text-white ring-4 ring-emerald-200"
                  : "bg-emerald-600 text-white",
              )}
            >
              <PlusIcon className="h-7 w-7" />
            </Link>
          </div>
          {tab("/goals", "Goals", TargetIcon, isActive("/goals"))}
          {tab("/rewards", "Rewards", GiftIcon, isActive("/rewards"))}
        </div>
      </nav>
    </div>
  );
}
