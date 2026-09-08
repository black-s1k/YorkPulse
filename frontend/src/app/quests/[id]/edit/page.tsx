"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Dumbbell,
  BookOpen,
  Utensils,
  Car,
  Gamepad2,
  Plus,
  MapPin,
  Clock,
  Users,
  Zap,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQuest, useUpdateQuest } from "@/hooks/useQuests";
import { useAuthStore } from "@/stores/auth";
import { cn } from "@/lib/utils";
import { LocationPickerWrapper } from "@/components/LocationPickerWrapper";
import type { QuestCategory, VibeLevel } from "@/types";

const categories: { value: QuestCategory; label: string; icon: typeof Dumbbell; color: string }[] = [
  { value: "gym", label: "Gym", icon: Dumbbell, color: "bg-red-500/20 text-red-700 border-red-500/30" },
  { value: "food", label: "Food", icon: Utensils, color: "bg-orange-500/20 text-orange-700 border-orange-500/30" },
  { value: "study", label: "Study", icon: BookOpen, color: "bg-blue-500/20 text-blue-700 border-blue-500/30" },
  { value: "game", label: "Game", icon: Gamepad2, color: "bg-purple-500/20 text-purple-700 border-purple-500/30" },
  { value: "commute", label: "Commute", icon: Car, color: "bg-green-500/20 text-green-700 border-green-500/30" },
  { value: "custom", label: "Custom", icon: Plus, color: "bg-zinc-500/20 text-gray-500 border-zinc-500/30" },
];

const vibeLevels: { value: VibeLevel; label: string; emoji: string }[] = [
  { value: "chill", label: "Chill", emoji: "😌" },
  { value: "intermediate", label: "Intermediate", emoji: "👍" },
  { value: "high_energy", label: "High Energy", emoji: "⚡" },
  { value: "intense", label: "Intense", emoji: "🔥" },
  { value: "custom", label: "Custom", emoji: "✨" },
];

export default function EditQuestPage() {
  const params = useParams();
  const router = useRouter();
  const questId = params.id as string;
  const { user, isAuthenticated } = useAuthStore();
  const { toast } = useToast();

  const { data: quest, isLoading } = useQuest(questId);
  const updateMutation = useUpdateQuest();

  // Auth guard
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-green-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Edit Quest</h1>
            <p className="text-sm text-gray-400">Update your quest details</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mb-6">
            <Users className="w-10 h-10 text-green-700" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Sign in to edit quests</h2>
          <p className="text-gray-400 mb-6 max-w-md">
            You need to be signed in to edit your quests.
          </p>
          <Link href="/auth/login">
            <Button className="bg-green-600 hover:bg-green-700">
              Sign In to Continue
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Form state
  const [activity, setActivity] = useState("");
  const [description, setDescription] = useState("");
  const [locationData, setLocationData] = useState<{
    lat: number | null;
    lng: number | null;
    name: string;
  }>({ lat: null, lng: null, name: "" });
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [vibeLevel, setVibeLevel] = useState<VibeLevel>("chill");
  const [customVibeLevel, setCustomVibeLevel] = useState("");
  const [maxParticipants, setMaxParticipants] = useState(2);
  const [requiresApproval, setRequiresApproval] = useState(true);

  // Populate form when quest data loads
  useEffect(() => {
    if (quest) {
      setActivity(quest.activity);
      setDescription(quest.description || "");
      setLocationData({
        lat: quest.latitude || null,
        lng: quest.longitude || null,
        name: quest.location,
      });
      // Convert to local datetime format for input
      const startDate = new Date(quest.start_time);
      setStartTime(startDate.toISOString().slice(0, 16));
      if (quest.end_time) {
        const endDate = new Date(quest.end_time);
        setEndTime(endDate.toISOString().slice(0, 16));
      }
      setVibeLevel(quest.vibe_level);
      setCustomVibeLevel(quest.custom_vibe_level || "");
      setMaxParticipants(quest.max_participants);
      setRequiresApproval(quest.requires_approval);
    }
  }, [quest]);

  // Check if user is the host
  const isHost = quest?.host.id === user?.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!activity.trim()) {
      toast({
        title: "Activity required",
        description: "Please describe what you will be doing",
        variant: "destructive",
      });
      return;
    }

    if (!locationData.name.trim()) {
      toast({
        title: "Location required",
        description: "Please specify where this will take place",
        variant: "destructive",
      });
      return;
    }

    if (!startTime) {
      toast({
        title: "Time required",
        description: "Please select when this quest starts",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: questId,
        data: {
          activity: activity.trim(),
          description: description.trim() || undefined,
          location: locationData.name.trim(),
          latitude: locationData.lat || undefined,
          longitude: locationData.lng || undefined,
          start_time: new Date(startTime).toISOString(),
          end_time: endTime ? new Date(endTime).toISOString() : undefined,
          vibe_level: vibeLevel,
          max_participants: maxParticipants,
          requires_approval: requiresApproval,
        },
      });

      toast({
        title: "Quest updated",
        description: "Your changes have been saved",
      });

      router.push(`/quests/${questId}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update quest",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (!quest) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-xl font-semibold mb-2">Quest not found</h1>
        <p className="text-gray-400 mb-4">This quest may have been deleted or doesn't exist.</p>
        <Link href="/quests">
          <Button variant="outline">Back to Quests</Button>
        </Link>
      </div>
    );
  }

  if (!isHost) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-xl font-semibold mb-2">Not authorized</h1>
        <p className="text-gray-400 mb-4">Only the host can edit this quest.</p>
        <Link href={`/quests/${questId}`}>
          <Button variant="outline">Back to Quest</Button>
        </Link>
      </div>
    );
  }

  const catConfig = categories.find((c) => c.value === quest.category);

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/quests/${questId}`}>
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Edit Quest</h1>
          <p className="text-sm text-gray-400">Update your quest details</p>
        </div>
      </div>

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        {/* Category (read-only) */}
        <div className="space-y-2">
          <Label className="text-gray-500">Category</Label>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-white border border-gray-100 shadow-sm">
            {catConfig && (
              <>
                <div className={cn("p-2 rounded-lg", catConfig.color)}>
                  <catConfig.icon className="w-4 h-4" />
                </div>
                <span className="text-gray-700">{catConfig.label}</span>
                {quest.custom_category && (
                  <span className="text-gray-400">- {quest.custom_category}</span>
                )}
              </>
            )}
          </div>
          <p className="text-xs text-gray-500">Category cannot be changed after creation</p>
        </div>

        {/* Activity */}
        <div className="space-y-2">
          <Label htmlFor="activity">
            <Clock className="w-4 h-4 inline mr-2" />
            What will you be doing?
          </Label>
          <Input
            id="activity"
            placeholder="e.g., Leg day at the gym, Coffee and study session..."
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            className="bg-white border-gray-100"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Description (optional)</Label>
          <Textarea
            id="description"
            placeholder="Add more details about your quest..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="bg-white border-gray-100 min-h-[80px]"
          />
        </div>

        {/* Location */}
        <div className="space-y-2">
          <Label>
            <MapPin className="w-4 h-4 inline mr-2" />
            Location
          </Label>
          <LocationPickerWrapper
            value={locationData}
            onChange={setLocationData}
          />
        </div>

        {/* Time */}
        <div className="space-y-2">
          <Label>
            <Clock className="w-4 h-4 inline mr-2" />
            When?
          </Label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-400 mb-1">Start Time</Label>
              <Input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="bg-white border-gray-100"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-400 mb-1">End Time (optional)</Label>
              <Input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="bg-white border-gray-100"
              />
            </div>
          </div>
        </div>

        {/* Vibe Level */}
        <div className="space-y-2">
          <Label>
            <Zap className="w-4 h-4 inline mr-2" />
            Vibe Level
          </Label>
          <div className="grid grid-cols-5 gap-2">
            {vibeLevels.map((vibe) => (
              <button
                key={vibe.value}
                type="button"
                onClick={() => setVibeLevel(vibe.value)}
                className={cn(
                  "p-2 rounded-lg border text-center transition-all",
                  vibeLevel === vibe.value
                    ? "border-purple-500 bg-purple-500/20"
                    : "border-gray-200 bg-gray-50 hover:border-gray-300"
                )}
              >
                <span className="text-lg">{vibe.emoji}</span>
                <p className="text-[10px] text-gray-500 mt-1">{vibe.label}</p>
              </button>
            ))}
          </div>
          {vibeLevel === "custom" && (
            <Input
              placeholder="Describe your vibe..."
              value={customVibeLevel}
              onChange={(e) => setCustomVibeLevel(e.target.value)}
              className="mt-2 bg-white border-gray-100"
            />
          )}
        </div>

        {/* Max Participants */}
        <div className="space-y-2">
          <Label>
            <Users className="w-4 h-4 inline mr-2" />
            Max Participants
          </Label>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setMaxParticipants(Math.max(2, maxParticipants - 1))}
              className="rounded-full"
            >
              -
            </Button>
            <span className="text-xl font-semibold w-12 text-center">{maxParticipants}</span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setMaxParticipants(Math.min(20, maxParticipants + 1))}
              className="rounded-full"
            >
              +
            </Button>
          </div>
        </div>

        {/* Requires Approval */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-white border border-gray-100 shadow-sm">
          <div>
            <Label>Require Approval</Label>
            <p className="text-xs text-gray-400">Review requests before they can join</p>
          </div>
          <Switch
            checked={requiresApproval}
            onCheckedChange={setRequiresApproval}
          />
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-4">
          <Link href={`/quests/${questId}`} className="flex-1">
            <Button type="button" variant="outline" className="w-full">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            className="flex-1 bg-purple-600 hover:bg-purple-700"
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </motion.form>
    </div>
  );
}
