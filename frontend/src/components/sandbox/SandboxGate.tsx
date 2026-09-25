"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { IGNITE_BASE, isIgnitePath, isSandboxToken } from "@/lib/sandbox";

function useSandbox() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  return { isHydrated, sandbox: isSandboxToken(accessToken) };
}

// Sandbox accounts only ever see the AI Ignite section (/ignite); every other
// route is blank and redirects there. Non-sandbox users can't open /ignite.
export function SandboxGate({ children }: { children: React.ReactNode }) {
  const { isHydrated, sandbox } = useSandbox();
  const pathname = usePathname();
  const router = useRouter();
  const onIgnite = isIgnitePath(pathname);

  // The CSS flag set in layout.tsx only covers the moment before hydration.
  // Once React is in control this gate does the hiding, and the flag must go:
  // it would otherwise hide portals (dialogs, dropdowns, toasts) outside the
  // sandbox root.
  useEffect(() => {
    if (isHydrated) delete document.documentElement.dataset.sandbox;
  }, [isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    if (sandbox && !onIgnite) router.replace(IGNITE_BASE);
    if (!sandbox && onIgnite) router.replace("/");
  }, [isHydrated, sandbox, onIgnite, router]);

  if (onIgnite) {
    return isHydrated && sandbox ? <>{children}</> : null;
  }
  if (isHydrated && sandbox) {
    return <div data-sandbox-root className="min-h-screen bg-white" />;
  }
  return <>{children}</>;
}

// Global YorkPulse extras (FAB, modals, push prompt, tracking) that must never
// mount for sandbox accounts.
export function HideForSandbox({ children }: { children: React.ReactNode }) {
  const { isHydrated, sandbox } = useSandbox();
  if (isHydrated && sandbox) return null;
  return <>{children}</>;
}
