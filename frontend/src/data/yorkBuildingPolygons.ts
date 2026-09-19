// York University Building Polygons from OpenStreetMap
// Fetches from backend API with Redis caching (shared across all users)

import { api } from "@/services/api";
import type { LucideIcon } from "lucide-react";
import { BuildingCategory, buildingCategoryConfig } from "./yorkBuildings";

export interface BuildingPolygon {
  id: string;
  name: string;
  category: BuildingCategory;
  coordinates: [number, number][]; // Array of [lat, lng] pairs forming polygon
  center: [number, number];
  description?: string;
  hours?: string;
}

// Building name to category mapping
const buildingCategoryMap: Record<string, BuildingCategory> = {
  // Gym/Fitness
  "tait mckenzie": "gym",
  "tait mckenzie centre": "gym",
  "aviva centre": "gym",
  "tennis canada": "gym",
  "track and field": "gym",
  "toronto track": "gym",
  "york lions stadium": "gym",
  "stadium": "gym",
  "ice rink": "gym",
  "rink": "gym",
  "gymnasium": "gym",
  "fitness": "gym",
  "recreation": "gym",
  "soccer": "gym",
  "football": "gym",
  "pitch": "gym",
  "field": "gym",
  "arena": "gym",
  "athletics": "gym",
  "sport": "gym",
  "tennis": "gym",
  "pool": "gym",
  "aquatic": "gym",
  "canlan": "gym",
  "ice gardens": "gym",

  // Food/Dining
  "student centre": "food",
  "york lanes": "food",
  "food court": "food",
  "cafeteria": "food",
  "tim hortons": "food",
  "starbucks": "food",
  "dining": "food",
  "restaurant": "food",

  // Study Spaces
  "scott library": "study",
  "steacie": "study",
  "library": "study",
  "william small": "study",

  // Academic Buildings
  "ross building": "academic",
  "ross": "academic",
  "vari hall": "academic",
  "lassonde": "academic",
  "bergeron": "academic",
  "schulich": "academic",
  "osgoode": "academic",
  "curtis": "academic",
  "lecture hall": "academic",
  "accolade": "academic",
  "health": "academic",
  "dahdaleh": "academic",
  "life sciences": "academic",
  "farquharson": "academic",
  "petrie": "academic",
  "chemistry": "academic",
  "physics": "academic",
  "biology": "academic",
  "behavioural": "academic",
  "administrative": "academic",
  "kaneff": "academic",
  "seneca": "academic",
  "central square": "academic",
  "atkinson": "academic",

  // Transit
  "pioneer village": "transit",
  "york university station": "transit",
  "subway": "transit",
  "bus terminal": "transit",
  "station": "transit",

  // Residences
  "residence": "residence",
  "college": "residence",
  "founders": "residence",
  "vanier": "residence",
  "winters": "residence",
  "mclaughlin": "residence",
  "stong": "residence",
  "bethune": "residence",
  "calumet": "residence",
  "tatham": "residence",
  "pond": "residence",
  "assiniboine": "residence",
  "quad": "residence",
};

// Determine category from building name and tags
function getCategoryFromNameAndTags(name: string, tags?: Record<string, string>): BuildingCategory {
  // Check OSM tags first for sports/leisure facilities
  if (tags) {
    const leisure = tags.leisure;
    const sport = tags.sport;
    const amenity = tags.amenity;

    // Sports facilities
    if (leisure === "pitch" || leisure === "sports_centre" || leisure === "stadium" ||
        leisure === "track" || leisure === "ice_rink" || leisure === "swimming_pool") {
      return "gym";
    }
    if (sport) {
      return "gym";
    }
    if (amenity === "gym" || amenity === "fitness_centre") {
      return "gym";
    }
  }

  const lowerName = name.toLowerCase();

  for (const [keyword, category] of Object.entries(buildingCategoryMap)) {
    if (lowerName.includes(keyword)) {
      return category;
    }
  }

  return "academic"; // Default to academic for unknown buildings
}

// York University Keele Campus boundaries
// Expanded to include all campus buildings from Aviva Centre to Lassonde/Bergeron
const CAMPUS_BOUNDS = {
  west: -79.5200,   // West of Aviva Centre
  east: -79.4900,   // East edge including Lassonde/Bergeron area
  north: 43.7900,   // North of Steeles
  south: 43.7600,   // South campus edge (includes The Quad at 43.768)
};

// Check if a coordinate is within campus bounds
function isWithinCampus(lat: number, lng: number): boolean {
  return (
    lng >= CAMPUS_BOUNDS.west &&
    lng <= CAMPUS_BOUNDS.east &&
    lat >= CAMPUS_BOUNDS.south &&
    lat <= CAMPUS_BOUNDS.north
  );
}

// Check if a building's center is within campus bounds
function isBuildingWithinCampus(coordinates: [number, number][]): boolean {
  // Calculate center point
  const centerLat = coordinates.reduce((sum, c) => sum + c[0], 0) / coordinates.length;
  const centerLng = coordinates.reduce((sum, c) => sum + c[1], 0) / coordinates.length;

  return isWithinCampus(centerLat, centerLng);
}

// Overpass API query for York University buildings (tighter bounds)
const OVERPASS_QUERY = `
[out:json][timeout:30];
(
  // York University campus area - restricted to west of Keele
  way["building"](${CAMPUS_BOUNDS.south},${CAMPUS_BOUNDS.west},${CAMPUS_BOUNDS.north},${CAMPUS_BOUNDS.east});
  relation["building"](${CAMPUS_BOUNDS.south},${CAMPUS_BOUNDS.west},${CAMPUS_BOUNDS.north},${CAMPUS_BOUNDS.east});
  // Sports facilities (pitches, tracks, etc.)
  way["leisure"="pitch"](${CAMPUS_BOUNDS.south},${CAMPUS_BOUNDS.west},${CAMPUS_BOUNDS.north},${CAMPUS_BOUNDS.east});
  way["leisure"="sports_centre"](${CAMPUS_BOUNDS.south},${CAMPUS_BOUNDS.west},${CAMPUS_BOUNDS.north},${CAMPUS_BOUNDS.east});
  way["leisure"="stadium"](${CAMPUS_BOUNDS.south},${CAMPUS_BOUNDS.west},${CAMPUS_BOUNDS.north},${CAMPUS_BOUNDS.east});
  way["leisure"="track"](${CAMPUS_BOUNDS.south},${CAMPUS_BOUNDS.west},${CAMPUS_BOUNDS.north},${CAMPUS_BOUNDS.east});
  way["leisure"="ice_rink"](${CAMPUS_BOUNDS.south},${CAMPUS_BOUNDS.west},${CAMPUS_BOUNDS.north},${CAMPUS_BOUNDS.east});
  way["leisure"="swimming_pool"](${CAMPUS_BOUNDS.south},${CAMPUS_BOUNDS.west},${CAMPUS_BOUNDS.north},${CAMPUS_BOUNDS.east});
);
out body geom;
`;

// Parse OSM response to building polygons
function parseOSMResponse(data: any): BuildingPolygon[] {
  const buildings: BuildingPolygon[] = [];

  if (!data.elements) return buildings;

  for (const element of data.elements) {
    // Skip if no geometry
    if (!element.geometry && !element.members) continue;

    let coordinates: [number, number][] = [];
    let name = element.tags?.name || element.tags?.["addr:housename"] || "";

    // Generate name for sports facilities without a name
    if (!name && element.tags) {
      const sport = element.tags.sport;
      const leisure = element.tags.leisure;
      if (sport) {
        name = `${sport.charAt(0).toUpperCase() + sport.slice(1)} Field`;
      } else if (leisure === "pitch") {
        name = "Sports Field";
      } else if (leisure === "track") {
        name = "Running Track";
      } else if (leisure === "ice_rink") {
        name = "Ice Rink";
      } else if (leisure === "swimming_pool") {
        name = "Swimming Pool";
      } else if (leisure === "sports_centre") {
        name = "Sports Centre";
      } else if (leisure === "stadium") {
        name = "Stadium";
      }
    }

    // For ways, extract coordinates directly
    if (element.type === "way" && element.geometry) {
      coordinates = element.geometry.map((point: any) => [point.lat, point.lon]);
    }

    // For relations (multipolygons), get outer way
    if (element.type === "relation" && element.members) {
      const outerWay = element.members.find((m: any) => m.role === "outer");
      if (outerWay?.geometry) {
        coordinates = outerWay.geometry.map((point: any) => [point.lat, point.lon]);
      }
    }

    // Skip if no valid coordinates or too few points
    if (coordinates.length < 3) continue;

    // Calculate center point
    const center: [number, number] = [
      coordinates.reduce((sum, c) => sum + c[0], 0) / coordinates.length,
      coordinates.reduce((sum, c) => sum + c[1], 0) / coordinates.length,
    ];

    // Skip buildings outside campus bounds (east of Keele Street)
    if (!isWithinCampus(center[0], center[1])) continue;

    // Skip buildings without names (unless they're large enough to be significant)
    const area = calculatePolygonArea(coordinates);
    if (!name && area < 500) continue; // Skip small unnamed buildings

    // Generate ID
    const id = `osm-${element.type}-${element.id}`;

    // Determine category from name and tags
    const category = getCategoryFromNameAndTags(name || `building-${element.id}`, element.tags);

    buildings.push({
      id,
      name: name || "Campus Building",
      category,
      coordinates,
      center,
    });
  }

  return buildings;
}

// Calculate polygon area (approximate, for filtering)
function calculatePolygonArea(coords: [number, number][]): number {
  let area = 0;
  const n = coords.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += coords[i][0] * coords[j][1];
    area -= coords[j][0] * coords[i][1];
  }

  return Math.abs(area / 2) * 111000 * 111000; // Convert to approximate square meters
}

// Overpass API endpoints (multiple for redundancy)
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

// Cache key and duration (24 hours)
const BUILDING_CACHE_KEY = "yorkBuildings_cache";
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in ms

// Get cached buildings from localStorage
function getCachedBuildings(): BuildingPolygon[] | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(BUILDING_CACHE_KEY);
    if (!cached) return null;

    const { buildings, timestamp } = JSON.parse(cached);
    // Check if cache is still valid
    if (Date.now() - timestamp < CACHE_DURATION && buildings.length > 0) {
      return buildings;
    }
    return null;
  } catch {
    return null;
  }
}

// Save buildings to localStorage cache
function cacheBuildings(buildings: BuildingPolygon[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BUILDING_CACHE_KEY, JSON.stringify({
      buildings,
      timestamp: Date.now(),
    }));
  } catch {
    // Ignore cache errors (e.g., quota exceeded)
  }
}

// Fetch building polygons from backend API (Redis cached) with localStorage fallback
export async function fetchBuildingPolygons(): Promise<BuildingPolygon[]> {
  // Check localStorage cache first (instant, works offline)
  const cached = getCachedBuildings();
  if (cached) {
    return cached;
  }

  // Try backend API (Redis cached - shared across all users)
  try {
    const response = await api.map.getBuildings();
    if (response.buildings && response.buildings.length > 0) {
      const buildings: BuildingPolygon[] = response.buildings.map((b) => ({
        id: b.id,
        name: b.name,
        category: b.category as BuildingCategory,
        coordinates: b.coordinates,
        center: b.center,
      }));

      // Cache in localStorage for instant loads
      cacheBuildings(buildings);
      return buildings;
    }
  } catch {
    // Backend unavailable — fall through to direct Overpass fetch
  }

  // Fallback: Try Overpass API directly (if backend is down)
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const url = `${endpoint}?data=${encodeURIComponent(OVERPASS_QUERY)}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        headers: { "Accept": "application/json" },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) continue;

      const data = await response.json();
      const buildings = parseOSMResponse(data);

      if (buildings.length > 0) {
        cacheBuildings(buildings);
        return buildings;
      }
    } catch {
      continue;
    }
  }

  // All sources failed - return fallback buildings
  return fallbackBuildings;
}

// Fallback building data with rectangular approximations
const allFallbackBuildings: BuildingPolygon[] = [
  // Gym/Fitness
  {
    id: "fallback-tait",
    name: "Tait McKenzie Centre",
    category: "gym",
    center: [43.77442, -79.50956],
    coordinates: createRectangle([43.77442, -79.50956], 80, 60),
  },
  {
    id: "fallback-aviva",
    name: "Aviva Centre",
    category: "gym",
    center: [43.77162, -79.51210],
    coordinates: createRectangle([43.77162, -79.51210], 100, 80),
  },

  // Food/Dining
  {
    id: "fallback-student-centre",
    name: "Student Centre",
    category: "food",
    center: [43.77635, -79.49595],
    coordinates: createRectangle([43.77635, -79.49595], 60, 40),
  },
  {
    id: "fallback-york-lanes",
    name: "York Lanes Mall",
    category: "food",
    center: [43.77280, -79.50080],
    coordinates: createRectangle([43.77280, -79.50080], 70, 50),
  },

  // Study Spaces
  {
    id: "fallback-scott",
    name: "Scott Library",
    category: "study",
    center: [43.77380, -79.50380],
    coordinates: createRectangle([43.77380, -79.50380], 80, 60),
  },
  {
    id: "fallback-steacie",
    name: "Steacie Science Library",
    category: "study",
    center: [43.77250, -79.50550],
    coordinates: createRectangle([43.77250, -79.50550], 50, 40),
  },

  // Academic Buildings
  {
    id: "fallback-ross",
    name: "Ross Building",
    category: "academic",
    center: [43.77436, -79.49315],
    coordinates: createRectangle([43.77436, -79.49315], 120, 80),
  },
  {
    id: "fallback-vari",
    name: "Vari Hall",
    category: "academic",
    center: [43.77310, -79.50360],
    coordinates: createRectangle([43.77310, -79.50360], 50, 50),
  },
  {
    id: "fallback-lassonde",
    name: "Lassonde Building",
    category: "academic",
    center: [43.77410, -79.49080],
    coordinates: createRectangle([43.77410, -79.49080], 70, 50),
  },
  {
    id: "fallback-bergeron",
    name: "Bergeron Centre",
    category: "academic",
    center: [43.77450, -79.49050],
    coordinates: createRectangle([43.77450, -79.49050], 60, 45),
  },
  {
    id: "fallback-schulich",
    name: "Schulich School of Business",
    category: "academic",
    center: [43.77700, -79.49900],
    coordinates: createRectangle([43.77700, -79.49900], 80, 60),
  },
  {
    id: "fallback-osgoode",
    name: "Osgoode Hall Law School",
    category: "academic",
    center: [43.77070, -79.50440],
    coordinates: createRectangle([43.77070, -79.50440], 70, 50),
  },
  {
    id: "fallback-curtis",
    name: "Curtis Lecture Halls",
    category: "academic",
    center: [43.77280, -79.50200],
    coordinates: createRectangle([43.77280, -79.50200], 60, 40),
  },
  {
    id: "fallback-accolade",
    name: "Accolade East",
    category: "academic",
    center: [43.77200, -79.49900],
    coordinates: createRectangle([43.77200, -79.49900], 50, 40),
  },
  {
    id: "fallback-dahdaleh",
    name: "Dahdaleh Building",
    category: "academic",
    center: [43.77127, -79.50061],
    coordinates: createRectangle([43.77127, -79.50061], 60, 45),
  },
  {
    id: "fallback-central",
    name: "Central Square",
    category: "academic",
    center: [43.77350, -79.50350],
    coordinates: createRectangle([43.77350, -79.50350], 100, 70),
  },

  // Transit
  {
    id: "fallback-pioneer",
    name: "Pioneer Village Station",
    category: "transit",
    center: [43.77806, -79.51194],
    coordinates: createRectangle([43.77806, -79.51194], 80, 40),
  },
  {
    id: "fallback-york-station",
    name: "York University Station",
    category: "transit",
    center: [43.77420, -79.49980],
    coordinates: createRectangle([43.77420, -79.49980], 70, 35),
  },

  // Residences
  {
    id: "fallback-founders",
    name: "Founders College",
    category: "residence",
    center: [43.77700, -79.50200],
    coordinates: createRectangle([43.77700, -79.50200], 50, 40),
  },
  {
    id: "fallback-winters",
    name: "Winters College",
    category: "residence",
    center: [43.77500, -79.50700],
    coordinates: createRectangle([43.77500, -79.50700], 50, 40),
  },
  {
    id: "fallback-vanier",
    name: "Vanier College",
    category: "residence",
    center: [43.77600, -79.50600],
    coordinates: createRectangle([43.77600, -79.50600], 50, 40),
  },
  {
    id: "fallback-bethune",
    name: "Bethune College",
    category: "residence",
    center: [43.77350, -79.50500],
    coordinates: createRectangle([43.77350, -79.50500], 50, 40),
  },
  {
    id: "fallback-stong",
    name: "Stong College",
    category: "residence",
    center: [43.77400, -79.49700],
    coordinates: createRectangle([43.77400, -79.49700], 50, 40),
  },
  {
    id: "fallback-quad",
    name: "The Quad",
    category: "residence",
    center: [43.76800, -79.50400],
    coordinates: createRectangle([43.76800, -79.50400], 80, 60),
  },
];

// Export filtered fallback buildings (only within campus bounds)
export const fallbackBuildings: BuildingPolygon[] = allFallbackBuildings.filter(
  building => isWithinCampus(building.center[0], building.center[1])
);

// Create a rectangle from center point
function createRectangle(center: [number, number], widthMeters: number, heightMeters: number): [number, number][] {
  // Convert meters to approximate degrees (at York's latitude)
  const latDelta = heightMeters / 111000 / 2;
  const lngDelta = widthMeters / (111000 * Math.cos(center[0] * Math.PI / 180)) / 2;

  return [
    [center[0] - latDelta, center[1] - lngDelta],
    [center[0] - latDelta, center[1] + lngDelta],
    [center[0] + latDelta, center[1] + lngDelta],
    [center[0] + latDelta, center[1] - lngDelta],
    [center[0] - latDelta, center[1] - lngDelta], // Close the polygon
  ];
}

// Get building info for popup
export function getBuildingInfo(building: BuildingPolygon): {
  name: string;
  category: BuildingCategory;
  color: string;
  icon: LucideIcon;
  label: string;
} {
  const config = buildingCategoryConfig[building.category];
  return {
    name: building.name,
    category: building.category,
    color: config.color,
    icon: config.icon,
    label: config.label,
  };
}
