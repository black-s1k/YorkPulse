"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  GraduationCap,
  Package,
  Monitor,
  ShoppingBag,
  Palette,
  MoreHorizontal,
  DollarSign,
  MapPin,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateGig } from "@/hooks/useGigs";
import { useAuthStore } from "@/stores/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { GigType, GigCategory, GigPriceType, GigLocation } from "@/types";

const categoryConfig: Record<GigCategory, { label: string; icon: typeof GraduationCap; emoji: string }> = {
  academic: { label: "Academic", icon: GraduationCap, emoji: "🎓" },
  moving: { label: "Moving", icon: Package, emoji: "📦" },
  tech_help: { label: "Tech Help", icon: Monitor, emoji: "💻" },
  errands: { label: "Errands", icon: ShoppingBag, emoji: "🏃" },
  creative: { label: "Creative", icon: Palette, emoji: "🎨" },
  other: { label: "Other", icon: MoreHorizontal, emoji: "🔧" },
};

export default function CreateGigPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isAuthenticated } = useAuthStore();
  const createMutation = useCreateGig();

  // Auth guard - redirect to login if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Post a Gig</h1>
          <p className="text-gray-500 text-sm">Offer your services or request help</p>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-yellow-500/10 flex items-center justify-center mb-6">
            <GraduationCap className="w-10 h-10 text-yellow-800" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Sign in to post a gig</h2>
          <p className="text-gray-400 mb-6 max-w-md">
            You need to be signed in to create a gig posting.
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

  const [gigType, setGigType] = useState<GigType>("offering");
  const [category, setCategory] = useState<GigCategory>("academic");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceType, setPriceType] = useState<GigPriceType>("fixed");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [locations, setLocations] = useState<GigLocation[]>(["on_campus"]);
  const [locationDetails, setLocationDetails] = useState("");
  const [deadline, setDeadline] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (title.length < 5) {
      toast({ title: "Title must be at least 5 characters", variant: "destructive" });
      return;
    }
    if (description.length < 20) {
      toast({ title: "Description must be at least 20 characters", variant: "destructive" });
      return;
    }
    if (locations.length === 0) {
      toast({ title: "Please select at least one location", variant: "destructive" });
      return;
    }

    try {
      const gig = await createMutation.mutateAsync({
        gig_type: gigType,
        category,
        title,
        description,
        price_type: priceType,
        price_min: priceMin ? parseFloat(priceMin) : undefined,
        price_max: priceMax ? parseFloat(priceMax) : undefined,
        location: locations[0],
        location_details: locationDetails || undefined,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
      });

      toast({ title: "Gig posted successfully!" });
      router.push(`/gigs/${gig.id}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create gig",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      {/* Back Button */}
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href="/gigs">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Link>
      </Button>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-xl bg-white border border-gray-100 shadow-sm"
      >
        <h1 className="text-2xl font-bold mb-6">Post a Gig</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Gig Type */}
          <div className="space-y-2">
            <Label>What type of gig is this?</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={gigType === "offering" ? "default" : "outline"}
                onClick={() => setGigType("offering")}
                className={cn(
                  "flex-1",
                  gigType === "offering" && "bg-green-600 hover:bg-green-700"
                )}
              >
                I&apos;m Offering
              </Button>
              <Button
                type="button"
                variant={gigType === "need_help" ? "default" : "outline"}
                onClick={() => setGigType("need_help")}
                className={cn(
                  "flex-1",
                  gigType === "need_help" && "bg-orange-600 hover:bg-orange-700"
                )}
              >
                I Need Help
              </Button>
            </div>
            <p className="text-xs text-gray-400">
              {gigType === "offering"
                ? "You're offering a service to others"
                : "You're looking for someone to help you"}
            </p>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(categoryConfig).map(([key, config]) => (
                <Button
                  key={key}
                  type="button"
                  variant={category === key ? "default" : "outline"}
                  onClick={() => setCategory(key as GigCategory)}
                  className={cn(
                    "flex flex-col h-auto py-3",
                    category === key && "bg-yellow-500 hover:bg-yellow-600 text-black"
                  )}
                >
                  <config.icon className="w-5 h-5 mb-1" />
                  <span className="text-xs">{config.label}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder={gigType === "offering" ? "EECS Tutoring - Data Structures" : "Need help moving this Friday"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              className="bg-white border-gray-100 focus-visible:ring-yellow-500 focus-visible:border-yellow-500"
            />
            <p className="text-xs text-gray-400">{title.length}/100</p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe what you're offering or what you need help with..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={4}
              className="bg-white border-gray-100 resize-none focus-visible:ring-yellow-500 focus-visible:border-yellow-500"
            />
            <p className="text-xs text-gray-400">{description.length}/1000</p>
          </div>

          {/* Pricing */}
          <div className="space-y-2">
            <Label>Pricing</Label>
            <div className="flex gap-2 mb-2">
              <Button
                type="button"
                size="sm"
                variant={priceType === "fixed" ? "default" : "outline"}
                onClick={() => setPriceType("fixed")}
                className={priceType === "fixed" ? "bg-yellow-500 hover:bg-yellow-600 text-black" : ""}
              >
                Fixed
              </Button>
              <Button
                type="button"
                size="sm"
                variant={priceType === "hourly" ? "default" : "outline"}
                onClick={() => setPriceType("hourly")}
                className={priceType === "hourly" ? "bg-yellow-500 hover:bg-yellow-600 text-black" : ""}
              >
                Hourly
              </Button>
              <Button
                type="button"
                size="sm"
                variant={priceType === "negotiable" ? "default" : "outline"}
                onClick={() => setPriceType("negotiable")}
                className={priceType === "negotiable" ? "bg-yellow-500 hover:bg-yellow-600 text-black" : ""}
              >
                Negotiable
              </Button>
            </div>
            {priceType !== "negotiable" && (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="number"
                    placeholder="Min"
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                    min="0"
                    step="0.01"
                    className="pl-8 bg-white border-gray-100 focus-visible:ring-yellow-500 focus-visible:border-yellow-500"
                  />
                </div>
                <div className="relative flex-1">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="number"
                    placeholder="Max (optional)"
                    value={priceMax}
                    onChange={(e) => setPriceMax(e.target.value)}
                    min="0"
                    step="0.01"
                    className="pl-8 bg-white border-gray-100 focus-visible:ring-yellow-500 focus-visible:border-yellow-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label>Location (select all that apply)</Label>
            <div className="flex gap-2 mb-2">
              <Button
                type="button"
                size="sm"
                variant={locations.includes("on_campus") ? "default" : "outline"}
                onClick={() => setLocations(prev =>
                  prev.includes("on_campus")
                    ? prev.filter(l => l !== "on_campus")
                    : [...prev, "on_campus"]
                )}
                className={locations.includes("on_campus") ? "bg-yellow-500 hover:bg-yellow-600 text-black" : ""}
              >
                <MapPin className="w-4 h-4 mr-1" />
                On Campus
              </Button>
              <Button
                type="button"
                size="sm"
                variant={locations.includes("off_campus") ? "default" : "outline"}
                onClick={() => setLocations(prev =>
                  prev.includes("off_campus")
                    ? prev.filter(l => l !== "off_campus")
                    : [...prev, "off_campus"]
                )}
                className={locations.includes("off_campus") ? "bg-yellow-500 hover:bg-yellow-600 text-black" : ""}
              >
                Off Campus
              </Button>
              <Button
                type="button"
                size="sm"
                variant={locations.includes("online") ? "default" : "outline"}
                onClick={() => setLocations(prev =>
                  prev.includes("online")
                    ? prev.filter(l => l !== "online")
                    : [...prev, "online"]
                )}
                className={locations.includes("online") ? "bg-yellow-500 hover:bg-yellow-600 text-black" : ""}
              >
                Online
              </Button>
            </div>
            <Input
              placeholder="Location details (e.g., Scott Library, Near Keele Station)"
              value={locationDetails}
              onChange={(e) => setLocationDetails(e.target.value)}
              maxLength={200}
              className="bg-white border-gray-100 focus-visible:ring-yellow-500 focus-visible:border-yellow-500"
            />
          </div>

          {/* Deadline (only for need_help) */}
          {gigType === "need_help" && (
            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline (optional)</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="deadline"
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="pl-10 bg-white border-gray-100 focus-visible:ring-yellow-500 focus-visible:border-yellow-500"
                />
              </div>
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            className={cn(
              "w-full",
              gigType === "offering"
                ? "bg-green-600 hover:bg-green-700"
                : "bg-orange-600 hover:bg-orange-700"
            )}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Post Gig
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
