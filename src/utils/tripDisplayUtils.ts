/**
 * Utility functions for consistent trip display across the app
 * 
 * DIRECTION LOGIC:
 * - "to_airport": City → Airport (start at city/home, end at airport)
 * - "from_airport": Airport → City (start at airport, end at city/home)
 * 
 * VISUAL RULES:
 * - Start point (top): Red location icon for city, Blue airplane for airport
 * - End point (bottom): Blue airplane for airport, Red location for city
 */

export type TripDirection = "to_airport" | "from_airport";

export interface LocationInfo {
  pickup: string;
  dropoff: string;
  pickupIcon: "location-sharp" | "airplane";
  dropoffIcon: "location-sharp" | "airplane";
  pickupColor: string;
  dropoffColor: string;
  pickupBg: string;
  dropoffBg: string;
}

export interface TripData {
  direction?: TripDirection;
  // For rides
  home_city?: string;
  home_address?: string;
  // For requests
  location_city?: string;
  location_address?: string;
  location?: {
    city?: string;
    address?: string;
  };
  // For airport
  airport?: {
    name?: string;
    iata_code?: string;
  } | string;
  airport_id?: {
    name?: string;
    iata_code?: string;
  };
  airport_name?: string;
  // For bookings
  ride?: TripData;
  // Pickup/dropoff if already set
  pickup_location?: {
    city?: string;
    address?: string;
  };
  dropoff_location?: {
    city?: string;
    address?: string;
  };
}

// Colors
export const LOCATION_COLORS = {
  city: "#EF4444",      // Red for city/home locations
  airport: "#007AFF",   // Blue for airport
  cityBg: "#FEF2F2",    // Light red background
  airportBg: "#EFF6FF", // Light blue background
} as const;

/**
 * Format location to show just the city name
 * Removes country names and excess address parts
 */
export function formatCity(location: string | undefined | null): string {
  if (!location) return "Unknown";
  
  const cleanLoc = location.trim();
  if (!cleanLoc) return "Unknown";
  if (!cleanLoc.includes(",")) return cleanLoc;
  
  // Split and trim parts
  let parts = cleanLoc.split(",").map(p => p.trim());
  
  // Remove common country names (case insensitive)
  const countries = [
    "morocco", "maroc", "kingdom of morocco", 
    "france", 
    "espagne", "spain", "españa",
    "usa", "united states", 
    "uk", "united kingdom",
    "algeria", "algérie",
    "tunisia", "tunisie"
  ];
  
  // Remove the last part if it is a country
  if (parts.length > 1 && countries.includes(parts[parts.length - 1].toLowerCase())) {
    parts.pop();
  }
  
  // If we have parts left, return the last one (usually the city)
  if (parts.length > 0) {
    return parts[parts.length - 1];
  }
  
  return cleanLoc;
}

/**
 * Get airport name from various data structures
 */
export function getAirportName(data: TripData): string {
  if (data.airport && typeof data.airport === 'object' && data.airport.name) {
    return data.airport.name;
  }
  if (data.airport_id && typeof data.airport_id === 'object' && data.airport_id.name) {
    return data.airport_id.name;
  }
  if (data.airport_name) {
    return data.airport_name;
  }
  if (data.ride) {
    return getAirportName(data.ride);
  }
  return "Airport";
}

/**
 * Get city/home location from various data structures
 */
export function getCityLocation(data: TripData): string {
  // Priority: specific pickup/dropoff > location > home
  if (data.pickup_location?.city) {
    return formatCity(data.pickup_location.city);
  }
  if (data.pickup_location?.address) {
    return formatCity(data.pickup_location.address);
  }
  if (data.dropoff_location?.city) {
    return formatCity(data.dropoff_location.city);
  }
  if (data.dropoff_location?.address) {
    return formatCity(data.dropoff_location.address);
  }
  if (data.location?.city) {
    return formatCity(data.location.city);
  }
  if (data.location?.address) {
    return formatCity(data.location.address);
  }
  if (data.location_city) {
    return formatCity(data.location_city);
  }
  if (data.location_address) {
    return formatCity(data.location_address);
  }
  if (data.home_city) {
    return formatCity(data.home_city);
  }
  if (data.home_address) {
    return formatCity(data.home_address);
  }
  if (data.ride) {
    return getCityLocation(data.ride);
  }
  return "Unknown Location";
}

/**
 * Get pickup and dropoff locations based on direction
 * 
 * RULE:
 * - to_airport: City (top) → Airport (bottom)
 * - from_airport: Airport (top) → City (bottom)
 */
export function getLocationInfo(data: TripData): LocationInfo {
  const isToAirport = data.direction === "to_airport";
  const airportName = getAirportName(data);
  const cityName = getCityLocation(data);
  
  if (isToAirport) {
    // City → Airport
    return {
      pickup: cityName,
      dropoff: airportName,
      pickupIcon: "location-sharp",
      dropoffIcon: "airplane",
      pickupColor: LOCATION_COLORS.city,
      dropoffColor: LOCATION_COLORS.airport,
      pickupBg: LOCATION_COLORS.cityBg,
      dropoffBg: LOCATION_COLORS.airportBg,
    };
  } else {
    // Airport → City
    return {
      pickup: airportName,
      dropoff: cityName,
      pickupIcon: "airplane",
      dropoffIcon: "location-sharp",
      pickupColor: LOCATION_COLORS.airport,
      dropoffColor: LOCATION_COLORS.city,
      pickupBg: LOCATION_COLORS.airportBg,
      dropoffBg: LOCATION_COLORS.cityBg,
    };
  }
}

/**
 * Format date and time consistently
 */
export function formatTripDateTime(dateStr: string | Date | undefined): { date: string; time: string; full: string } {
  if (!dateStr) {
    return { date: "No date", time: "--:--", full: "No date" };
  }
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return { date: "Invalid date", time: "--:--", full: "Invalid date" };
  }
  
  return {
    date: date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
    time: date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }),
    full: date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
  };
}

/**
 * Format seats display consistently
 */
export function formatSeats(
  seats?: number, 
  totalSeats?: number, 
  seatsLeft?: number,
  type?: "available" | "booked" | "needed"
): string {
  if (totalSeats !== undefined && seatsLeft !== undefined) {
    const booked = totalSeats - seatsLeft;
    return `${booked}/${totalSeats} seats`;
  }
  
  if (seats === undefined || seats === null) {
    return "-- seats";
  }
  
  switch (type) {
    case "needed":
      return `${seats} seat${seats !== 1 ? 's' : ''} needed`;
    case "available":
      return `${seats} seat${seats !== 1 ? 's' : ''} available`;
    case "booked":
      return `${seats} seat${seats !== 1 ? 's' : ''} booked`;
    default:
      return `${seats} seat${seats !== 1 ? 's' : ''}`;
  }
}

/**
 * Get departure datetime from various data structures
 */
export function getDepartureTime(data: any): string | undefined {
  return data.departure_datetime || 
         data.datetime_start || 
         data.preferred_datetime ||
         data.ride?.departure_datetime ||
         data.ride?.datetime_start;
}

/**
 * Get seats count from various data structures
 */
export function getSeatsCount(data: any, type: "ride" | "request" | "booking"): number {
  switch (type) {
    case "ride":
      return data.available_seats || data.seats_left || 0;
    case "request":
      return data.seats_needed || 0;
    case "booking":
      return data.seats_booked || data.seats || 0;
    default:
      return data.seats || 0;
  }
}

/**
 * Get total seats for rides
 */
export function getTotalSeats(data: any): number | undefined {
  return data.seats_total || data.total_seats;
}
