"use client";

import { useEffect, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Navigation, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// York University campus center coordinates
const YORK_CENTER: [number, number] = [43.7735, -79.5019];
const DEFAULT_ZOOM = 17;

// Common York locations for quick selection (coordinates match yorkBuildings.ts)
const YORK_LOCATIONS = [
  { name: "Tait McKenzie Centre", lat: 43.77442, lng: -79.50956 },
  { name: "Aviva Centre", lat: 43.77162, lng: -79.51210 },
  { name: "Scott Library", lat: 43.77380, lng: -79.50380 },
  { name: "Steacie Science Library", lat: 43.77250, lng: -79.50550 },
  { name: "Student Centre", lat: 43.77635, lng: -79.49595 },
  { name: "York Lanes Mall", lat: 43.77280, lng: -79.50080 },
  { name: "Ross Building", lat: 43.77436, lng: -79.49315 },
  { name: "Vari Hall", lat: 43.77310, lng: -79.50360 },
  { name: "Lassonde Building", lat: 43.77410, lng: -79.49080 },
  { name: "Bergeron Centre", lat: 43.77450, lng: -79.49050 },
  { name: "Schulich School of Business", lat: 43.77700, lng: -79.49900 },
  { name: "Central Square", lat: 43.77350, lng: -79.50350 },
  { name: "Curtis Lecture Halls", lat: 43.77280, lng: -79.50200 },
  { name: "York University Station", lat: 43.77420, lng: -79.49980 },
  { name: "Pioneer Village Station", lat: 43.77806, lng: -79.51194 },
];

// Custom pin marker with gradient
const pinIcon = L.divIcon({
  className: "custom-pin-marker",
  html: `
    <div class="pin-container">
      <div class="pin-pulse"></div>
      <div class="pin-inner">
        <div class="pin-dot"></div>
      </div>
    </div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

interface ClickHandlerProps {
  onLocationSelect: (lat: number, lng: number) => void;
}

function ClickHandler({ onLocationSelect }: ClickHandlerProps) {
  useMapEvents({
    click: (e) => {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function RecenterControl({ position }: { position: [number, number] | null }) {
  const map = useMap();

  const handleRecenter = useCallback(() => {
    if (position) {
      map.flyTo(position, 17, { duration: 0.5 });
    } else {
      map.flyTo(YORK_CENTER, DEFAULT_ZOOM, { duration: 0.5 });
    }
  }, [map, position]);

  return (
    <div className="leaflet-top leaflet-right" style={{ marginTop: 10, marginRight: 10 }}>
      <div className="leaflet-control">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleRecenter}
          className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30 border border-white/20"
          title="Recenter map"
        >
          <Navigation className="w-4 h-4 text-white" />
        </motion.button>
      </div>
    </div>
  );
}

interface LocationPickerProps {
  value: { lat: number | null; lng: number | null; name: string };
  onChange: (location: { lat: number | null; lng: number | null; name: string }) => void;
  className?: string;
}

export function LocationPicker({ value, onChange, className }: LocationPickerProps) {
  const [mounted, setMounted] = useState(false);
  const [showQuickLocations, setShowQuickLocations] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLocationSelect = (lat: number, lng: number) => {
    // Find if it's near a known location
    const nearbyLocation = YORK_LOCATIONS.find((loc) => {
      const distance = Math.sqrt(
        Math.pow(loc.lat - lat, 2) + Math.pow(loc.lng - lng, 2)
      );
      return distance < 0.0005; // ~50 meters
    });

    // If clicking on map, use nearby location name or "Custom Location"
    // This ensures the name always matches the pin position
    onChange({
      lat,
      lng,
      name: nearbyLocation?.name || "Custom Location",
    });
    setShowQuickLocations(false);
  };

  const handleQuickLocationSelect = (loc: typeof YORK_LOCATIONS[0]) => {
    onChange({
      lat: loc.lat,
      lng: loc.lng,
      name: loc.name,
    });
    setShowQuickLocations(false);
  };

  const handleClearLocation = () => {
    onChange({ lat: null, lng: null, name: "" });
  };

  if (!mounted) {
    return (
      <div className={cn("w-full h-64 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100", className)}>
        <div className="text-gray-400">Loading map...</div>
      </div>
    );
  }

  const position: [number, number] | null =
    value.lat && value.lng ? [value.lat, value.lng] : null;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Location name input */}
      <div className="relative">
        <Input
          placeholder="Location name (or tap map to select)"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          className="pr-10 bg-white border-gray-100 focus:border-purple-500/50"
        />
        {(value.lat || value.name) && (
          <button
            type="button"
            onClick={handleClearLocation}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>

      {/* Quick location selector */}
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowQuickLocations(!showQuickLocations)}
          className="w-full justify-between bg-white border-gray-100 hover:bg-white/10 hover:border-purple-500/30"
        >
          <span className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-purple-700" />
            <span className="text-gray-700">Quick Locations</span>
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">York Campus</span>
            <ChevronDown className={cn("w-4 h-4 text-gray-500 transition-transform", showQuickLocations && "rotate-180")} />
          </div>
        </Button>

        <AnimatePresence>
          {showQuickLocations && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute z-50 w-full mt-2 backdrop-blur-xl bg-white border border-gray-100 rounded-xl shadow-xl shadow-purple-500/10 overflow-hidden max-h-64 overflow-y-auto"
            >
              {YORK_LOCATIONS.map((loc) => (
                <button
                  key={loc.name}
                  type="button"
                  onClick={() => handleQuickLocationSelect(loc)}
                  className={cn(
                    "w-full px-4 py-3 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-3 border-b border-white/5 last:border-0",
                    value.name === loc.name && "bg-purple-500/20"
                  )}
                >
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    value.name === loc.name ? "bg-purple-400" : "bg-zinc-600"
                  )} />
                  <span className={cn(
                    value.name === loc.name ? "text-purple-300" : "text-gray-700"
                  )}>
                    {loc.name}
                  </span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Map */}
      <div className="relative h-64 rounded-2xl overflow-hidden border border-white/20 shadow-lg">
        <MapContainer
          center={position || YORK_CENTER}
          zoom={position ? 17 : DEFAULT_ZOOM}
          className="w-full h-full"
          style={{ background: "#ffffff" }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />

          <ClickHandler onLocationSelect={handleLocationSelect} />
          <RecenterControl position={position} />

          {position && <Marker position={position} icon={pinIcon} />}
        </MapContainer>

        {/* Instruction overlay */}
        {!position && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-3 left-3 right-3 backdrop-blur-xl bg-black/60 border border-gray-100 rounded-xl px-4 py-2.5 text-center"
          >
            <p className="text-sm text-gray-700">
              <span className="text-purple-700">Tap</span> on the map to drop a pin
            </p>
          </motion.div>
        )}

        {/* Selected coordinates badge */}
        {position && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute bottom-3 left-3 backdrop-blur-xl bg-purple-500/20 border border-purple-500/30 rounded-lg px-3 py-1.5"
          >
            <p className="text-xs text-purple-300 font-mono">
              {position[0].toFixed(4)}, {position[1].toFixed(4)}
            </p>
          </motion.div>
        )}
      </div>

      {/* Custom pin marker styles */}
      <style jsx global>{`
        .custom-pin-marker {
          background: transparent !important;
          border: none !important;
        }

        .pin-container {
          position: relative;
          width: 40px;
          height: 40px;
        }

        .pin-pulse {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(168, 85, 247, 0.3);
          animation: pin-pulse 2s ease-out infinite;
        }

        .pin-inner {
          position: absolute;
          top: 0;
          left: 5px;
          width: 30px;
          height: 30px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          background: linear-gradient(135deg, #a855f7, #ec4899);
          border: 3px solid white;
          box-shadow: 0 4px 12px rgba(168, 85, 247, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .pin-dot {
          width: 8px;
          height: 8px;
          background: white;
          border-radius: 50%;
          transform: rotate(45deg);
        }

        @keyframes pin-pulse {
          0% {
            transform: translate(-50%, -50%) scale(0.8);
            opacity: 0.5;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.5);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

export default LocationPicker;
