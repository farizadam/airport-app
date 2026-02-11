import api from "@/lib/api";
import { Airport } from "@/types";
import { create } from "zustand";

interface FetchAirportsParams {
  q?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
  limit?: number;
}

interface AirportState {
  airports: Airport[];
  isLoading: boolean;
  fetchAirports: (params?: FetchAirportsParams) => Promise<void>;
}

export const useAirportStore = create<AirportState>((set) => ({
  airports: [],
  isLoading: false,

  fetchAirports: async (params?: FetchAirportsParams) => {
    try {
      set({ isLoading: true });
      const response = await api.get<{ data: Airport[] }>("/airports", { params });
      const airports = response.data.data || [];
      // Filter out airports with missing coordinates so map markers always render
      const validAirports = airports.filter(
        (a: Airport) =>
          a.latitude != null &&
          a.longitude != null &&
          !isNaN(a.latitude) &&
          !isNaN(a.longitude)
      );
      set({ airports: validAirports });
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Failed to fetch airports"
      );
    } finally {
      set({ isLoading: false });
    }
  },
}));
