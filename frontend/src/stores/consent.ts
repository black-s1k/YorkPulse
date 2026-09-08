"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// Current Privacy Policy version this consent applies to — bump whenever
// the tracking-disclosure section changes materially, so a re-prompt can be
// triggered (see ActivityTracker, which checks this against the persisted
// value). Keep in sync with the "Last updated" line on /privacy.
export const CURRENT_POLICY_VERSION = "privacy-2026-09-v2";

interface ConsentState {
  policyVersion: string | null;
  // Essential tracking (rate-limiting, abuse prevention) is not gated by
  // consent at all — it's disclosed, not optional, same as it already is
  // today via RateLimitMiddleware. Only these two tiers are opt-in.
  productAnalyticsConsented: boolean;
  sessionReplayConsented: boolean;
  // Distinguishes "never asked" from "asked and declined both" — controls
  // whether the setup-profile consent step shows at all.
  hasBeenAsked: boolean;

  setConsent: (scope: "product_analytics" | "session_replay", granted: boolean) => void;
  markAsked: () => void;
  reset: () => void;
}

export const useConsentStore = create<ConsentState>()(
  persist(
    (set) => ({
      policyVersion: null,
      productAnalyticsConsented: false,
      sessionReplayConsented: false,
      hasBeenAsked: false,

      setConsent: (scope, granted) =>
        set((state) => ({
          ...state,
          policyVersion: CURRENT_POLICY_VERSION,
          productAnalyticsConsented: scope === "product_analytics" ? granted : state.productAnalyticsConsented,
          sessionReplayConsented: scope === "session_replay" ? granted : state.sessionReplayConsented,
        })),

      markAsked: () => set({ hasBeenAsked: true, policyVersion: CURRENT_POLICY_VERSION }),

      reset: () =>
        set({
          policyVersion: null,
          productAnalyticsConsented: false,
          sessionReplayConsented: false,
          hasBeenAsked: false,
        }),
    }),
    {
      name: "yorkpulse-consent",
    }
  )
);
