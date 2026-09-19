// York University Campus Building Data
// Organized by category with coordinates and metadata

import { BookOpen, Dumbbell, GraduationCap, Home, TrainFront, Utensils, type LucideIcon } from "lucide-react";

export type BuildingCategory =
  | "gym"
  | "food"
  | "study"
  | "academic"
  | "transit"
  | "residence";

export interface YorkBuilding {
  id: string;
  name: string;
  category: BuildingCategory;
  coordinates: [number, number]; // [lat, lng]
  description?: string;
  hours?: string;
  amenities?: string[];
}

export const buildingCategoryConfig: Record<BuildingCategory, {
  color: string;
  label: string;
  icon: LucideIcon;
}> = {
  gym: { color: "#EF4444", label: "Gym/Fitness", icon: Dumbbell },
  food: { color: "#F97316", label: "Food/Dining", icon: Utensils },
  study: { color: "#3B82F6", label: "Study Spaces", icon: BookOpen },
  academic: { color: "#6B7280", label: "Academic", icon: GraduationCap },
  transit: { color: "#A855F7", label: "Transit", icon: TrainFront },
  residence: { color: "#EAB308", label: "Residences", icon: Home },
};

export const yorkBuildings: YorkBuilding[] = [
  // ============ GYM/FITNESS ============
  {
    id: "tait-mckenzie",
    name: "Tait McKenzie Centre",
    category: "gym",
    coordinates: [43.77442, -79.50956],
    description: "Main athletics and recreation facility with gym, pools, and courts",
    hours: "Mon-Fri 6am-11pm, Sat-Sun 8am-8pm",
    amenities: ["Gym", "Swimming Pool", "Basketball Courts", "Squash Courts"],
  },
  {
    id: "aviva-centre",
    name: "Tennis Canada Aviva Centre",
    category: "gym",
    coordinates: [43.77162, -79.51210],
    description: "Professional tennis facility hosting Rogers Cup",
    hours: "Varies by season",
    amenities: ["Tennis Courts", "Pro Shop"],
  },
  {
    id: "track-field",
    name: "Toronto Track & Field Centre",
    category: "gym",
    coordinates: [43.77500, -79.48500],
    description: "Olympic-standard track and field facility",
    hours: "6am-10pm",
    amenities: ["Track", "Field Events", "Training Rooms"],
  },
  {
    id: "ice-gardens",
    name: "Ice Gardens at York",
    category: "gym",
    coordinates: [43.77300, -79.50200],
    description: "Ice rink for hockey and skating",
    hours: "Schedule varies",
    amenities: ["Ice Rinks", "Skate Rental"],
  },
  {
    id: "york-stadium",
    name: "York Lions Stadium",
    category: "gym",
    coordinates: [43.77600, -79.48400],
    description: "Main outdoor stadium for football and soccer",
    hours: "Event-based",
    amenities: ["Stadium Seating", "Track"],
  },

  // ============ FOOD/DINING ============
  {
    id: "student-centre-food",
    name: "Student Centre Food Court",
    category: "food",
    coordinates: [43.77635, -79.49595],
    description: "Main food court with multiple vendors",
    hours: "Mon-Fri 8am-8pm",
    amenities: ["Multiple Restaurants", "Seating Area"],
  },
  {
    id: "tims-central",
    name: "Tim Hortons - Central Square",
    category: "food",
    coordinates: [43.77350, -79.50350],
    description: "Coffee and quick bites",
    hours: "Mon-Fri 7am-7pm",
  },
  {
    id: "tims-william-small",
    name: "Tim Hortons - William Small",
    category: "food",
    coordinates: [43.77500, -79.49600],
    description: "Coffee and quick bites near library",
    hours: "Mon-Fri 7:30am-6pm",
  },
  {
    id: "tims-dahdaleh",
    name: "Tim Hortons - Dahdaleh",
    category: "food",
    coordinates: [43.77127, -79.50061],
    description: "Coffee and quick bites",
    hours: "Mon-Fri 8am-5pm",
  },
  {
    id: "winters-cafeteria",
    name: "Winters College Cafeteria",
    category: "food",
    coordinates: [43.77450, -79.50800],
    description: "College dining hall",
    hours: "Mon-Fri 8am-7pm",
  },
  {
    id: "stong-dining",
    name: "Stong College Dining",
    category: "food",
    coordinates: [43.77350, -79.49800],
    description: "College dining hall",
    hours: "Mon-Fri 8am-7pm",
  },
  {
    id: "york-lanes",
    name: "York Lanes Mall",
    category: "food",
    coordinates: [43.77280, -79.50080],
    description: "Shopping mall with food options",
    hours: "Mon-Fri 9am-6pm",
    amenities: ["Food Court", "Retail Stores", "Services"],
  },

  // ============ STUDY SPACES ============
  {
    id: "scott-library",
    name: "Scott Library",
    category: "study",
    coordinates: [43.77380, -79.50380],
    description: "Main university library with extensive study spaces",
    hours: "Mon-Thu 8am-11pm, Fri 8am-8pm, Sat-Sun 10am-8pm",
    amenities: ["Study Rooms", "Computer Labs", "Quiet Zones", "Group Study"],
  },
  {
    id: "steacie-library",
    name: "Steacie Science Library",
    category: "study",
    coordinates: [43.77250, -79.50550],
    description: "Science and engineering focused library",
    hours: "Mon-Fri 9am-9pm, Sat-Sun 12pm-6pm",
    amenities: ["Science Resources", "Study Carrels"],
  },
  {
    id: "william-small",
    name: "William Small Centre",
    category: "study",
    coordinates: [43.77400, -79.50500],
    description: "Study spaces and student services",
    hours: "Mon-Fri 8am-10pm",
    amenities: ["Study Lounges", "Computer Stations"],
  },

  // ============ ACADEMIC BUILDINGS ============
  {
    id: "ross-building",
    name: "Ross Building",
    category: "academic",
    coordinates: [43.77436, -79.49315],
    description: "Large academic building with lecture halls and offices",
    hours: "Mon-Fri 7am-10pm",
    amenities: ["Lecture Halls", "Classrooms", "Faculty Offices"],
  },
  {
    id: "vari-hall",
    name: "Vari Hall",
    category: "academic",
    coordinates: [43.77310, -79.50360],
    description: "Iconic rotunda building, main campus landmark",
    hours: "Mon-Fri 7am-10pm",
    amenities: ["Rotunda", "Event Space", "Classrooms"],
  },
  {
    id: "lassonde",
    name: "Lassonde Engineering Building",
    category: "academic",
    coordinates: [43.77410, -79.49080],
    description: "Engineering and computer science building",
    hours: "Mon-Fri 7am-11pm, Sat-Sun 9am-6pm",
    amenities: ["Labs", "Maker Space", "Study Areas"],
  },
  {
    id: "schulich",
    name: "Schulich School of Business",
    category: "academic",
    coordinates: [43.77700, -79.49900],
    description: "Business school with modern facilities",
    hours: "Mon-Fri 7am-10pm",
    amenities: ["Case Rooms", "Career Centre", "Cafeteria"],
  },
  {
    id: "accolade-east",
    name: "Accolade East",
    category: "academic",
    coordinates: [43.77200, -79.49900],
    description: "Arts and performance building",
    hours: "Mon-Fri 8am-10pm",
    amenities: ["Theatre", "Rehearsal Rooms", "Art Studios"],
  },
  {
    id: "curtis-lecture",
    name: "Curtis Lecture Halls",
    category: "academic",
    coordinates: [43.77280, -79.50200],
    description: "Large lecture hall complex",
    hours: "Mon-Fri 7am-10pm",
    amenities: ["Large Lecture Halls", "AV Equipment"],
  },
  {
    id: "osgoode",
    name: "Osgoode Hall Law School",
    category: "academic",
    coordinates: [43.77070, -79.50440],
    description: "Canada's first law school",
    hours: "Mon-Fri 8am-10pm",
    amenities: ["Law Library", "Moot Court", "Clinics"],
  },
  {
    id: "farquharson",
    name: "Farquharson Life Sciences",
    category: "academic",
    coordinates: [43.77350, -79.50600],
    description: "Biology and life sciences building",
    hours: "Mon-Fri 8am-9pm",
    amenities: ["Research Labs", "Lecture Halls"],
  },
  {
    id: "dahdaleh",
    name: "Dahdaleh Building",
    category: "academic",
    coordinates: [43.77127, -79.50061],
    description: "Health sciences and research facility",
    hours: "Mon-Fri 8am-9pm",
    amenities: ["Health Clinics", "Research Labs"],
  },
  {
    id: "bergeron",
    name: "Bergeron Centre",
    category: "academic",
    coordinates: [43.77450, -79.49050],
    description: "Engineering Excellence building",
    hours: "Mon-Fri 7am-11pm",
    amenities: ["Labs", "Study Spaces", "Cafeteria"],
  },
  {
    id: "central-square",
    name: "Central Square",
    category: "academic",
    coordinates: [43.77350, -79.50350],
    description: "Central hub connecting major buildings",
    hours: "24/7 access",
    amenities: ["Student Services", "Shops", "Food"],
  },

  // ============ TRANSIT ============
  {
    id: "pioneer-village",
    name: "Pioneer Village Station",
    category: "transit",
    coordinates: [43.77806, -79.51194],
    description: "TTC Line 1 subway station",
    hours: "6am-1:30am daily",
    amenities: ["Subway", "Bus Terminal", "Presto"],
  },
  {
    id: "york-station",
    name: "York University Station",
    category: "transit",
    coordinates: [43.77420, -79.49980],
    description: "TTC Line 1 subway station on campus",
    hours: "6am-1:30am daily",
    amenities: ["Subway", "Bus Connections"],
  },
  {
    id: "keele-bus-stop",
    name: "Keele St Bus Terminal",
    category: "transit",
    coordinates: [43.77500, -79.48800],
    description: "Major bus stop along Keele Street",
    hours: "24/7",
    amenities: ["YRT/Viva Buses", "TTC Connections"],
  },

  // ============ RESIDENCES ============
  {
    id: "founders",
    name: "Founders College Residence",
    category: "residence",
    coordinates: [43.77700, -79.50200],
    description: "Undergraduate residence",
    amenities: ["Single/Double Rooms", "Common Areas"],
  },
  {
    id: "winters-res",
    name: "Winters College Residence",
    category: "residence",
    coordinates: [43.77500, -79.50700],
    description: "Undergraduate residence",
    amenities: ["Single/Double Rooms", "Dining Hall"],
  },
  {
    id: "vanier",
    name: "Vanier College Residence",
    category: "residence",
    coordinates: [43.77600, -79.50600],
    description: "Undergraduate residence",
    amenities: ["Single/Double Rooms", "Common Areas"],
  },
  {
    id: "tatham",
    name: "Tatham Hall",
    category: "residence",
    coordinates: [43.78200, -79.49900],
    description: "Graduate and mature student residence",
    amenities: ["Apartments", "Quiet Environment"],
  },
  {
    id: "bethune",
    name: "Bethune College Residence",
    category: "residence",
    coordinates: [43.77350, -79.50500],
    description: "Undergraduate residence",
    amenities: ["Single/Double Rooms", "Study Lounges"],
  },
  {
    id: "stong-res",
    name: "Stong College Residence",
    category: "residence",
    coordinates: [43.77400, -79.49700],
    description: "Undergraduate residence",
    amenities: ["Single/Double Rooms", "Common Areas"],
  },
  {
    id: "the-quad",
    name: "The Quad",
    category: "residence",
    coordinates: [43.76800, -79.50400],
    description: "Modern apartment-style student housing",
    amenities: ["Apartments", "Gym", "Study Rooms"],
  },
  {
    id: "calumet-res",
    name: "Calumet College Residence",
    category: "residence",
    coordinates: [43.77250, -79.49400],
    description: "Undergraduate residence",
    amenities: ["Single/Double Rooms", "Common Areas"],
  },
];

// Helper function to get buildings by category
export function getBuildingsByCategory(category: BuildingCategory): YorkBuilding[] {
  return yorkBuildings.filter(b => b.category === category);
}

// Helper function to get building by ID
export function getBuildingById(id: string): YorkBuilding | undefined {
  return yorkBuildings.find(b => b.id === id);
}
