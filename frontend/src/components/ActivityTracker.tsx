"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { activityTracker } from "@/lib/activityTracker";
import { useConsentStore } from "@/stores/consent";

// Render-nothing component, mounted once at the app root (see
// providers.tsx) next to AuthInitializer. Wraps the actual tracker in
// Suspense because useSearchParams() requires it in the App Router.
export function ActivityTracker() {
  return (
    <Suspense fallback={null}>
      <ActivityTrackerInner />
    </Suspense>
  );
}

function ActivityTrackerInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { productAnalyticsConsented, sessionReplayConsented } = useConsentStore();
  const replayActiveRef = useRef(false);

  // Session lifecycle — established once, regardless of consent (the
  // session itself carries no tracked content; it's just the join key
  // events attach to if/when consent is granted).
  useEffect(() => {
    activityTracker.ensureSession();
  }, []);

  // Page views — gated behind product-analytics consent specifically, not
  // tracked by default.
  useEffect(() => {
    if (!productAnalyticsConsented) return;
    activityTracker.track({
      event_type: "nav.page_view",
      category: "navigation",
      properties: {
        path: pathname,
        has_query: searchParams.toString().length > 0,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, productAnalyticsConsented]);

  // Session replay — starts/stops as consent changes, never on by default.
  useEffect(() => {
    if (sessionReplayConsented && !replayActiveRef.current) {
      replayActiveRef.current = true;
      activityTracker.startReplay();
    } else if (!sessionReplayConsented && replayActiveRef.current) {
      replayActiveRef.current = false;
      activityTracker.stopReplayRecording();
    }
  }, [sessionReplayConsented]);

  return null;
}
