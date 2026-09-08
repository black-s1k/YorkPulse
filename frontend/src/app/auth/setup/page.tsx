"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { User, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth";
import { useUser, useUpdateProfile } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export default function SetupPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { isLoading } = useUser();
  const updateProfileMutation = useUpdateProfile();
  const { toast } = useToast();
  const [name, setName] = useState("");

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/auth/login");
    }
  }, [isLoading, isAuthenticated, router]);

  // Redirect if already has a real name
  useEffect(() => {
    if (!isLoading && user && user.name !== "York User") {
      router.replace("/");
    }
  }, [isLoading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await updateProfileMutation.mutateAsync({ name: name.trim() });
      router.replace("/");
    } catch (error) {
      toast({
        title: "Failed to save name",
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <User className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">What's your name?</h1>
        <p className="text-gray-500">
          This is how other York students will see you on YorkPulse.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            placeholder="e.g. Alex Chen"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <Button
          type="submit"
          className="w-full bg-primary hover:bg-york-red-dark"
          disabled={!name.trim() || updateProfileMutation.isPending}
        >
          {updateProfileMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <ArrowRight className="w-4 h-4 mr-2" />
          )}
          Continue
        </Button>
      </form>
    </motion.div>
  );
}
