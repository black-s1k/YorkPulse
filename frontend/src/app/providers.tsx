"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { CreateModal } from "@/components/modals/CreateModal";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import FounderCelebration from "@/components/FounderCelebration";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { usePushNotifications } from "@/hooks/usePushNotifications";

function AuthInitializer() {
  useEffect(() => {
    // Connect auth store to API client
    api.setTokenGetter(() => useAuthStore.getState().accessToken);
    api.setRefreshTokenGetter(() => useAuthStore.getState().refreshToken);
    api.setTokenRefreshedHandler((accessToken, refreshToken) => {
      useAuthStore.getState().setTokens(accessToken, refreshToken);
    });
    api.setUnauthorizedHandler(() => {
      useAuthStore.getState().logout();
    });
  }, []);

  return null;
}

function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(console.error);
    }
  }, []);

  return null;
}

function PushNotificationPrompt() {
  const { isAuthenticated } = useAuthStore();
  const { subscribe, isSupported } = usePushNotifications();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !isSupported) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem("push_prompt_shown")) return;

    // Show after a short delay so the page settles first
    const t = setTimeout(() => setVisible(true), 2500);
    return () => clearTimeout(t);
  }, [isAuthenticated, isSupported]);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem("push_prompt_shown", "true");
  };

  const enable = async () => {
    setVisible(false);
    localStorage.setItem("push_prompt_shown", "true");
    await subscribe();
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-4 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
            <span className="text-lg">🔔</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Stay in the loop</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Get notified when someone messages you, even when the app is closed.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={enable}
            className="flex-1 bg-primary hover:bg-york-red-dark text-white text-sm font-medium py-2 rounded-lg transition-colors"
          >
            Enable Notifications
          </button>
          <button
            onClick={dismiss}
            className="px-4 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              // Don't retry on 401 or 403
              if (error instanceof Error && (error.message === "Unauthorized" || error.message === "Forbidden")) {
                return false;
              }
              return failureCount < 3;
            },
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer />
      <ServiceWorkerRegistrar />
      {children}
      <CreateModal />
      <FloatingActionButton />
      <FounderCelebration />
      <PushNotificationPrompt />
      <Toaster />
    </QueryClientProvider>
  );
}
