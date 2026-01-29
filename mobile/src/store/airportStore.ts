import api from "@/lib/api";
import { Airport } from "@/types";
import { create } from "zustand";

interface AirportState {
  airports: Airport[];
  isLoading: boolean;
  fetchAirports: () => Promise<void>;
}

export const useAirportStore = create<AirportState>((set) => ({
  airports: [],
  isLoading: false,

  fetchAirports: async (params?: { q?: string; latitude?: number; longitude?: number; radius?: number }) => {
    try {
      set({ isLoading: true });
      const response = await api.get<{ data: Airport[] }>("/airports", { params });
      set({ airports: response.data.data });
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Failed to fetch airports"
      );
    } finally {
      set({ isLoading: false });
    }
  },
}));
