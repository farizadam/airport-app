import api from "@/lib/api";
import { create } from "zustand";

export interface SavedLocation {
  id: string;
  _id?: string;
  name: string;
  address: string;
  city: string;
  postcode: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  placeId: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface LocationState {
  savedLocations: SavedLocation[];
  isLoading: boolean;
  getSavedLocations: () => Promise<void>;
  addSavedLocation: (
    location: Omit<SavedLocation, "id" | "_id">
  ) => Promise<SavedLocation>;
  updateSavedLocation: (
    locationId: string,
    updates: Partial<SavedLocation>
  ) => Promise<void>;
  deleteSavedLocation: (locationId: string) => Promise<void>;
}

export const useLocationStore = create<LocationState>((set, get) => ({
  savedLocations: [],
  isLoading: false,

  getSavedLocations: async () => {
    try {
      set({ isLoading: true });
      const response = await api.get<{ data: SavedLocation[] }>(
        "/users/me/locations"
      );
      const locations = response.data.data.map((loc) => ({
        ...loc,
        id: loc._id || loc.id,
      }));
      set({ savedLocations: locations });
    } catch (error: any) {
      console.error(
        "Failed to get saved locations:",
        error.response?.data || error.message
      );
      throw new Error(
        error.response?.data?.message || "Failed to get saved locations"
      );
    } finally {
      set({ isLoading: false });
    }
  },

  addSavedLocation: async (location) => {
    try {
      const response = await api.post<{ data: SavedLocation }>(
        "/users/me/locations",
        location
      );
      const newLocation = {
        ...response.data.data,
        id: response.data.data._id || response.data.data.id,
      };
      set((state) => ({
        savedLocations: [...state.savedLocations, newLocation],
      }));
      return newLocation;
    } catch (error: any) {
      console.error(
        "Failed to save location:",
        error.response?.data || error.message
      );
      throw new Error(
        error.response?.data?.message || "Failed to save location"
      );
    }
  },

  updateSavedLocation: async (locationId, updates) => {
    try {
      const response = await api.patch<{ data: SavedLocation }>(
        `/users/me/locations/${locationId}`,
        updates
      );
      const updatedLocation = {
        ...response.data.data,
        id: response.data.data._id || response.data.data.id,
      };
      set((state) => ({
        savedLocations: state.savedLocations.map((loc) =>
          loc.id === locationId ? updatedLocation : loc
        ),
      }));
    } catch (error: any) {
      console.error(
        "Failed to update location:",
        error.response?.data || error.message
      );
      throw new Error(
        error.response?.data?.message || "Failed to update location"
      );
    }
  },

  deleteSavedLocation: async (locationId) => {
    try {
      await api.delete(`/users/me/locations/${locationId}`);
      set((state) => ({
        savedLocations: state.savedLocations.filter(
          (loc) => loc.id !== locationId
        ),
      }));
    } catch (error: any) {
      console.error(
        "Failed to delete location:",
        error.response?.data || error.message
      );
      throw new Error(
        error.response?.data?.message || "Failed to delete location"
      );
    }
  },
}));
