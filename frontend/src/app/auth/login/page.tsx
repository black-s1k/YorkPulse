"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, ArrowRight, ArrowLeft, Loader2, RefreshCw, CheckCircle, AlertCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OTPInput } from "@/components/ui/otp-input";
import { HoneypotField } from "@/components/ui/honeypot-field";
import { useToast } from "@/hooks/use-toast";
import { useLogin, useVerifyOTP, useResendOTP } from "@/hooks/useAuth";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/services/api";

const ADMIN_EMAIL = "yorkpulse.app@gmail.com";

type Step = "email" | "otp" | "password";

export default function LoginPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [hp, setHp] = useState("");

  const router = useRouter();
  const { toast } = useToast();
  const { setTokens } = useAuthStore();
  const loginMutation = useLogin();
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
      setEmailError("Please use your @yorku.ca or @my.yorku.ca email");
      return false;
    }
    setEmailError("");
    return true;
  }, []);

  // Handle email submission
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      return;
    }

    // Admin account uses password — no OTP sent
    if (email.toLowerCase() === ADMIN_EMAIL) {
      setStep("password");
      return;
    }

    try {
      await loginMutation.mutateAsync({ email, hp });
      setStep("otp");
      setCooldown(60);
    } catch (error: any) {
      const status = error?.response?.status ?? error?.status;
      if (status === 404) {
        router.push(`/auth/signup?email=${encodeURIComponent(email)}`);
      } else {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to send verification code",
          variant: "destructive",
        });
      }
    }
  };

  // Handle admin password login
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    try {
      const data = await api.auth.adminLogin(email, password);
      setTokens(data.access_token, data.refresh_token);
      router.push("/auth/setup");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Invalid password",
        variant: "destructive",
      });
    } finally {
      setPasswordLoading(false);
    }
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
        title: "Success",
        description: "Email verified successfully!",
      });

      router.push("/auth/setup");
    } catch (error) {
      setOtp(""); // Clear OTP on error
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
  }, [otp]);

  // Go back to email step
  const handleBack = () => {
    setStep("email");
    setOtp("");
    setPassword("");
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
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
            <p className="text-gray-500">
              Sign in to your YorkPulse account
            </p>
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
                <p className="text-xs text-red-600">{emailError}</p>
              ) : (
                <p className="text-xs text-gray-400">
                  We&apos;ll send you a 6-digit verification code
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-[#E31837] hover:bg-[#C41230]"
              disabled={loginMutation.isPending || !!emailError}
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending code...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-400">or</span>
            </div>
          </div>

          <p className="text-center text-sm text-gray-500">
            New to YorkPulse?{" "}
            <Link href="/auth/signup" className="text-[#E31837] hover:underline font-medium">
              Create an account
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
      ) : step === "otp" ? (
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
            <div className="w-16 h-16 mx-auto rounded-full bg-[#E31837]/10 flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 text-[#E31837]" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Check your email</h1>
            <p className="text-gray-500">
              We sent a verification code to
            </p>
            <p className="text-[#E31837] font-medium">{email}</p>
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
              className="w-full bg-[#E31837] hover:bg-[#C41230]"
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
                  Verify
                </>
              )}
            </Button>
          </form>

          {/* Resend section */}
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-500">
              Didn&apos;t receive the code?
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResend}
              disabled={cooldown > 0 || resendOTPMutation.isPending}
              className="text-[#E31837] hover:text-[#C41230] hover:bg-[#E31837]/5"
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
      ) : step === "password" ? (
        <motion.div
          key="password"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="space-y-6"
        >
          <Button variant="ghost" size="sm" onClick={handleBack} className="mb-2">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#E31837]/10 flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-[#E31837]" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Admin login</h1>
            <p className="text-[#E31837] font-medium">{email}</p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-[#E31837] hover:bg-[#C41230]"
              disabled={passwordLoading || !password}
            >
              {passwordLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in...</>
              ) : (
                <><CheckCircle className="w-4 h-4 mr-2" />Sign in</>
              )}
            </Button>
          </form>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
