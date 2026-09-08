"use client";

import { useEffect, useState, useRef } from "react";
import { useAuthStore } from "@/stores/auth";
import FounderBadge from "@/components/FounderBadge";

const STORAGE_KEY = "yorkpulse_founder_celebration_seen";
const DURATION_MS = 5000;

const CONFETTI_PIECES = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  left: `${Math.random() * 100}%`,
  delay: `${Math.random() * 1.5}s`,
  duration: `${2.5 + Math.random() * 2}s`,
  color: ["#6d28d9", "#0891b2", "#f59e0b", "#10b981", "#ec4899", "#f97316"][i % 6],
  size: `${6 + Math.random() * 8}px`,
  rotate: `${Math.random() * 360}deg`,
}));

export default function FounderCelebration() {
  const { user, isAuthenticated, isHydrated } = useAuthStore();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !user?.is_founder) return;
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    setVisible(true);
    localStorage.setItem(STORAGE_KEY, "1");

    const start = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.max(0, 100 - (elapsed / DURATION_MS) * 100));
    }, 50);

    timerRef.current = setTimeout(() => {
      setVisible(false);
    }, DURATION_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isHydrated, isAuthenticated, user?.is_founder]);

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes pop-in {
          0% { transform: scale(0.7) translateY(20px); opacity: 0; }
          70% { transform: scale(1.05) translateY(-4px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes badge-glow {
          0%, 100% { box-shadow: 0 0 8px 2px #6d28d9aa; }
          50% { box-shadow: 0 0 20px 6px #0891b2cc; }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .founder-popup { animation: pop-in 0.45s cubic-bezier(.34,1.56,.64,1) both; }
        .confetti-piece { animation: confetti-fall linear both; }
      `}</style>

      {/* Confetti layer */}
      <div className="fixed inset-0 pointer-events-none z-[9998] overflow-hidden">
        {CONFETTI_PIECES.map((p) => (
          <div
            key={p.id}
            className="confetti-piece absolute top-0"
            style={{
              left: p.left,
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              borderRadius: p.id % 3 === 0 ? "50%" : p.id % 3 === 1 ? "2px" : "0",
              animationDuration: p.duration,
              animationDelay: p.delay,
              transform: `rotate(${p.rotate})`,
            }}
          />
        ))}
      </div>

      {/* Popup */}
      <div className="fixed inset-0 flex items-center justify-center z-[9999] pointer-events-none">
        <div
          className="founder-popup pointer-events-auto relative mx-4 rounded-2xl border border-gray-100 bg-white backdrop-blur-md shadow-2xl overflow-hidden"
          style={{ maxWidth: 360, width: "100%" }}
        >
          {/* Progress bar */}
          <div className="absolute top-0 left-0 h-0.5 bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-75" style={{ width: `${progress}%` }} />

          <div className="p-8 text-center">
            {/* Emoji burst */}
            <div className="text-4xl mb-4 select-none">🎂🎉🎊</div>

            {/* Badge with glow */}
            <div className="flex justify-center mb-4">
              <span
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold tracking-widest"
                style={{
                  background: "linear-gradient(135deg, #6d28d9, #0891b2)",
                  color: "white",
                  animation: "badge-glow 2s ease-in-out infinite",
                }}
              >
                ⬡ ꩜ ⊹
              </span>
            </div>

            <h2 className="text-xl font-bold text-gray-900 mb-1">You earned a badge!</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Thanks for being one of the{" "}
              <span className="text-violet-700 font-semibold">first members</span>{" "}
              of YorkPulse. This badge is yours forever.
            </p>

            <button
              className="mt-5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
              onClick={() => setVisible(false)}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
