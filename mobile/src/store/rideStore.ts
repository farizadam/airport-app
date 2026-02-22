import api from "@/lib/api";
import { PaginatedResponse, Ride, SearchFilters } from "@/types";
import { create } from "zustand";
import { useWalletStore } from "./walletStore";

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
  fetchRideById: (id: string) => Promise<Ride>;
  getMyRides: () => Promise<void>;
  createRide: (data: CreateRideData) => Promise<Ride>;
  updateRide: (id: string, data: Partial<CreateRideData>) => Promise<void>;
  cancelRide: (id: string) => Promise<void>;
  setCurrentRide: (ride: Ride | null) => void;
  fetchRoutePreview: (origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }) => Promise<Array<{ latitude: number; longitude: number }>>;
}

interface CreateRideData {
  airport_id: string;
  direction: "to_airport" | "from_airport";
  departure_datetime: string;
  home_address?: string;
  home_postcode: string;
  home_city: string;
  home_latitude?: number;
  home_longitude?: number;
  total_seats: number;
  price_per_seat: number;
  luggage_capacity?: {
    max_10kg: number;
    max_20kg: number;
    max_hors_norme: number;
    max_sac: number;
  };
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
    set({ isLoading: true, currentRide: null });
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

  fetchRideById: async (id: string) => {
    try {
      const response = await api.get(`/rides/${id}`);
      const rideData =
        Array.isArray(response.data.data) && response.data.data.length > 0
          ? response.data.data[0]
          : response.data.data || response.data;
      return rideData;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Failed to fetch ride");
    }
  },

  getMyRides: async () => {
    try {
      console.log("🚗 Fetching my rides from API...");
      set({ isLoading: true });
      const response = await api.get("/rides/my-rides");
      console.log("✅ API Response:", response.data);
      console.log("✅ My rides fetched:", response.data.data?.length || 0, "rides");
      
      const rides = response.data.data || [];
      set({ myRides: rides, isLoading: false });
      console.log("✅ myRides state updated with", rides.length, "rides");
      return rides;
    } catch (error: any) {
      console.error("❌ Failed to fetch my rides:", error.response?.data || error.message);
      set({ isLoading: false });
      // Don't throw - just return empty array so UI still works
      return [];
    }
  },

  createRide: async (data) => {
    set({ isLoading: true });
    try {
      // Map frontend field names to backend field names
      const backendData = {
        airport_id: data.airport_id,
        direction: mapDirection(data.direction),
        datetime_start: data.departure_datetime,
        home_address: data.home_address || "",
        home_postcode: data.home_postcode || "00000",
        home_city: data.home_city || "Unknown",
        home_latitude: data.home_latitude,
        home_longitude: data.home_longitude,
        seats_total: data.total_seats,
        price_per_seat: data.price_per_seat,
        luggage_capacity: data.luggage_capacity,
        comment: data.driver_comment || "",
      };
      console.log("🚗 Creating ride with data:", JSON.stringify(backendData, null, 2));
      const response = await api.post("/rides", backendData);
      
      console.log("✅ Ride created successfully!");
      console.log("📦 Response data:", response.data);
      
      const newRide = response.data.data;
      console.log("🎯 New ride object:", newRide);
      
      // Add the new ride to myRides state - same pattern as requests
      set((state) => {
        console.log("📝 Current myRides count:", state.myRides?.length || 0);
        const updatedRides = [newRide, ...(state.myRides || [])];
        console.log("📝 Updated myRides count:", updatedRides.length);
        console.log("📝 First ride in array:", updatedRides[0]);
        return { 
          myRides: updatedRides,
          isLoading: false
        };
      });
      
      return newRide;
    } catch (error: any) {
      console.error("❌ Create ride error - Full response:", JSON.stringify(error.response?.data, null, 2));
      set({ isLoading: false });
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
      const backendData: any = {};
      
      if (data.airport_id) backendData.airport_id = data.airport_id;
      if (data.direction) backendData.direction = mapDirection(data.direction);
      if (data.departure_datetime) backendData.datetime_start = data.departure_datetime;
      if (data.home_address !== undefined) backendData.home_address = data.home_address;
      if (data.home_postcode) backendData.home_postcode = data.home_postcode;
      if (data.home_city) backendData.home_city = data.home_city;
      if (data.home_latitude) backendData.home_latitude = data.home_latitude;
      if (data.home_longitude) backendData.home_longitude = data.home_longitude;
      if (data.total_seats) backendData.seats_total = data.total_seats;
      if (data.price_per_seat) backendData.price_per_seat = data.price_per_seat;
      if (data.luggage_capacity !== undefined) backendData.luggage_capacity = data.luggage_capacity;
      if (data.driver_comment !== undefined) backendData.comment = data.driver_comment;

      const response = await api.patch<{ data: Ride }>(`/rides/${id}`, backendData);
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
      // Refresh wallet after cancellation (driver gets deducted, refunds processed)
      try {
        await useWalletStore.getState().getWallet();
      } catch (e) {
        console.log("Wallet refresh after cancel failed:", e);
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Failed to cancel ride");
    }
  },

  setCurrentRide: (ride) => set({ currentRide: ride }),

  fetchRoutePreview: async (origin, destination) => {
    try {
      const response = await api.post("/rides/route-preview", {
        origin: { lat: origin.latitude, lng: origin.longitude },
        destination: { lat: destination.latitude, lng: destination.longitude },
      });
      return response.data.data;
    } catch (error: any) {
      console.error("Failed to fetch route preview:", error);
      // Return empty array on error to handle gracefully
      return [];
    }
  },
}));
