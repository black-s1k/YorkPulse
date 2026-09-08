"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
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
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useUIStore } from "@/stores/ui";
import { useCreateQuest, useAdminCreateQuest, usePersonas } from "@/hooks/useQuests";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { useUser } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { LocationPickerWrapper } from "@/components/LocationPickerWrapper";
import type { QuestCategory, VibeLevel, PersonaUser } from "@/types";

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

const timeQuickOptions = [
  { label: "Now", getValue: () => new Date(Date.now() + 60 * 1000).toISOString() }, // 1 minute buffer
  { label: "In 1 hour", getValue: () => new Date(Date.now() + 60 * 60 * 1000).toISOString() },
  { label: "Custom", getValue: () => null },
];

export function CreateQuestModal() {
  const { isCreateModalOpen, createModalType, closeCreateModal } = useUIStore();
  const { toast } = useToast();
  const { user } = useAuthStore();
  const { data: freshUser } = useUser();
  const isAdmin = (freshUser?.is_admin ?? user?.is_admin) === true;

  const createMutation = useCreateQuest();
  const adminCreateMutation = useAdminCreateQuest();
  const { data: personas } = usePersonas(isAdmin);

  // Admin: display name override — matched against persona names at submit time.
  const [postAsName, setPostAsName] = useState("");

  // Form state
  const [category, setCategory] = useState<QuestCategory>("gym");
  const [customCategory, setCustomCategory] = useState("");
  const [activity, setActivity] = useState("");
  const [description, setDescription] = useState("");
  const [locationData, setLocationData] = useState<{
    lat: number | null;
    lng: number | null;
    name: string;
  }>({ lat: null, lng: null, name: "" });
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [selectedTimeOption, setSelectedTimeOption] = useState<string | null>(null);
  const [vibeLevel, setVibeLevel] = useState<VibeLevel>("chill");
  const [customVibeLevel, setCustomVibeLevel] = useState("");
  const [maxParticipants, setMaxParticipants] = useState(2);
  const [requiresApproval, setRequiresApproval] = useState(true);

  const isOpen = isCreateModalOpen && createModalType === "quest";

  const resetForm = () => {
    setCategory("gym");
    setCustomCategory("");
    setActivity("");
    setDescription("");
    setLocationData({ lat: null, lng: null, name: "" });
    setStartTime("");
    setEndTime("");
    setShowCustomTime(false);
    setSelectedTimeOption(null);
    setVibeLevel("chill");
    setCustomVibeLevel("");
    setMaxParticipants(2);
    setRequiresApproval(true);
    setPostAsName("");
  };

  const handleClose = () => {
    closeCreateModal();
    resetForm();
  };

  const handleTimeQuickOption = (option: typeof timeQuickOptions[0]) => {
    const value = option.getValue();
    setSelectedTimeOption(option.label);
    if (value) {
      setStartTime(value);
      setShowCustomTime(false);
    } else {
      setShowCustomTime(true);
    }
  };

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

    if (category === "custom" && !customCategory.trim()) {
      toast({
        title: "Custom category required",
        description: "Please specify your custom category",
        variant: "destructive",
      });
      return;
    }

    if (vibeLevel === "custom" && !customVibeLevel.trim()) {
      toast({
        title: "Custom vibe level required",
        description: "Please specify your custom vibe level",
        variant: "destructive",
      });
      return;
    }

    const questData = {
      category,
      custom_category: category === "custom" ? customCategory : undefined,
      activity: activity.trim(),
      description: description.trim() || undefined,
      start_time: startTime,
      end_time: endTime || undefined,
      location: locationData.name.trim(),
      latitude: locationData.lat || undefined,
      longitude: locationData.lng || undefined,
      vibe_level: vibeLevel,
      custom_vibe_level: vibeLevel === "custom" ? customVibeLevel : undefined,
      max_participants: maxParticipants,
      requires_approval: requiresApproval,
    };

    try {
      if (isAdmin) {
        let personaId: string | null = null;
        if (postAsName.trim()) {
          const existingPersona = (personas as PersonaUser[] | undefined)?.find(
            (p: PersonaUser) => p.name.toLowerCase() === postAsName.trim().toLowerCase()
          );
          if (existingPersona) {
            personaId = existingPersona.id;
          } else {
            // Create a new persona with the typed name on-the-fly
            const newPersona = await api.adminPersonas.createPersona({ name: postAsName.trim() });
            personaId = newPersona.id;
          }
        }
        await adminCreateMutation.mutateAsync({ personaId, data: questData });
      } else {
        await createMutation.mutateAsync(questData);
      }

      const postedAs = postAsName.trim() || null;

      toast({
        title: "Quest created!",
        description: isAdmin && postedAs
          ? `Posted as ${postedAs}`
          : "Your side quest has been posted",
      });

      handleClose();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create quest",
        variant: "destructive",
      });
    }
  };

  // Convert ISO string to datetime-local format
  const formatDateTimeLocal = (isoString: string) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toISOString().slice(0, 16);
  };

  // Convert datetime-local to ISO string
  const handleDateTimeChange = (value: string, setter: (v: string) => void) => {
    if (value) {
      setter(new Date(value).toISOString());
    } else {
      setter("");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-[10000] max-h-[90vh] overflow-y-auto rounded-t-3xl bg-white border-t border-gray-200 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-lg md:w-full md:rounded-2xl md:border"
          >
            {/* Header */}
            <div className="sticky top-0 z-[10001] flex items-center justify-between p-4 bg-white backdrop-blur border-b border-gray-200">
              <h2 className="text-lg font-semibold">Create Side Quest</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="rounded-full"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-4 space-y-6">
              {/* Admin: display name override */}
              {isAdmin && (
                <div className="space-y-1.5">
                  <Label htmlFor="postAsName" className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                    <Shield className="w-3 h-3" />
                    Display name (leave blank to post as yourself)
                  </Label>
                  <Input
                    id="postAsName"
                    placeholder="e.g. Alex M."
                    value={postAsName}
                    onChange={(e) => setPostAsName(e.target.value)}
                    maxLength={60}
                    className="border-amber-200 focus-visible:ring-amber-300"
                  />
                </div>
              )}

              {/* Category Pills */}
              <div className="space-y-2">
                <Label>Category</Label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setCategory(cat.value)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-full border transition-all text-sm",
                        category === cat.value
                          ? cat.color
                          : "bg-white/5 text-gray-500 border-gray-200 hover:bg-white/10"
                      )}
                    >
                      <cat.icon className="w-4 h-4" />
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Custom Category Input */}
                {category === "custom" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2"
                  >
                    <Input
                      placeholder="Enter custom category..."
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      maxLength={50}
                    />
                  </motion.div>
                )}
              </div>

              {/* Activity Type */}
              <div className="space-y-2">
                <Label htmlFor="activity">What are you doing?</Label>
                <Textarea
                  id="activity"
                  placeholder="e.g., Heavy Leg Day / Spotter Needed"
                  value={activity}
                  onChange={(e) => setActivity(e.target.value)}
                  maxLength={200}
                  rows={2}
                  className="resize-none"
                />
              </div>

              {/* Location with Map Picker */}
              <div className="space-y-2">
                <Label>
                  <MapPin className="w-4 h-4 inline-block mr-1" />
                  Where at York?
                </Label>
                <LocationPickerWrapper value={locationData} onChange={setLocationData} />
              </div>

              {/* Timeframe */}
              <div className="space-y-2">
                <Label>
                  <Clock className="w-4 h-4 inline-block mr-1" />
                  When?
                </Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {timeQuickOptions.map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => handleTimeQuickOption(option)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-sm border transition-all",
                        selectedTimeOption === option.label
                          ? "bg-green-500/20 text-green-700 border-green-500/30"
                          : "bg-white/5 text-gray-500 border-gray-200 hover:bg-white/10"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {showCustomTime && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-2"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="startTime" className="text-xs text-gray-400">Start Time</Label>
                        <Input
                          id="startTime"
                          type="datetime-local"
                          value={formatDateTimeLocal(startTime)}
                          onChange={(e) => handleDateTimeChange(e.target.value, setStartTime)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="endTime" className="text-xs text-gray-400">End Time (Optional)</Label>
                        <Input
                          id="endTime"
                          type="datetime-local"
                          value={formatDateTimeLocal(endTime)}
                          onChange={(e) => handleDateTimeChange(e.target.value, setEndTime)}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Vibe Level */}
              <div className="space-y-2">
                <Label>
                  <Zap className="w-4 h-4 inline-block mr-1" />
                  Vibe / Level
                </Label>
                <div className="flex flex-wrap gap-2">
                  {vibeLevels.map((level) => (
                    <button
                      key={level.value}
                      type="button"
                      onClick={() => setVibeLevel(level.value)}
                      className={cn(
                        "px-3 py-2 rounded-full text-sm border transition-all flex items-center gap-1.5",
                        vibeLevel === level.value
                          ? "bg-green-500/20 text-green-700 border-green-500/30"
                          : "bg-white/5 text-gray-500 border-gray-200 hover:bg-white/10"
                      )}
                    >
                      <span>{level.emoji}</span>
                      {level.label}
                    </button>
                  ))}
                </div>

                {/* Custom Vibe Level Input */}
                {vibeLevel === "custom" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2"
                  >
                    <Input
                      placeholder="Enter custom vibe level..."
                      value={customVibeLevel}
                      onChange={(e) => setCustomVibeLevel(e.target.value)}
                      maxLength={50}
                    />
                  </motion.div>
                )}
              </div>

              {/* Peer Limit */}
              <div className="space-y-2">
                <Label htmlFor="maxParticipants">
                  <Users className="w-4 h-4 inline-block mr-1" />
                  How many buddies? ({maxParticipants})
                </Label>
                {maxParticipants <= 10 ? (
                  <>
                    <input
                      id="maxParticipants"
                      type="range"
                      min={1}
                      max={10}
                      value={maxParticipants}
                      onChange={(e) => setMaxParticipants(parseInt(e.target.value))}
                      className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>1</span>
                      <span>10</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMaxParticipants(11)}
                      className="text-xs text-green-700 hover:text-green-800 transition-colors"
                    >
                      Need more than 10?
                    </button>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Input
                      id="maxParticipants"
                      type="number"
                      min={1}
                      max={100}
                      value={maxParticipants}
                      onChange={(e) => setMaxParticipants(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                      className="w-full"
                    />
                    <button
                      type="button"
                      onClick={() => setMaxParticipants(10)}
                      className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      Back to slider (1-10)
                    </button>
                  </div>
                )}
              </div>

              {/* Requires Approval */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
                <div>
                  <p className="font-medium text-sm">
                    {requiresApproval ? "Manually approve participants" : "Auto-accept (first-come-first-served)"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {requiresApproval
                      ? "Review who joins your quest"
                      : "Anyone can join immediately"}
                  </p>
                </div>
                <Switch
                  checked={requiresApproval}
                  onCheckedChange={setRequiresApproval}
                />
              </div>

              {/* Description (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="description">Additional Details (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Any other information participants should know..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={createMutation.isPending || adminCreateMutation.isPending}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold py-3"
              >
                {(createMutation.isPending || adminCreateMutation.isPending) ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Post Quest"
                )}
              </Button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
