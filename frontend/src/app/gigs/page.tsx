"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Search,
  Filter,
  Plus,
  GraduationCap,
  Package,
  Monitor,
  ShoppingBag,
  Palette,
  MoreHorizontal,
  MapPin,
  Star,
  CheckCircle,
  Clock,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useGigs } from "@/hooks/useGigs";
import { useAuthStore } from "@/stores/auth";
import { cn } from "@/lib/utils";
import type { GigType, GigCategory, GigLocation, Gig } from "@/types";

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
    <Link href={`/gigs/${gig.id}`} className="h-full block">
      <motion.div
        whileHover={{ scale: 1.02 }}
        className={cn(
          "h-full flex flex-col p-4 rounded-xl bg-white border transition-colors cursor-pointer",
          isOffering
            ? "border-green-500/20 hover:border-green-500/40"
            : "border-orange-500/20 hover:border-orange-500/40"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <Badge
            variant="secondary"
            className={cn(
              "text-xs",
              isOffering ? "bg-green-500/20 text-green-700" : "bg-orange-500/20 text-orange-700"
            )}
          >
            <cat.icon />
            {cat.label}
          </Badge>
          <span className={cn(
            "font-semibold text-sm",
            isOffering ? "text-green-700" : "text-orange-700"
          )}>
            {formatPrice(gig)}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-white mb-2 line-clamp-2">{gig.title}</h3>

        {/* Description */}
        <p className="text-sm text-gray-500 line-clamp-2 mb-3">{gig.description}</p>

        {/* Meta */}
        <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
          {gig.location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {locationLabels[gig.location]}
            </span>
          )}
          {gig.poster.gig_rating_avg > 0 && (
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
              {gig.poster.gig_rating_avg.toFixed(1)}
            </span>
          )}
          {gig.poster.gigs_completed > 0 && (
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-green-500" />
              {gig.poster.gigs_completed} gigs
            </span>
          )}
        </div>

        <div className="flex-1" />

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar className="w-6 h-6">
              <AvatarImage src={gig.poster.avatar_url || undefined} />
              <AvatarFallback className="text-xs bg-gray-100 text-gray-600">
                {gig.poster.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-gray-500">{gig.poster.name}</span>
          </div>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {timeAgo(gig.created_at)}
          </span>
        </div>
      </motion.div>
    </Link>
  );
}

export default function GigsPage() {
  const { isAuthenticated } = useAuthStore();
  const [gigType, setGigType] = useState<GigType | undefined>(undefined);
  const [category, setCategory] = useState<GigCategory | undefined>(undefined);
  const [location, setLocation] = useState<GigLocation | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"recent" | "price_low" | "price_high" | "highest_rated">("recent");

  const filters = useMemo(() => ({
    gig_type: gigType,
    category,
    location,
    search: search || undefined,
    sort,
    per_page: 20,
  }), [gigType, category, location, search, sort]);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useGigs(filters);

  const allGigs = data?.pages?.flatMap((page) => page.items) || [];

  // Auth guard
  if (!isAuthenticated) {
    return (
      <div className="px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-yellow-800" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Quick Gigs</h1>
            <p className="text-sm text-gray-400">Find help or offer your services</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-yellow-500/10 flex items-center justify-center mb-6">
            <GraduationCap className="w-10 h-10 text-yellow-800" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Sign in to access Quick Gigs</h2>
          <p className="text-gray-400 mb-6 max-w-md">
            Find help or offer your services to verified York University students.
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
    <div className="px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-yellow-800" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Quick Gigs</h1>
            <p className="text-sm text-gray-400">Find help or offer your services</p>
          </div>
        </div>
        <Button asChild className="bg-yellow-500 hover:bg-yellow-600 text-black">
          <Link href="/gigs/create">
            <Plus className="w-4 h-4 mr-2" />
            Post Gig
          </Link>
        </Button>
      </div>

      {/* Type Toggle */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={gigType === undefined ? "default" : "outline"}
          size="sm"
          onClick={() => setGigType(undefined)}
          className={gigType === undefined ? "bg-yellow-500 hover:bg-yellow-600 text-black" : ""}
        >
          All
        </Button>
        <Button
          variant={gigType === "offering" ? "default" : "outline"}
          size="sm"
          onClick={() => setGigType("offering")}
          className={gigType === "offering" ? "bg-yellow-500 hover:bg-yellow-600 text-black" : ""}
        >
          Offering
        </Button>
        <Button
          variant={gigType === "need_help" ? "default" : "outline"}
          size="sm"
          onClick={() => setGigType("need_help")}
          className={gigType === "need_help" ? "bg-orange-500 hover:bg-orange-600" : ""}
        >
          Need Help
        </Button>
      </div>

      {/* Category Tabs */}
      <div className="mb-4 -mx-4 px-4 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 pb-2">
          <button
            onClick={() => setCategory(undefined)}
            className={cn(
              "h-9 px-3 rounded-md text-xs font-medium whitespace-nowrap transition-all",
              category === undefined
                ? "bg-yellow-500 text-black"
                : "bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 border border-gray-100"
            )}
          >
            All
          </button>
          {Object.entries(categoryConfig).map(([key, config]) => (
            <button
              key={key}
              onClick={() => setCategory(key as GigCategory)}
              className={cn(
                "h-9 px-3 rounded-md text-xs font-medium whitespace-nowrap transition-all",
                category === key
                  ? "bg-yellow-500 text-black"
                  : "bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 border border-gray-100"
              )}
            >
              {config.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search gigs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-white border-gray-100"
          />
        </div>

        {/* Location Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MapPin className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setLocation(undefined)}>
              All Locations
            </DropdownMenuItem>
            {Object.entries(locationLabels).map(([key, label]) => (
              <DropdownMenuItem key={key} onClick={() => setLocation(key as GigLocation)}>
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-1">
              Sort
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setSort("recent")}>
              Most Recent
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSort("price_low")}>
              Price: Low to High
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSort("price_high")}>
              Price: High to Low
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSort("highest_rated")}>
              Highest Rated
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Active Filters */}
      {location && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <Badge variant="secondary" className="gap-1 bg-yellow-500/20 text-yellow-800 border-yellow-500/30">
            <MapPin className="w-3 h-3" />
            {locationLabels[location]}
            <button onClick={() => setLocation(undefined)} className="ml-1 hover:text-yellow-950">
              ×
            </button>
          </Badge>
        </div>
      )}

      {/* Gigs Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : allGigs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">No gigs found</p>
          {isAuthenticated && (
            <Button asChild>
              <Link href="/gigs/create">Post the first gig</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {allGigs.map((gig) => (
              <GigCard key={gig.id} gig={gig} />
            ))}
          </div>

          {/* Load More */}
          {hasNextPage && (
            <div className="text-center mt-6">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Load More
              </Button>
            </div>
          )}
        </>
      )}

      {/* Floating Create Button (Mobile) */}
      {isAuthenticated && (
        <Link
          href="/gigs/create"
          className="fixed bottom-20 right-4 md:hidden p-4 bg-green-600 hover:bg-green-700 rounded-full shadow-lg transition-colors"
        >
          <Plus className="w-6 h-6 text-white" />
        </Link>
      )}
    </div>
  );
}
