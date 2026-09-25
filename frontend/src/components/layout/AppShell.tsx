"use client";

import { usePathname } from "next/navigation";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { CreateQuestModal } from "@/components/CreateQuestModal";
import { CreateModal } from "@/components/modals/CreateModal";
import { ProfileCompletionGuard } from "@/components/ProfileCompletionGuard";
import { cn } from "@/lib/utils";
import { isIgnitePath } from "@/lib/sandbox";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isAuthPage = pathname.startsWith("/auth");
  const isLandingPage = pathname === "/";

  // AI Ignite has its own layout and none of the YorkPulse chrome or guards
  if (isIgnitePath(pathname)) return <>{children}</>;

  return (
    <ProfileCompletionGuard>
      <div className="min-h-screen flex flex-col">
        {!isAuthPage && <Header />}
        <main
          className={cn(
            "flex-1",
            !isAuthPage && !isLandingPage && "pt-16 pb-20 md:pb-0"
          )}
        >
          {children}
        </main>
        {!isAuthPage && <BottomNav />}
        {!isAuthPage && !isLandingPage && <FloatingActionButton />}

        {/* Global Modals */}
        <CreateModal />
        <CreateQuestModal />

      </div>
    </ProfileCompletionGuard>
  );
}
