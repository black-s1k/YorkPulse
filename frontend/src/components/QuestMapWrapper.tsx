"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SideQuest } from "@/types";

interface QuestMapWrapperProps {
  quests: SideQuest[];
  className?: string;
}

export function QuestMapWrapper({ quests, className }: QuestMapWrapperProps) {
  const [MapComponent, setMapComponent] = useState<React.ComponentType<{
    quests: SideQuest[];
    className?: string;
  }> | null>(null);

  useEffect(() => {
    // Only import the map component on the client side
    import("./QuestMapClient").then((mod) => {
      setMapComponent(() => mod.default);
    });
  }, []);

  if (!MapComponent) {
    return (
      <div className={cn("w-full h-full bg-white rounded-xl flex items-center justify-center", className)}>
        <Loader2 className="w-8 h-8 animate-spin text-green-700" />
      </div>
    );
  }

  return <MapComponent quests={quests} className={className} />;
}

export default QuestMapWrapper;
