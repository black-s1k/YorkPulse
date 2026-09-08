"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { motion } from "framer-motion";
import { Navigation, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cartoTileUrl } from "@/lib/mapTiles";
import type { QuestCategory } from "@/types";

// Category config
const categoryConfig: Record<QuestCategory, {
  emoji: string;
  gradient: string;
  color: string;
}> = {
  gym: { emoji: "💪", gradient: "linear-gradient(135deg, #ef4444, #dc2626)", color: "#ef4444" },
  food: { emoji: "🍜", gradient: "linear-gradient(135deg, #f97316, #ea580c)", color: "#f97316" },
  study: { emoji: "📚", gradient: "linear-gradient(135deg, #3b82f6, #2563eb)", color: "#3b82f6" },
  game: { emoji: "🎮", gradient: "linear-gradient(135deg, #22c55e, #16a34a)", color: "#22c55e" },
  commute: { emoji: "🚗", gradient: "linear-gradient(135deg, #a855f7, #9333ea)", color: "#a855f7" },
  custom: { emoji: "✨", gradient: "linear-gradient(135deg, #6b7280, #4b5563)", color: "#6b7280" },
};

const createMarkerIcon = (category: QuestCategory) => {
  const config = categoryConfig[category];
  return L.divIcon({
    className: "custom-quest-marker",
    html: `
      <div class="detail-marker-container">
        <div class="detail-marker-pulse" style="background: ${config.color}"></div>
        <div class="detail-marker-inner" style="background: ${config.gradient}">
          <span class="detail-marker-emoji">${config.emoji}</span>
        </div>
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 48],
  });
};

function SetViewOnMount({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 17);
  }, [map, center]);
  return null;
}

interface QuestLocationMapProps {
  latitude: number;
  longitude: number;
  locationName: string;
  category: QuestCategory;
}

export function QuestLocationMap({
  latitude,
  longitude,
  locationName,
  category,
}: QuestLocationMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleOpenDirections = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place_id=${encodeURIComponent(locationName)}`;
    window.open(url, "_blank");
  };

  if (!mounted) {
    return (
      <div className="h-44 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100">
        <div className="text-gray-400 text-sm">Loading map...</div>
      </div>
    );
  }

  const position: [number, number] = [latitude, longitude];
  const config = categoryConfig[category];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-2xl overflow-hidden border border-gray-100 shadow-[0_0_40px_-15px_rgba(168,85,247,0.3)]"
    >
      <div className="h-44">
        <MapContainer
          center={position}
          zoom={17}
          className="w-full h-full"
          style={{ background: "#0A0A0A" }}
          zoomControl={false}
          scrollWheelZoom={false}
          dragging={false}
          doubleClickZoom={false}
          touchZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url={cartoTileUrl("dark_all")}
          />
          <SetViewOnMount center={position} />
          <Marker position={position} icon={createMarkerIcon(category)} />
        </MapContainer>
      </div>

      {/* Gradient overlay at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

      {/* Location badge */}
      <div className="absolute top-3 left-3 backdrop-blur-xl bg-black/50 border border-gray-100 rounded-lg px-3 py-1.5 flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full"
          style={{ background: config.gradient }}
        />
        <span className="text-xs text-gray-700 font-medium">{locationName}</span>
      </div>

      {/* Directions button */}
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="absolute bottom-3 right-3"
      >
        <Button
          size="sm"
          onClick={handleOpenDirections}
          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/30 border border-white/20"
        >
          <Navigation className="w-4 h-4 mr-1.5" />
          Directions
          <ExternalLink className="w-3 h-3 ml-1.5 opacity-70" />
        </Button>
      </motion.div>

      {/* Marker styles */}
      <style jsx global>{`
        .detail-marker-container {
          position: relative;
          width: 48px;
          height: 48px;
        }

        .detail-marker-pulse {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 48px;
          height: 48px;
          border-radius: 50%;
          opacity: 0.3;
          animation: detail-pulse 2s ease-out infinite;
        }

        .detail-marker-inner {
          position: absolute;
          top: 0;
          left: 9px;
          width: 30px;
          height: 30px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
          border: 2px solid rgba(255, 255, 255, 0.4);
        }

        .detail-marker-emoji {
          transform: rotate(45deg);
          font-size: 14px;
        }

        @keyframes detail-pulse {
          0% {
            transform: translate(-50%, -50%) scale(0.8);
            opacity: 0.4;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.6);
            opacity: 0;
          }
        }
      `}</style>
    </motion.div>
  );
}

export default QuestLocationMap;
