"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  MapPin,
  Clock,
  Star,
  CheckCircle,
  GraduationCap,
  Package,
  Monitor,
  ShoppingBag,
  Palette,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMyGigs } from "@/hooks/useGigs";
import { useAuthStore } from "@/stores/auth";
import { cn } from "@/lib/utils";
import type { GigCategory, GigLocation, Gig, GigResponse } from "@/types";

const categoryConfig: Record<GigCategory, { label: string; icon: typeof GraduationCap; emoji: string }> = {
  academic: { label: "Academic", icon: GraduationCap, emoji: "🎓" },
  moving: { label: "Moving", icon: Package, emoji: "📦" },
  tech_help: { label: "Tech Help", icon: Monitor, emoji: "💻" },
  errands: { label: "Errands", icon: ShoppingBag, emoji: "🏃" },
  creative: { label: "Creative", icon: Palette, emoji: "🎨" },
  other: { label: "Other", icon: MoreHorizontal, emoji: "🔧" },
};

const locationLabels: Record<GigLocation, string> = {
  on_campus: "On Campus",
  off_campus: "Off Campus",
  online: "Online",
};

function formatPrice(gig: Gig): string {
  if (gig.price_type === "negotiable") return "💬 Negotiable";
  if (!gig.price_min && !gig.price_max) return "💬 Negotiable";

  const suffix = gig.price_type === "hourly" ? "/hr" : "";

  if (gig.price_min && gig.price_max && gig.price_min !== gig.price_max) {
    return `$${gig.price_min}-${gig.price_max}${suffix}`;
  }

  const price = gig.price_min || gig.price_max;
  return `$${price}${suffix}`;
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function GigCard({ gig }: { gig: Gig }) {
  const cat = categoryConfig[gig.category];
  const isOffering = gig.gig_type === "offering";

  return (
    <Link href={`/gigs/${gig.id}`}>
      <motion.div
        whileHover={{ scale: 1.02 }}
        className={cn(
          "p-4 rounded-xl bg-white border border-gray-100 shadow-sm transition-colors cursor-pointer",
          isOffering
            ? "border-green-500/20 hover:border-green-500/40"
            : "border-orange-500/20 hover:border-orange-500/40"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className={cn(
                "text-xs",
                isOffering ? "bg-green-500/20 text-green-700" : "bg-orange-500/20 text-orange-700"
              )}
            >
              <cat.icon />{cat.label}
            </Badge>
            <Badge
              variant="secondary"
              className={cn(
                "text-xs",
                gig.status === "active" && "bg-green-500/20 text-green-700",
                gig.status === "in_progress" && "bg-blue-500/20 text-blue-700",
                gig.status === "completed" && "bg-zinc-500/20 text-gray-500"
              )}
            >
              {gig.status.replace("_", " ")}
            </Badge>
          </div>
          <span className={cn(
            "font-semibold text-sm",
            isOffering ? "text-green-700" : "text-orange-700"
          )}>
            {formatPrice(gig)}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-white mb-2 line-clamp-2">{gig.title}</h3>

        {/* Meta */}
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {gig.response_count > 0 && (
            <span>{gig.response_count} response{gig.response_count !== 1 ? "s" : ""}</span>
          )}
          <span>{gig.view_count} views</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {timeAgo(gig.created_at)}
          </span>
        </div>
      </motion.div>
    </Link>
  );
}

function ResponseCard({ response }: { response: GigResponse }) {
  return (
    <div
      className={cn(
        "p-4 rounded-xl bg-white border border-gray-100 shadow-sm",
        response.status === "pending"
          ? "border-yellow-500/20"
          : response.status === "accepted"
          ? "border-green-500/20"
          : "border-zinc-500/20"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs text-gray-400 mb-1">Responded to</p>
          <Link href={`/gigs/${response.gig_id}`} className="font-medium hover:text-purple-700 transition-colors">
            View Gig →
          </Link>
        </div>
        <Badge
          variant="secondary"
          className={cn(
            "text-xs",
            response.status === "pending" && "bg-yellow-500/20 text-yellow-800",
            response.status === "accepted" && "bg-green-500/20 text-green-700",
            response.status === "rejected" && "bg-red-500/20 text-red-700",
            response.status === "completed" && "bg-zinc-500/20 text-gray-500"
          )}
        >
          {response.status}
        </Badge>
      </div>

      {response.message && (
        <p className="text-sm text-gray-500 line-clamp-2 mb-2">{response.message}</p>
      )}

      {response.proposed_price && (
        <p className="text-sm text-green-700 mb-2">
          Proposed: ${response.proposed_price}
        </p>
      )}

      <p className="text-xs text-gray-400 flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {timeAgo(response.created_at)}
      </p>
    </div>
  );
}

export default function MyGigsPage() {
  const [tab, setTab] = useState("posted");
  const { isAuthenticated } = useAuthStore();
  const { data, isLoading } = useMyGigs("all");

  const postedGigs = data?.posted || [];
  const respondedGigs = data?.responded || [];

  // Auth guard
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">My Gigs</h1>
          <p className="text-gray-500 text-sm">Manage your gigs and responses</p>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-yellow-500/10 flex items-center justify-center mb-6">
            <GraduationCap className="w-10 h-10 text-yellow-800" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Sign in to view your gigs</h2>
          <p className="text-gray-400 mb-6 max-w-md">
            Manage your gig postings and responses.
          </p>
          <Link href="/auth/login">
            <Button className="bg-yellow-500 hover:bg-yellow-600 text-black">
              Sign In to Continue
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      {/* Back Button */}
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href="/gigs">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Link>
      </Button>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Gigs</h1>
          <p className="text-gray-500 text-sm">Manage your gigs and responses</p>
        </div>
        <Button asChild className="bg-green-600 hover:bg-green-700">
          <Link href="/gigs/create">
            <Plus className="w-4 h-4 mr-2" />
            New Gig
          </Link>
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full mb-6">
          <TabsTrigger value="posted" className="flex-1">
            Posted ({postedGigs.length})
          </TabsTrigger>
          <TabsTrigger value="responded" className="flex-1">
            Responded ({respondedGigs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posted">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </div>
          ) : postedGigs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 mb-4">You haven&apos;t posted any gigs yet</p>
              <Button asChild>
                <Link href="/gigs/create">Post your first gig</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {postedGigs.map((gig) => (
                <GigCard key={gig.id} gig={gig} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="responded">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </div>
          ) : respondedGigs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 mb-4">You haven&apos;t responded to any gigs yet</p>
              <Button asChild variant="outline">
                <Link href="/gigs">Browse gigs</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {respondedGigs.map((response) => (
                <ResponseCard key={response.id} response={response} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
