"use client";

// Core activity-tracking client: session lifecycle, event batching/flush,
// and rrweb session-replay recording. Kept separate from the React
// component (components/ActivityTracker.tsx) so the batching/flush logic
// is plain, testable TS — mirrors how services/api.ts is a plain class,
// not a hook.
//
// No existing batching layer in this codebase to reuse (see the feature's
// implementation plan) — this is genuinely new.

import { api } from "@/services/api";

const FLUSH_INTERVAL_MS = 10_000;
const MAX_BUFFER_SIZE = 20;
// rrweb chunk flush interval — kept short specifically to respect
// DynamoDB's 400KB per-item limit (see analytics-dynamodb.tf); a long
// buffering window risks a single chunk exceeding that limit.
const REPLAY_CHUNK_INTERVAL_MS = 15_000;

export type TrackedEvent = {
  event_type: string;
  category: string;
  entity_type?: string;
  entity_id?: string;
  properties?: Record<string, unknown>;
};

class ActivityTrackerClient {
  private sessionId: string | null = null;
  private buffer: TrackedEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private stopReplay: (() => void) | null = null;
  private replayEvents: unknown[] = [];
  private replayFlushTimer: ReturnType<typeof setInterval> | null = null;

  async ensureSession(): Promise<string> {
    if (this.sessionId) return this.sessionId;

    const existing = sessionStorage.getItem("yp_activity_session_id");
    if (existing) {
      this.sessionId = existing;
      return existing;
    }

    try {
      const { session_id } = await api.analytics.startSession({
        device_type: /Mobi/i.test(navigator.userAgent) ? "mobile" : "desktop",
        browser: navigator.userAgent.slice(0, 100),
        landing_path: window.location.pathname,
      });
      this.sessionId = session_id;
      sessionStorage.setItem("yp_activity_session_id", session_id);
    } catch {
      // Tracking must never break the app it's attached to.
      this.sessionId = "unavailable";
    }

    if (!this.flushTimer) {
      this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
      window.addEventListener("pagehide", () => this.flush(true));
      window.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") this.flush(true);
      });
    }

    return this.sessionId;
  }

  track(event: TrackedEvent) {
    this.buffer.push(event);
    if (this.buffer.length >= MAX_BUFFER_SIZE) {
      this.flush();
    }
  }

  private flush(useBeacon = false) {
    if (this.buffer.length === 0 || !this.sessionId || this.sessionId === "unavailable") return;
    const events = this.buffer;
    this.buffer = [];

    const payload = JSON.stringify({ session_id: this.sessionId, events });

    if (useBeacon && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/analytics/events`,
        blob
      );
      return;
    }

    api.analytics.trackEvents(this.sessionId, events).catch(() => {
      // Drop on failure — tracking is best-effort, never retried into a
      // growing backlog.
    });
  }

  /** Starts rrweb recording. Only ever called after explicit session-replay
   * consent (see components/ActivityTracker.tsx) — never on app load by
   * default. maskAllInputs + blockClass/maskTextClass are mandatory, not
   * optional: without them rrweb would capture the exact raw text a
   * student types into a Vault post, a DM, or a course-chat message,
   * defeating the "metadata only" decision through screen recording rather
   * than the event schema. See the feature's implementation plan. */
  async startReplay() {
    if (this.stopReplay) return; // already recording

    const { record } = await import("rrweb");

    this.stopReplay = record({
      emit: (event) => {
        this.replayEvents.push(event);
      },
      maskAllInputs: true,
      maskTextClass: "rr-mask",
      blockClass: "rr-block",
      // Applies to every Vault/DM/course-chat compose box and message list,
      // and the password/student-ID upload flow — see those components for
      // the corresponding className.
      checkoutEveryNms: REPLAY_CHUNK_INTERVAL_MS,
    }) ?? null;

    this.replayFlushTimer = setInterval(() => this.flushReplayChunk(), REPLAY_CHUNK_INTERVAL_MS);
  }

  stopReplayRecording() {
    this.stopReplay?.();
    this.stopReplay = null;
    if (this.replayFlushTimer) {
      clearInterval(this.replayFlushTimer);
      this.replayFlushTimer = null;
    }
    this.flushReplayChunk();
  }

  private async flushReplayChunk() {
    if (this.replayEvents.length === 0 || !this.sessionId || this.sessionId === "unavailable") return;
    const chunk = this.replayEvents;
    this.replayEvents = [];

    try {
      const payload = JSON.stringify(chunk);
      const byteSize = new Blob([payload]).size;
      // The chunk itself would be uploaded directly to a presigned
      // destination in a full implementation (mirroring S3Service's
      // presigned-upload pattern used elsewhere in this codebase); this
      // records the metadata pointer. See the feature's implementation
      // plan §"Session replay (rrweb)".
      const chunkKey = `replay/${this.sessionId}/${Date.now()}.json`;
      await api.analytics.recordReplayChunk(this.sessionId, chunkKey, byteSize);
    } catch {
      // Best-effort — never surfaces to the user.
    }
  }
}

export const activityTracker = new ActivityTrackerClient();
