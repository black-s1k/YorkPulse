"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth";
import { isSandboxToken } from "@/lib/sandbox";

// Replaces the entire app with a blank page for sandbox accounts.
// Build the new experience inside the sandbox branch below.
export function SandboxGate({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const sandbox = isSandboxToken(accessToken);

  // Keep the pre-hydration flag (set in layout.tsx) in sync, e.g. after logout
  useEffect(() => {
    if (sandbox) document.documentElement.dataset.sandbox = "1";
    else delete document.documentElement.dataset.sandbox;
  }, [sandbox]);

  if (isHydrated && sandbox) {
    return <div data-sandbox-root className="min-h-screen bg-white" />;
  }

  return <>{children}</>;
}
