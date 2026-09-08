"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ShoppingBag,
  Users,
  MessageCircle,
  GraduationCap,
  ChevronDown,
  Sparkles,
  Lock,
  ArrowRight,
  CheckCircle2,
  MessageSquarePlus,
  Bug,
  Lightbulb,
  AlertCircle,
  HelpCircle,
  Send,
  Loader2,
  Briefcase,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/services/api";
import { cn } from "@/lib/utils";

// Landing page features (for non-authenticated users)
const landingFeatures = [
  {
    href: "/vault",
    icon: Shield,
    title: "The Vault",
    description: "Anonymous discussions. No tracking, no judgment.",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    accentBorder: "border-t-primary",
  },
  {
    href: "/marketplace",
    icon: ShoppingBag,
    title: "Marketplace",
    description: "Buy and sell with verified students only.",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    accentBorder: "border-t-blue-500",
  },
  {
    href: "/quests",
    icon: Users,
    title: "Side Quests",
    description: "Find gym partners, study buddies, and more.",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    accentBorder: "border-t-emerald-500",
  },
  {
    href: "/messages",
    icon: MessageCircle,
    title: "Messaging",
    description: "Request-based DMs. You control who can reach you.",
    iconBg: "bg-cyan-50",
    iconColor: "text-cyan-600",
    accentBorder: "border-t-cyan-500",
  },
  {
    href: "/courses",
    icon: GraduationCap,
    title: "Link Up",
    description: "Join course chats and connect with classmates.",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    accentBorder: "border-t-violet-500",
  },
  {
    href: "/gigs",
    icon: Briefcase,
    title: "Quick Gigs",
    description: "Find or offer services within the York community.",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    accentBorder: "border-t-amber-500",
  },
];

// Dashboard features (for authenticated users)
const dashboardFeatures = [
  {
    href: "/vault",
    icon: Shield,
    title: "The Vault",
    subtitle: "Anonymous Forum",
    description: "Share thoughts anonymously. Vent, confess, or discuss sensitive topics without judgment.",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    statKey: "vault_posts_today" as const,
    statLabel: "posts today",
    statColor: "text-primary",
  },
  {
    href: "/marketplace",
    icon: ShoppingBag,
    title: "Marketplace",
    subtitle: "Buy & Sell",
    description: "Trade textbooks, furniture, and electronics with verified York students.",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    statKey: "marketplace_listings" as const,
    statLabel: "active listings",
    statColor: "text-blue-600",
  },
  {
    href: "/quests",
    icon: Users,
    title: "Side Quests",
    subtitle: "Find Partners",
    description: "Connect for gym sessions, study groups, coffee meetups, or campus events.",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    statKey: "side_quests_active" as const,
    statLabel: "active quests",
    statColor: "text-emerald-600",
  },
  {
    href: "/courses",
    icon: GraduationCap,
    title: "Link Up",
    subtitle: "Class & Residence Discussions",
    description: "Join course-specific rooms for study groups and Q&A, plus a dedicated chat for on-campus residence.",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    statKey: "total_courses" as const,
    statLabel: "courses",
    statColor: "text-violet-600",
  },
  {
    href: "/messages",
    icon: MessageCircle,
    title: "Messages",
    subtitle: "Direct Messages",
    description: "Private conversations with other students in your York community.",
    iconBg: "bg-cyan-50",
    iconColor: "text-cyan-600",
    statKey: "total_users" as const,
    statLabel: "students",
    statColor: "text-cyan-600",
  },
  {
    href: "/gigs",
    icon: Briefcase,
    title: "Quick Gigs",
    subtitle: "Find or Offer Help",
    description: "Find help or offer your services to verified York University students.",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    statKey: "active_gigs" as const,
    statLabel: "active gigs",
    statColor: "text-amber-600",
  },
];

const comingSoonFeatures = [
  {
    icon: Sparkles,
    title: "Events",
    description: "Discover campus happenings",
  },
];

const quickStartSteps = [
  { step: 1, title: "Complete your profile", description: "Add interests and bio", href: "/profile" },
  { step: 2, title: "Join your courses", description: "Find and join class chats", href: "/courses" },
  { step: 3, title: "Browse Marketplace", description: "Find deals on textbooks", href: "/marketplace" },
  { step: 4, title: "Post in The Vault", description: "Share anonymously", href: "/vault" },
  { step: 5, title: "Find activity partners", description: "Join or create quests", href: "/quests" },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4 },
  },
};

// Feature Card for Dashboard
function FeatureCard({
  feature,
  stats,
}: {
  feature: (typeof dashboardFeatures)[0];
  stats?: {
    marketplace_listings: number;
    side_quests_active: number;
    total_courses: number;
    vault_posts_today: number;
    total_users: number;
    active_gigs: number;
  };
}) {
  const statValue = stats?.[feature.statKey];
  const Icon = feature.icon;

  return (
    <Link href={feature.href}>
      <motion.div
        whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}
        whileTap={{ scale: 0.99 }}
        transition={{ duration: 0.2 }}
        className="group h-full rounded-xl p-5 cursor-pointer bg-white border border-gray-100 shadow-sm transition-all duration-200"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className={cn("p-2.5 rounded-lg", feature.iconBg)}>
            <Icon className={cn("w-5 h-5", feature.iconColor)} />
          </div>
          {statValue !== undefined && (
            <div className="text-right">
              <p className={cn("text-xl font-bold", feature.statColor)}>
                {statValue.toLocaleString()}
              </p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
                {feature.statLabel}
              </p>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="space-y-0.5 mb-2">
          <h3 className="text-sm font-semibold text-gray-900">{feature.title}</h3>
          <p className="text-xs text-gray-400">{feature.subtitle}</p>
        </div>
        <p className="text-sm text-gray-500 leading-relaxed mb-4">{feature.description}</p>

        {/* Open link */}
        <div className="flex items-center gap-1.5 text-sm text-gray-400 group-hover:text-primary transition-colors">
          <span>Open</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </motion.div>
    </Link>
  );
}

// Quick Start Guide
function QuickStartGuide() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-sm font-medium text-gray-700">Getting Started Guide</span>
        </div>
        <ChevronDown
          className={cn("w-4 h-4 text-gray-400 transition-transform duration-200", isOpen && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-gray-100"
          >
            <div className="p-4 space-y-1">
              {quickStartSteps.map((step, index) => (
                <Link key={step.step} href={step.href}>
                  <motion.div
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-gray-500 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      {step.step}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors truncate">
                        {step.title}
                      </h4>
                      <p className="text-xs text-gray-400 truncate">{step.description}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </motion.div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Safety Banner
function SafetyBanner() {
  return (
    <div className="flex items-center justify-center gap-2 text-xs text-gray-400 py-6 border-t border-gray-100">
      <Lock className="w-3 h-3" />
      <span>
        Your privacy is protected.{" "}
        <Link href="/privacy" className="text-primary hover:underline underline-offset-2">
          Learn more
        </Link>
      </span>
    </div>
  );
}

const feedbackTypes = [
  { value: "suggestion" as const, label: "Suggestion", icon: Lightbulb, color: "text-amber-500" },
  { value: "bug" as const, label: "Bug Report", icon: Bug, color: "text-red-500" },
  { value: "problem" as const, label: "Problem", icon: AlertCircle, color: "text-orange-500" },
  { value: "other" as const, label: "Other", icon: HelpCircle, color: "text-blue-500" },
];

// Feedback Form
function FeedbackForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<"suggestion" | "bug" | "problem" | "other">("suggestion");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (window.location.hash === "#send-feedback") {
      setIsOpen(true);
      setTimeout(() => {
        document.getElementById("send-feedback")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, []);

  const submitMutation = useMutation({
    mutationFn: () => api.feedback.submit({ type, subject, message }),
    onSuccess: (data) => {
      toast({ title: "Feedback Submitted", description: data.message });
      setSubject("");
      setMessage("");
      setType("suggestion");
      setIsOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to submit feedback", variant: "destructive" });
    },
  });

  const isValid = subject.trim().length >= 5 && message.trim().length >= 20;

  return (
    <div id="send-feedback" className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <MessageSquarePlus className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-medium text-gray-700">Send Feedback</span>
        </div>
        <ChevronDown
          className={cn("w-4 h-4 text-gray-400 transition-transform duration-200", isOpen && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-gray-100"
          >
            <div className="p-4 space-y-4">
              {/* Feedback Type */}
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">Type</Label>
                <div className="grid grid-cols-4 gap-2">
                  {feedbackTypes.map((ft) => (
                    <button
                      key={ft.value}
                      onClick={() => setType(ft.value)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-lg border transition-all text-xs",
                        type === ft.value
                          ? "border-primary/40 bg-primary/5 text-gray-900"
                          : "border-gray-200 hover:border-gray-300 text-gray-500"
                      )}
                    >
                      <ft.icon className={cn("w-4 h-4", type === ft.value ? ft.color : "text-gray-400")} />
                      <span>{ft.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <Label htmlFor="feedback-subject" className="text-xs text-gray-500">Subject</Label>
                <Input
                  id="feedback-subject"
                  placeholder="Brief summary..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={200}
                  className="h-9 text-sm"
                />
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <Label htmlFor="feedback-message" className="text-xs text-gray-500">Details</Label>
                <Textarea
                  id="feedback-message"
                  placeholder="Describe in detail..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={2000}
                  className="min-h-[100px] text-sm resize-none"
                />
              </div>

              {/* Submit */}
              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-gray-400">
                  {subject.length >= 5 && message.length >= 20 ? (
                    <span className="text-emerald-600">Ready to submit</span>
                  ) : (
                    "Min: 5 char subject, 20 char message"
                  )}
                </p>
                <Button
                  onClick={() => submitMutation.mutate()}
                  disabled={!isValid || submitMutation.isPending}
                  size="sm"
                  className="bg-primary hover:bg-york-red-dark h-8 px-3 text-xs"
                >
                  {submitMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      Submit
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Dashboard View (authenticated users)
function DashboardView() {
  const { user } = useAuthStore();

  const { data: stats } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: () => api.dashboard.getStats(),
    staleTime: 60000,
  });

  const firstName = user?.name?.split(" ")[0] || "there";

  const topRowFeatures = dashboardFeatures.slice(0, 3);
  const bottomRowFeatures = dashboardFeatures.slice(3);

  return (
    <main className="min-h-screen bg-gray-50 pt-16">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-semibold text-gray-900">Hi, {firstName}</h1>
          <div className="w-10 h-1 bg-primary rounded-full mt-2" />
        </motion.div>

        {/* Top Row */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid gap-4 grid-cols-1 md:grid-cols-3 mb-4"
        >
          {topRowFeatures.map((feature) => (
            <motion.div key={feature.href} variants={itemVariants}>
              <FeatureCard feature={feature} stats={stats} />
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom Row */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid gap-4 grid-cols-1 md:grid-cols-3 mb-10"
        >
          {bottomRowFeatures.map((feature) => (
            <motion.div key={feature.href} variants={itemVariants}>
              <FeatureCard feature={feature} stats={stats} />
            </motion.div>
          ))}
        </motion.div>

        {/* Coming Soon */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-5">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-medium text-gray-400 uppercase tracking-widest">Coming Soon</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
          <div className="flex justify-center">
            {comingSoonFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="rounded-xl p-6 text-center bg-white border border-gray-100 shadow-sm max-w-xs"
                >
                  <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-gray-50 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-gray-400" />
                  </div>
                  <h3 className="font-semibold text-gray-700 mb-1">{feature.title}</h3>
                  <p className="text-sm text-gray-400">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Collapsible Sections */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="space-y-3 mb-8"
        >
          <QuickStartGuide />
          <FeedbackForm />
        </motion.div>

        <SafetyBanner />
      </div>
    </main>
  );
}

// York U campus images for hero carousel
const heroImages = [
  "/images/vari-drone.jpg",
  "/images/york-u-new-student-centre-2-cannon-design-1300x700-1.jpg",
  "/images/bergeron5-1024x683.jpg",
  "/images/library_atrium3-1.jpg",
];

const YORKU_LOGO = "/images/download.png";

// Landing View (non-authenticated users)
function LandingView() {
  const [imgIndex, setImgIndex] = useState(0);

  // Cycle background image every 6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setImgIndex((i) => (i + 1) % heroImages.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  return (
    <main className="min-h-screen bg-white">
      {/* ── Hero Section with campus background ── */}
      <div className="relative overflow-hidden" style={{ minHeight: "92vh" }}>

        {/* Campus background images — crossfade */}
        {heroImages.map((src, i) => (
          <motion.div
            key={src}
            animate={{ opacity: i === imgIndex ? 1 : 0 }}
            transition={{ duration: 1.2 }}
            className="absolute inset-0"
            style={{ zIndex: 0 }}
          >
            <Image
              src={src}
              alt="York University campus"
              fill
              className="hero-bg-img"
              priority={i === 0}
              sizes="100vw"
            />
          </motion.div>
        ))}

        {/* Dark gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70" style={{ zIndex: 1 }} />

        {/* Content */}
        <div className="relative flex flex-col items-center justify-center text-center px-6 pt-32 pb-24 min-h-[92vh]" style={{ zIndex: 2 }}>

          {/* York U Official Logo Badge */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-8"
          >
            <div className="inline-flex items-center gap-3 bg-white rounded-2xl px-5 py-3 shadow-lg">
              <Image
                src={YORKU_LOGO}
                alt="York University"
                width={80}
                height={64}
                className="object-contain"
              />
              <div className="w-px h-8 bg-gray-200" />
              <span className="text-gray-600 text-sm font-medium tracking-wide">Student Community</span>
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white max-w-3xl"
          >
            Your Campus.{" "}
            <span className="text-[#ff4d6b]">Your Community.</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="mt-6 text-lg leading-8 text-white/75 max-w-xl"
          >
            The exclusive platform for York University students.
            Connect, trade, and build lasting friendships in a safe, verified community.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="mt-10 flex items-center gap-4"
          >
            <Button
              size="lg"
              className="bg-primary hover:bg-york-red-dark text-white px-8 shadow-lg text-base"
              asChild
            >
              <Link href="/auth/signup">Get Started</Link>
            </Button>
            <Button
              size="lg"
              className="bg-white/15 hover:bg-white/25 text-white border border-white/30 px-8 text-base backdrop-blur-sm"
              asChild
            >
              <Link href="/auth/login">Sign In</Link>
            </Button>
          </motion.div>

          {/* Verified badge */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-8 text-sm text-white/50"
          >
            Verified with <span className="text-white/80 font-medium">@yorku.ca</span> or{" "}
            <span className="text-white/80 font-medium">@my.yorku.ca</span> email
          </motion.p>

          {/* Image indicator dots */}
          <div className="absolute bottom-8 flex gap-2">
            {heroImages.map((_, i) => (
              <button
                key={i}
                onClick={() => setImgIndex(i)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all duration-300",
                  i === imgIndex ? "bg-white w-6" : "bg-white/40"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Feature Cards Section ── */}
      <div className="bg-gray-50 py-20 px-6">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="mx-auto max-w-5xl"
        >
          {/* Section heading */}
          <motion.div variants={itemVariants} className="text-center mb-12">
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Everything you need on campus</h2>
            <p className="mt-3 text-gray-500">Six features built specifically for York U students.</p>
          </motion.div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {landingFeatures.map((feature) => (
              <motion.div key={feature.href} variants={itemVariants} className="h-full">
                <Link href={feature.href} className="h-full block">
                  <motion.div
                    whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "bg-white p-6 h-full rounded-xl border-t-2 border border-gray-100 cursor-pointer transition-all duration-200 shadow-sm",
                      feature.accentBorder
                    )}
                  >
                    <div className={cn("mb-4 inline-flex rounded-lg p-2.5", feature.iconBg)}>
                      <feature.icon className={cn("h-5 w-5", feature.iconColor)} />
                    </div>
                    <h3 className="font-semibold text-gray-900">{feature.title}</h3>
                    <p className="mt-1.5 text-sm text-gray-500">{feature.description}</p>
                  </motion.div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </main>
  );
}

// Main Page Component
export default function Home() {
  const { isAuthenticated, isHydrated, setHydrated } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const timeout = setTimeout(() => {
      if (!useAuthStore.getState().isHydrated) {
        setHydrated();
      }
    }, 100);
    return () => clearTimeout(timeout);
  }, [setHydrated]);

  // Before hydration, show landing page so expired JWT users never see skeletons
  if (!mounted || !isHydrated) {
    return <LandingView />;
  }

  return isAuthenticated ? <DashboardView /> : <LandingView />;
}
