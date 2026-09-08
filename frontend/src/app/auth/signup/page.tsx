"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Press_Start_2P } from "next/font/google";
import {
  Mail,
  ArrowRight,
  ArrowLeft,
  Loader2,
  RefreshCw,
  CheckCircle,
  Shield,
  ShoppingBag,
  Users,
  GraduationCap,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OTPInput } from "@/components/ui/otp-input";
import { HoneypotField } from "@/components/ui/honeypot-field";
import { useToast } from "@/hooks/use-toast";
import { useSignup, useVerifyOTP, useResendOTP } from "@/hooks/useAuth";

const pressStart2P = Press_Start_2P({ weight: "400", subsets: ["latin"], display: "swap" });

// ─── Pixel Cat Mascot ────────────────────────────────────────────────────────
const PX = 7; // px per "pixel"

// Front-facing sitting cat — 15 cols × 16 rows — direct outline pixels.
// Two pointy ears → round hollow head → neck pinch → body → two paw bumps.
// Tail curls to the right of body (rows 10-12, cols 13-14).
const OUTLINE: (0 | 1)[][] = [
//  0  1  2  3  4  5  6  7  8  9 10 11 12 13 14
  [ 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0 ], //  0 ear tips
  [ 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0 ], //  1 ears
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0 ], //  2 head top (ear bases connect)
  [ 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0 ], //  3 head sides
  [ 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0 ], //  4 eyes row
  [ 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0 ], //  5 nose row
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0 ], //  6 chin
  [ 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0 ], //  7 neck (narrower)
  [ 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0 ], //  8 chest/shoulders
  [ 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0 ], //  9 body sides
  [ 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0 ], // 10 body + tail right
  [ 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1 ], // 11 body + tail tip
  [ 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0 ], // 12 body + tail returns
  [ 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0 ], // 13 body bottom
  [ 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0 ], // 14 paws (two bumps)
  [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ], // 15 empty
];
const CAT_PX_W = 15 * PX; // 105px
const CAT_PX_H = 16 * PX; // 112px

// Eyes — two 2×2 blocks inside the hollow head
const _EYE_PX: [number, number][] = [
  [4, 4], [5, 4], [4, 5], [5, 5],  // left eye
  [8, 4], [9, 4], [8, 5], [9, 5],  // right eye
];

// Separate tail pixels (cols 13-14, rows 10-12) for wag animation
const _TAIL_PX: [number, number][] = [];
const _BODY_PX: [number, number][] = [];
for (let r = 0; r < OUTLINE.length; r++) {
  for (let c = 0; c < OUTLINE[0].length; c++) {
    if (!OUTLINE[r][c]) continue;
    if (c >= 13 && r >= 10 && r <= 12)
      _TAIL_PX.push([c, r]);
    else
      _BODY_PX.push([c, r]);
  }
}

function PixelCatSVG() {
  const R = "#E31837";
  const px = (c: number, r: number, k: string) => (
    <rect key={k} x={c * PX} y={r * PX} width={PX} height={PX} fill={R} shapeRendering="crispEdges" />
  );
  return (
    <>
      <style>{`
        @keyframes yp-wag { 0%,100%{transform:rotate(0deg)} 50%{transform:rotate(12deg)} }
        .yp-tail { transform-origin:${12 * PX}px ${10 * PX}px; animation:yp-wag 1.8s ease-in-out infinite; }
      `}</style>
      <svg width={CAT_PX_W} height={CAT_PX_H} style={{ imageRendering: "pixelated" }} aria-hidden>
        <g>
          {_BODY_PX.map(([c, r]) => px(c, r, `b${r}-${c}`))}
          {_EYE_PX.map(([c, r]) => px(c, r, `e${r}-${c}`))}
        </g>
        <g className="yp-tail">
          {_TAIL_PX.map(([c, r]) => px(c, r, `t${r}-${c}`))}
        </g>
      </svg>
    </>
  );
}

// Join YorkPulse card — cat peeks from top-right, plays 2.6s, bubble appears after
function JoinYorkPulseCard() {
  const [phase, setPhase] = useState<"entering" | "playing" | "done">("entering");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("playing"), 650);
    const t2 = setTimeout(() => setPhase("done"), 3300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const catAnimate =
    phase === "entering" ? { y: 0, rotate: 0 } :
    phase === "playing"  ? { y: [0, -18, 3, -13, 3, -8, 0], rotate: [0, -6, 5, -4, 3, -1, 0] } :
                           { y: 0, rotate: 0 };

  const catTransition =
    phase === "entering" ? { type: "spring" as const, stiffness: 260, damping: 20 } :
    phase === "playing"  ? { duration: 2.65, ease: "easeInOut" as const, times: [0, 0.1, 0.28, 0.46, 0.64, 0.82, 1] } :
                           { type: "spring" as const, stiffness: 180, damping: 18 };

  return (
    <div className="relative mt-[120px] rounded-lg bg-white border border-gray-100 shadow-sm">
      {/* Cat + bubble container — anchored to top-right of card */}
      <div
        className="absolute pointer-events-none select-none"
        style={{
          right: 2,
          top: -CAT_PX_H,
          width: CAT_PX_W,
          height: CAT_PX_H,
          overflow: phase === "entering" ? "hidden" : "visible",
          zIndex: 10,
        }}
      >
        {/* Speech bubble — only appears after play sequence ends */}
        <AnimatePresence>
          {phase === "done" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.6, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 440, damping: 20 }}
              style={{ position: "absolute", top: -46, right: 0 }}
            >
              <div
                className={`${pressStart2P.className} bg-white rounded-xl px-3 py-2.5 text-[7px] text-gray-800 whitespace-nowrap`}
                style={{ border: "1px solid #e5e7eb", boxShadow: "0 2px 10px rgba(0,0,0,0.08)" }}
              >
                wassup dawg?!
              </div>
              {/* Triangle tail — bottom-left of bubble */}
              <div style={{ position: "absolute", bottom: -9, left: 10, width: 0, height: 0, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: "9px solid #e5e7eb" }} />
              <div style={{ position: "absolute", bottom: -7, left: 11, width: 0, height: 0, borderLeft: "7px solid transparent", borderRight: "7px solid transparent", borderTop: "7px solid white" }} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cat — slides up from behind card bottom edge */}
        <motion.div initial={{ y: CAT_PX_H }} animate={catAnimate} transition={catTransition}>
          <PixelCatSVG />
        </motion.div>
      </div>

      {/* Card text — right padding keeps text clear of cat */}
      <div className="flex items-center gap-3 p-3 pr-[112px]">
        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">YP</span>
        </div>
        <div>
          <p className="font-semibold text-sm">Join YorkPulse</p>
          <p className="text-xs text-gray-400">The community platform for York University students</p>
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

const features = [
  {
    icon: Shield,
    title: "The Vault",
    description: "Anonymous forum for real talk",
  },
  {
    icon: ShoppingBag,
    title: "Marketplace",
    description: "Buy & sell with verified students",
  },
  {
    icon: Users,
    title: "Side Quests",
    description: "Find buddies for any activity",
  },
  {
    icon: GraduationCap,
    title: "Link Up",
    description: "7706 courses & residence chats",
  },
];

type Step = "email" | "otp";

function SignupPageInner() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [emailError, setEmailError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [hp, setHp] = useState("");

  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Pre-fill email if redirected from login page
  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) setEmail(emailParam);
  }, []);
  const signupMutation = useSignup();
  const verifyOTPMutation = useVerifyOTP();
  const resendOTPMutation = useResendOTP();

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // Validate York email
  const validateEmail = useCallback((value: string): boolean => {
    const emailLower = value.toLowerCase();
    const isYorkEmail = emailLower.endsWith("@yorku.ca") || emailLower.endsWith("@my.yorku.ca") || emailLower === "yorkpulse.app@gmail.com";

    if (!isYorkEmail) {
      setEmailError("YorkPulse is exclusively for York University. Please use your @yorku.ca or @my.yorku.ca email.");
      return false;
    }
    setEmailError("");
    return true;
  }, []);

  // Handle email submission
  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      return;
    }

    // Switch to OTP page immediately — don't block on API round-trip
    setStep("otp");
    setCooldown(60);

    signupMutation.mutate({ email, hp }, {
      onError: (error) => {
        // Revert if the request actually failed
        setStep("email");
        setCooldown(0);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to create account",
          variant: "destructive",
        });
      },
    });
  };

  // Handle OTP verification
  const handleOTPSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (otp.length !== 6) {
      toast({
        title: "Invalid code",
        description: "Please enter the complete 6-digit code",
        variant: "destructive",
      });
      return;
    }

    try {
      await verifyOTPMutation.mutateAsync({ email, code: otp });

      toast({
        title: "Welcome to YorkPulse!",
        description: "Your account has been created successfully.",
      });

      router.push("/auth/setup");
    } catch (error) {
      setOtp("");
      toast({
        title: "Verification failed",
        description: error instanceof Error ? error.message : "Invalid or expired code",
        variant: "destructive",
      });
    }
  };

  // Handle resend OTP
  const handleResend = async () => {
    if (cooldown > 0) return;

    try {
      await resendOTPMutation.mutateAsync({ email, hp });
      setCooldown(60);
      setOtp("");
      toast({
        title: "Code resent",
        description: "A new verification code has been sent to your email.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to resend code",
        variant: "destructive",
      });
    }
  };

  // Auto-submit when OTP is complete
  useEffect(() => {
    if (otp.length === 6 && step === "otp") {
      handleOTPSubmit();
    }
  }, [otp]); // eslint-disable-line react-hooks/exhaustive-deps

  // Go back to email step
  const handleBack = () => {
    setStep("email");
    setOtp("");
  };

  return (
    <AnimatePresence mode="wait">
      {step === "email" ? (
        <motion.div
          key="email"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-6"
        >
          {/* Join YorkPulse card with animated pixel cat */}
          <JoinYorkPulseCard />

          {/* Features */}
          <div className="grid gap-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-100 shadow-sm"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{feature.title}</p>
                  <p className="text-xs text-gray-400">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <HoneypotField value={hp} onChange={setHp} />
            <div className="space-y-2">
              <Label htmlFor="email">York Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your.name@my.yorku.ca"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) validateEmail(e.target.value);
                  }}
                  onBlur={() => email && validateEmail(email)}
                  className={`pl-10 ${emailError ? "border-red-500 focus:border-red-500" : ""}`}
                  required
                />
              </div>
              {emailError ? (
                <p className="text-xs text-red-700">{emailError}</p>
              ) : (
                <p className="text-xs text-gray-400">
                  We&apos;ll send you a 6-digit verification code
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-york-red-dark"
              disabled={signupMutation.isPending || !!emailError}
            >
              {signupMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending code...
                </>
              ) : (
                <>
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>

          <p className="text-center text-xs text-gray-400">
            By signing up, you agree to our{" "}
            <Link href="/terms" className="underline hover:text-gray-500">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-gray-500">
              Privacy Policy
            </Link>
          </p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.8, duration: 0.5, ease: "easeOut" }}
            className="flex items-start gap-2.5 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5"
          >
            <AlertCircle className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-gray-400 leading-relaxed">
              Having trouble? Write to us at{" "}
              <a
                href="mailto:yorkpulse.app@gmail.com"
                className="text-gray-500 underline underline-offset-2 hover:text-gray-700 transition-colors"
              >
                yorkpulse.app@gmail.com
              </a>
            </p>
          </motion.div>
        </motion.div>
      ) : (
        <motion.div
          key="otp"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="space-y-6"
        >
          {/* Back button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Verify your email</h1>
            <p className="text-gray-500">
              We sent a verification code to
            </p>
            <p className="text-primary font-medium">{email}</p>
          </div>

          <form onSubmit={handleOTPSubmit} className="space-y-6">
            <div className="space-y-4">
              <Label className="text-center block">Enter verification code</Label>
              <OTPInput
                value={otp}
                onChange={setOtp}
                disabled={verifyOTPMutation.isPending}
                autoFocus
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-york-red-dark"
              disabled={verifyOTPMutation.isPending || otp.length !== 6}
            >
              {verifyOTPMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Create Account
                </>
              )}
            </Button>
          </form>

          {/* Resend section */}
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-400">
              Didn&apos;t receive the code?
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResend}
              disabled={cooldown > 0 || resendOTPMutation.isPending}
              className="text-primary hover:text-primary"
            >
              {resendOTPMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </Button>
          </div>

          <p className="text-xs text-center text-gray-400">
            The code expires in 10 minutes
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupPageInner />
    </Suspense>
  );
}
