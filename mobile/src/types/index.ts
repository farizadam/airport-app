export interface User {
  id: string;
  _id?: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  phone_number?: string;
  role: "driver" | "passenger" | "both";
  avatar_url?: string;
  rating?: number;
  rating_count?: number;
  created_at: string;
  createdAt?: string;
  date_of_birth?: string;
  bio?: string;
  languages?: string[];
  car_model?: string;
  car_color?: string;
  trips_completed?: number;
  email_verified?: boolean;
  phone_verified?: boolean;
}

export interface Airport {
  id: string;
  _id?: string;
  name: string;
  iata_code: string;
  city: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

export interface Ride {
  id: string;
  _id?: string;
  driver_id: string | User;
  driver?: User;
  airport_id: string | Airport;
  airport?: Airport;
  airport_name?: string; // Found in usage
  direction: "to_airport" | "from_airport";
  departure_datetime?: string;
  datetime_start?: string;
  home_address?: string;
  home_postcode: string;
  home_city: string;
  home_latitude?: number;
  home_longitude?: number;
  total_seats?: number;
  seats_total?: number;
  available_seats?: number;
  seats_left?: number;
  luggage_capacity?: number;
  luggage_left?: number;
  price_per_seat: number;
  status: "active" | "completed" | "cancelled";
  comment?: string; // Found in usage
  driver_comment?: string;
  route?: { coordinates: number[][] };
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  _id?: string;
  ride_id: string;
  ride?: Ride;
  passenger_id: string;
  passenger?: User;
  passenger_name?: string;
  seats?: number;
  seats_booked?: number;
  luggage_count?: number;
  total_price: number;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  pickup_location?: {
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  dropoff_location?: {
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SearchFilters {
  airport_id?: string;
  direction?: "to_airport" | "from_airport";
  date?: string;
  home_postcode?: string;
  seats_min?: number;
  page?: number;
  limit?: number;
  latitude?: number;
  longitude?: number;
  radius?: number;
}

export interface Offer {
  _id: string;
  driver: {
    _id: string;
    first_name: string;
    last_name: string;
    phone: string;
    rating: number;
  };
  ride?: string;
  price_per_seat: number;
  message?: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
}

export interface RideRequest {
  _id: string;
  passenger: {
    _id: string;
    first_name: string;
    last_name: string;
    phone: string;
    rating: number;
  };
  airport: {
    _id: string;
    name: string;
    iata_code: string;
    city: string;
  } | string;
  direction: "to_airport" | "from_airport";
  location_address: string;
  location_city: string;
  location_postcode?: string;
  location_latitude: number;
  location_longitude: number;
  preferred_datetime: string;
  time_flexibility: number;
  seats_needed: number;
  luggage_count: number;
  max_price_per_seat?: number;
  notes?: string;
  status: "pending" | "matched" | "accepted" | "cancelled" | "expired";
  matched_driver?: any;
  matched_ride?: any;
  offers: Offer[];
  expires_at: string;
  created_at: string;
  // Added by getMyOffers
  my_offer?: Offer;
  is_matched?: boolean;
}
