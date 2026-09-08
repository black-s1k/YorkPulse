"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;

  // Actions
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isHydrated: false,

      setTokens: (accessToken, refreshToken) =>
        set({
          accessToken,
          refreshToken,
          isAuthenticated: true,
        }),

      setUser: (user) =>
        set({
          user,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        }),

      setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: "yorkpulse-auth",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Check if a JWT access token is expired
function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp ? payload.exp * 1000 < Date.now() : false;
  } catch {
    return true;
  }
}

// Handle hydration after store is created
// This runs once on client after the store is initialized
if (typeof window !== "undefined") {
  // Use a microtask to ensure store is fully initialized
  Promise.resolve().then(() => {
    const finishHydration = () => {
      const state = useAuthStore.getState();
      // Only hard-logout if access token is expired AND there is no refresh token
      // to fall back on. If a refresh token exists, keep the session alive —
      // the API client will silently refresh on the first 401.
      if (state.isAuthenticated && isTokenExpired(state.accessToken) && !state.refreshToken) {
        state.logout();
      }
      // DEV ONLY: on localhost with no persisted session, mark authenticated
      // so useUser() fires. The backend only honors this for loopback requests
      // (see Settings.disable_auth_localhost) — it's a no-op against a real API.
      if (!state.isAuthenticated && window.location.hostname === "localhost") {
        useAuthStore.setState({ isAuthenticated: true });
      }
      state.setHydrated();
    };

    useAuthStore.persist.onFinishHydration(finishHydration);

    // If already hydrated (e.g., no persisted state), run immediately
    if (useAuthStore.persist.hasHydrated()) {
      finishHydration();
    }
  });
}
