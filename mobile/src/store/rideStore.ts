import api from "@/lib/api";
import { PaginatedResponse, Ride, SearchFilters } from "@/types";
import { create } from "zustand";

interface RideState {
  rides: Ride[];
  myRides: Ride[];
  currentRide: Ride | null;
  isLoading: boolean;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null;
  searchRides: (filters: SearchFilters) => Promise<void>;
  getRideById: (id: string) => Promise<void>;
  getMyRides: () => Promise<void>;
  createRide: (data: CreateRideData) => Promise<Ride>;
  updateRide: (id: string, data: Partial<CreateRideData>) => Promise<void>;
  cancelRide: (id: string) => Promise<void>;
  setCurrentRide: (ride: Ride | null) => void;
}

interface CreateRideData {
  airport_id: string;
  direction: "to_airport" | "from_airport";
  departure_datetime: string;
  home_address?: string;
  home_postcode: string;
  home_city: string;
  total_seats: number;
  price_per_seat: number;
  driver_comment?: string;
}

// Map frontend direction to backend direction
const mapDirection = (dir: "to_airport" | "from_airport"): "home_to_airport" | "airport_to_home" => {
  return dir === "to_airport" ? "home_to_airport" : "airport_to_home";
};

export const useRideStore = create<RideState>((set) => ({
  rides: [],
  myRides: [],
  currentRide: null,
  isLoading: false,
  pagination: null,

  searchRides: async (filters) => {
    try {
      set({ isLoading: true });
      const params = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await api.get<PaginatedResponse<Ride>>(
        `/rides/search?${params}`
      );
      set({
        rides: response.data.data,
        pagination: response.data.pagination,
      });
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Failed to search rides"
      );
    } finally {
      set({ isLoading: false });
    }
  },

  getRideById: async (id: string) => {
    set({ isLoading: true });
    try {
      console.log("Fetching ride with ID:", id, "Type:", typeof id);
      const response = await api.get(`/rides/${id}`);
      console.log("Ride response:", response.data);

      // Handle both array and object responses
      const rideData =
        Array.isArray(response.data.data) && response.data.data.length > 0
          ? response.data.data[0]
          : response.data.data || response.data;

      console.log("Setting current ride:", rideData);
      set({ currentRide: rideData });
    } catch (error: any) {
      console.error("Error fetching ride - Full error:", error);
      console.error("Error response data:", error.response?.data);
      console.error("Error message:", error.message);
      // Don't throw, just log the error
      set({ currentRide: null });
    } finally {
      set({ isLoading: false });
    }
  },

  getMyRides: async () => {
    try {
      set({ isLoading: true });
      const response = await api.get<{ data: Ride[] }>("/rides/my-rides");
      set({ myRides: response.data.data });
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Failed to get rides");
    } finally {
      set({ isLoading: false });
    }
  },

  createRide: async (data) => {
    try {
      // Map frontend field names to backend field names
      const backendData = {
        airport_id: data.airport_id,
        direction: mapDirection(data.direction),
        datetime_start: data.departure_datetime,
        home_address: data.home_address || "",
        home_postcode: data.home_postcode || "00000",
        home_city: data.home_city || "Unknown",
        seats_total: data.total_seats,
        price_per_seat: data.price_per_seat,
        comment: data.driver_comment || "",
      };
      console.log("Creating ride with data:", JSON.stringify(backendData, null, 2));
      const response = await api.post<{ data: Ride }>("/rides", backendData);
      return response.data.data;
    } catch (error: any) {
      console.error("Create ride error - Full response:", JSON.stringify(error.response?.data, null, 2));
      // Show detailed validation errors
      const errorData = error.response?.data;
      if (errorData?.errors && Array.isArray(errorData.errors)) {
        const errorMessages = errorData.errors.map((e: any) => `${e.field}: ${e.message}`).join('\n');
        console.error("Validation errors:\n", errorMessages);
        throw new Error(`Validation failed:\n${errorMessages}`);
      }
      throw new Error(error.response?.data?.message || "Failed to create ride");
    }
  },

  updateRide: async (id, data) => {
    try {
      const response = await api.put<{ data: Ride }>(`/rides/${id}`, data);
      set((state) => ({
        myRides: state.myRides.map((ride) =>
          ride.id === id ? response.data.data : ride
        ),
        currentRide:
          state.currentRide?.id === id ? response.data.data : state.currentRide,
      }));
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Failed to update ride");
    }
  },

  cancelRide: async (id) => {
    try {
      await api.delete(`/rides/${id}`);
      set((state) => ({
        myRides: state.myRides.filter((ride) => ride.id !== id),
      }));
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Failed to cancel ride");
    }
  },

  setCurrentRide: (ride) => set({ currentRide: ride }),
}));
