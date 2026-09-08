"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, CheckCircle, XCircle, RefreshCw, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVerifyEmail } from "@/hooks/useAuth";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const VERIFICATION_TIMEOUT = 15000; // 15 seconds

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const verifyMutation = useVerifyEmail();
  const [status, setStatus] = useState<"loading" | "success" | "notify" | "error" | "timeout">(token ? "loading" : "error");
  const hasRun = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { subscribe, isSupported } = usePushNotifications();

  const verifyToken = async () => {
    if (!token) return;

    setStatus("loading");

    // Set timeout for long-running verification
    timeoutRef.current = setTimeout(() => {
      setStatus("timeout");
    }, VERIFICATION_TIMEOUT);

    try {
      const data = await verifyMutation.mutateAsync(token);

      // Clear timeout on success
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Show notification prompt if supported and not already granted/denied
      if (isSupported && Notification.permission === "default") {
        setStatus("notify");
      } else {
        setStatus("success");
        setTimeout(() => router.push("/"), 1500);
      }
    } catch {
      // Clear timeout on error
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setStatus("error");
    }
  };

  useEffect(() => {
    if (!token || hasRun.current) return;
    hasRun.current = true;
    verifyToken();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleRetry = () => {
    hasRun.current = false;
    verifyToken();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 text-center"
    >
      {status === "loading" && (
        <>
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Verifying your email...</h1>
            <p className="text-gray-500">Please wait while we verify your account.</p>
          </div>
        </>
      )}

      {status === "success" && (
        <>
          <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-700" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Email verified!</h1>
            <p className="text-gray-500">
              Redirecting you to YorkPulse...
            </p>
          </div>
        </>
      )}

      {status === "notify" && (
        <>
          <div className="w-16 h-16 mx-auto rounded-full bg-blue-500/20 flex items-center justify-center">
            <Bell className="w-8 h-8 text-blue-700" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Stay in the loop</h1>
            <p className="text-gray-500">
              Get notified when someone messages you, even when the app is closed.
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button
              onClick={async () => {
                await subscribe();
                setStatus("success");
                setTimeout(() => router.push("/"), 1000);
              }}
              className="bg-primary hover:bg-york-red-dark"
            >
              <Bell className="w-4 h-4 mr-2" />
              Enable Notifications
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setStatus("success");
                setTimeout(() => router.push("/"), 500);
              }}
            >
              Skip
            </Button>
          </div>
        </>
      )}

      {status === "timeout" && (
        <>
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-amber-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Taking longer than expected</h1>
            <p className="text-gray-500">
              The verification is taking too long. Please try again.
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button
              onClick={handleRetry}
              className="bg-primary hover:bg-york-red-dark"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/auth/login")}
            >
              Back to Login
            </Button>
          </div>
        </>
      )}

      {status === "error" && (
        <>
          <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
            <XCircle className="w-8 h-8 text-red-700" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Verification failed</h1>
            <p className="text-gray-500">
              The link may have expired or is invalid. Please try signing in again.
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button
              onClick={handleRetry}
              className="bg-primary hover:bg-york-red-dark"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/auth/login")}
            >
              Back to Login
            </Button>
          </div>
        </>
      )}
    </motion.div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
