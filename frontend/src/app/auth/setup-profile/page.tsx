"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Upload,
  Loader2,
  CheckCircle,
  Camera,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useVerifyName, useVerifyId } from "@/hooks/useAuth";
import { api } from "@/services/api";
import { cn } from "@/lib/utils";
import { usePushNotifications } from "@/hooks/usePushNotifications";

type Step = "name" | "upload" | "verifying" | "success" | "notify";

export default function SetupProfilePage() {
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { toast } = useToast();
  const { subscribe, isSupported } = usePushNotifications();

  const verifyNameMutation = useVerifyName();
  const verifyIdMutation = useVerifyId();

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your full name as it appears on your student ID",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await verifyNameMutation.mutateAsync(name);

      if (result.name_verified) {
        // Name matched email pattern - auto verified
        if (isSupported && Notification.permission === "default") {
          setStep("notify");
        } else {
          setStep("success");
          setTimeout(() => router.push("/auth/complete-profile"), 2000);
        }
      } else if (result.requires_id_upload) {
        // Need to upload ID for verification
        setStep("upload");
      } else {
        // Fallback to upload step
        setStep("upload");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to verify name",
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please upload an image file (JPG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Get presigned URL
      const { upload_url, file_url } = await api.auth.getPresignedUrl(file.type);

      // Upload to S3
      await fetch(upload_url, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      
      // Verify the ID
      setStep("verifying");

      const result = await verifyIdMutation.mutateAsync({
        imageUrl: file_url,
        providedName: name,
      });

      if (result.verified) {
        if (isSupported && Notification.permission === "default") {
          setStep("notify");
        } else {
          setStep("success");
          setTimeout(() => router.push("/auth/complete-profile"), 2000);
        }
      } else {
        setStep("upload");
        toast({
          title: "Verification failed",
          description: result.message || "The name on your ID does not match. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      setStep("upload");
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2">
        {["name", "upload", "success"].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                step === s || (step === "verifying" && s === "upload")
                  ? "bg-purple-500 text-white"
                  : step === "success" || (s === "name" && step !== "name")
                  ? "bg-green-500 text-white"
                  : "bg-gray-100 text-gray-400"
              )}
            >
              {(s === "name" && step !== "name") || step === "success" ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                i + 1
              )}
            </div>
            {i < 2 && (
              <div
                className={cn(
                  "w-8 h-0.5 transition-colors",
                  (s === "name" && step !== "name") || step === "success"
                    ? "bg-green-500"
                    : "bg-gray-100"
                )}
              />
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === "name" && (
          <motion.div
            key="name"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center space-y-2">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">What is your name?</h1>
              <p className="text-gray-500">
                Enter your full name as it appears on your student ID
              </p>
            </div>

            <form onSubmit={handleNameSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="John Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-york-red-dark"
                disabled={verifyNameMutation.isPending}
              >
                {verifyNameMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-200/80">
                  Your name will be permanently visible to other users and cannot be changed after verification.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {step === "upload" && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center space-y-2">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Camera className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">Verify your identity</h1>
              <p className="text-gray-500">
                Upload a photo of your York student ID to verify your name
              </p>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
                isUploading
                  ? "border-primary/30 bg-primary/10"
                  : "border-gray-200 hover:border-primary/30 hover:bg-gray-50"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isUploading}
              />

              {isUploading ? (
                <div className="space-y-2">
                  <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin" />
                  <p className="text-sm text-gray-500">Uploading...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 mx-auto text-gray-400" />
                  <p className="text-sm font-medium">Click to upload your student ID</p>
                  <p className="text-xs text-gray-400">JPG, PNG up to 10MB</p>
                </div>
              )}
            </div>

            <div className="space-y-2 text-xs text-gray-400">
              <p>Make sure your photo clearly shows:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Your full name</li>
                <li>York University branding</li>
                <li>Good lighting, no blur</li>
              </ul>
            </div>

            <Button
              variant="ghost"
              onClick={() => setStep("name")}
              className="w-full"
            >
              Go back
            </Button>
          </motion.div>
        )}

        {step === "verifying" && (
          <motion.div
            key="verifying"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6 text-center"
          >
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">Verifying your ID...</h1>
              <p className="text-gray-500">
                Our AI is checking your student ID. This usually takes a few seconds.
              </p>
            </div>
          </motion.div>
        )}

        {step === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6 text-center"
          >
            <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-700" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">Name Verified!</h1>
              <p className="text-gray-500">
                Great, <span className="text-white font-medium">{name}</span>! Just one more step...
              </p>
            </div>
            <p className="text-sm text-gray-400">Setting up your profile...</p>
          </motion.div>
        )}

        {step === "notify" && (
          <motion.div
            key="notify"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6 text-center"
          >
            <div className="w-16 h-16 mx-auto rounded-full bg-blue-500/20 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-blue-700" />
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
                  setStep("success");
                  setTimeout(() => router.push("/auth/complete-profile"), 1500);
                }}
                className="bg-primary hover:bg-york-red-dark"
              >
                Enable Notifications
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setStep("success");
                  setTimeout(() => router.push("/auth/complete-profile"), 500);
                }}
              >
                Skip
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
