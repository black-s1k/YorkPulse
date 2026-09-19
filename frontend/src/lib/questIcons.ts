import {
  BookOpen,
  Car,
  Coffee,
  Dumbbell,
  Flame,
  Gamepad2,
  Sparkles,
  ThumbsUp,
  Utensils,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { QuestCategory, VibeLevel } from "@/types";

// Shared icons for quest categories and vibe levels (the UI uses icons, never emojis)
export const questCategoryIcons: Record<QuestCategory, LucideIcon> = {
  gym: Dumbbell,
  food: Utensils,
  study: BookOpen,
  game: Gamepad2,
  commute: Car,
  custom: Sparkles,
};

export const vibeLevelIcons: Record<VibeLevel, LucideIcon> = {
  chill: Coffee,
  intermediate: ThumbsUp,
  high_energy: Zap,
  intense: Flame,
  custom: Sparkles,
};
