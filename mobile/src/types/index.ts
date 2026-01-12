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
  created_at: string;
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
  driver_id: string;
  driver?: User;
  airport_id: string;
  airport?: Airport;
  direction: "to_airport" | "from_airport";
  departure_datetime?: string;
  datetime_start?: string;
  home_address?: string;
  home_postcode: string;
  home_city: string;
  total_seats?: number;
  seats_total?: number;
  available_seats?: number;
  seats_left?: number;
  price_per_seat: number;
  status: "active" | "completed" | "cancelled";
  driver_comment?: string;
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
  total_price: number;
  status: "pending" | "accepted" | "rejected" | "cancelled";
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
