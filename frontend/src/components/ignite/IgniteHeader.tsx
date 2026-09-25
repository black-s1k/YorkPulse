"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { useLogout } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { IGNITE_TEAMS } from "./teams";

export function IgniteHeader() {
  const pathname = usePathname();
  const logout = useLogout();

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/ignite" className="text-lg font-bold text-gray-900">
          AI Ignite
        </Link>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
      <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
        {IGNITE_TEAMS.map((team) => {
          const active = pathname === team.href || pathname.startsWith(team.href + "/");
          return (
            <Link
              key={team.slug}
              href={team.href}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors",
                active ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              {team.group ? `${team.group} · ${team.name}` : team.name}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
