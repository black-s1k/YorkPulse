"use client";

import { useEffect, useState } from "react";
import { Shield, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/services/api";
import { useConsentStore, CURRENT_POLICY_VERSION } from "@/stores/consent";

// Standalone section for the profile page — lets a user view/withdraw
// activity-tracking consent at any time after onboarding, not just once
// during setup-profile's consent step. There's no dedicated Settings page
// in this app today, so this lives on the existing profile page (the
// closest analog) rather than introducing a whole new route.
export function PrivacyActivitySection() {
  const { productAnalyticsConsented, sessionReplayConsented, setConsent } = useConsentStore();
  const [loading, setLoading] = useState<"product_analytics" | "session_replay" | null>(null);
  const { toast } = useToast();

  // Sync with the server's record on mount — the persisted local store is a
  // cache, the append-only ledger in Postgres is the source of truth.
  useEffect(() => {
    api.analytics
      .getConsentStatus()
      .then((status) => {
        setConsent("product_analytics", status.product_analytics);
        setConsent("session_replay", status.session_replay);
      })
      .catch(() => {
        // Not authenticated, or the feature is disabled server-side —
        // fall back silently to whatever's already in local state.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = async (scope: "product_analytics" | "session_replay", checked: boolean) => {
    setLoading(scope);
    try {
      await api.analytics.setConsent({
        policy_version: CURRENT_POLICY_VERSION,
        consent_scope: scope,
        action: checked ? "granted" : "withdrawn",
      });
      setConsent(scope, checked);
      toast({
        description: checked ? "Enabled." : "Turned off — takes effect immediately.",
      });
    } catch {
      toast({
        description: "Couldn't update this right now. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="mt-6 p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm text-gray-900">Privacy &amp; Activity</h3>
      </div>

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-900">Product analytics</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Page visits, clicks, session length. Never what you write.
            </p>
          </div>
          {loading === "product_analytics" ? (
            <Loader2 className="w-4 h-4 animate-spin text-gray-400 mt-1" />
          ) : (
            <Switch
              checked={productAnalyticsConsented}
              onCheckedChange={(checked) => handleToggle("product_analytics", checked)}
            />
          )}
        </div>

        <div className="flex items-start justify-between gap-3 pt-3 border-t border-gray-100">
          <div>
            <p className="text-sm font-medium text-gray-900">Session replay</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Records on-screen interactions to help us fix confusing UI. Typed text is never captured.
            </p>
          </div>
          {loading === "session_replay" ? (
            <Loader2 className="w-4 h-4 animate-spin text-gray-400 mt-1" />
          ) : (
            <Switch
              checked={sessionReplayConsented}
              onCheckedChange={(checked) => handleToggle("session_replay", checked)}
            />
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        See our{" "}
        <a href="/privacy" className="text-primary hover:underline">
          Privacy Policy
        </a>{" "}
        for full details on what each option covers.
      </p>
    </div>
  );
}
