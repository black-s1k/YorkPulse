import type { Metadata } from "next";
import { IgniteHeader } from "@/components/ignite/IgniteHeader";

export const metadata: Metadata = {
  title: {
    default: "AI Ignite",
    template: "%s | AI Ignite",
  },
};

// data-sandbox-root keeps this visible under the sandbox pre-hydration CSS guard
export default function IgniteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-sandbox-root className="min-h-screen bg-white">
      <IgniteHeader />
      <main>{children}</main>
    </div>
  );
}
