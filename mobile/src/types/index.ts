export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: "driver" | "passenger" | "both";
  avatar_url?: string;
  created_at: string;
}

export interface Airport {
  id: string;
  name: string;
  code: string;
  city: string;
  country: string;
}

export interface Ride {
  id: string;
  driver_id: string;
  driver?: User;
  airport_id: string;
  airport?: Airport;
  direction: "to_airport" | "from_airport";
  departure_datetime: string;
  home_address?: string;
  home_postcode: string;
  home_city: string;
  total_seats: number;
  available_seats: number;
  price_per_seat: number;
  status: "active" | "completed" | "cancelled";
  driver_comment?: string;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  ride_id: string;
  ride?: Ride;
  passenger_id: string;
  passenger?: User;
  seats: number;
  total_price: number;
  status: "pending" | "accepted" | "cancelled";
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
}
