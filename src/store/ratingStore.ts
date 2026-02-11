import { create } from "zustand";
import { api } from "../lib/api";

export interface RatingUser {
  id: string;
  _id?: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  rating?: number;
  rating_count?: number;
}

export interface Rating {
  id: string;
  _id?: string;
  from_user: RatingUser;
  to_user: RatingUser;
  booking_id: string;
  ride_id: string;
  type: "driver_to_passenger" | "passenger_to_driver";
  stars: number;
  comment?: string;
  createdAt: string;
}

export interface PendingRating {
  booking_id: string;
  ride_id: string;
  type: "driver_to_passenger" | "passenger_to_driver";
  target_user: RatingUser;
  ride: {
    direction: string;
    departure_datetime: string;
  };
}

export interface RatingStats {
  user: RatingUser;
  distribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  recentReviews: Rating[];
}

interface CanRateResponse {
  canRate: boolean;
  reason?: string;
  ratingType?: string;
  targetUser?: RatingUser;
  existingRating?: Rating;
}

interface RatingState {
  myRatings: Rating[];
  pendingRatings: PendingRating[];
  userRatings: Rating[];
  ratingStats: RatingStats | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchMyRatings: () => Promise<void>;
  fetchPendingRatings: () => Promise<void>;
  fetchUserRatings: (userId: string) => Promise<void>;
  fetchUserRatingStats: (userId: string) => Promise<RatingStats | null>;
  checkCanRate: (bookingId: string) => Promise<CanRateResponse | null>;
  submitRating: (bookingId: string, stars: number, comment?: string) => Promise<boolean>;
  clearError: () => void;
}

export const useRatingStore = create<RatingState>((set, get) => ({
  myRatings: [],
  pendingRatings: [],
  userRatings: [],
  ratingStats: null,
  isLoading: false,
  error: null,

  fetchMyRatings: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get("/ratings/me");
      if (response.data.success) {
        set({ myRatings: response.data.data.ratings });
      }
    } catch (error: any) {
      set({ error: error.response?.data?.message || "Failed to fetch ratings" });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchPendingRatings: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get("/ratings/pending");
      if (response.data.success) {
        set({ pendingRatings: response.data.data.pending });
      }
    } catch (error: any) {
      set({ error: error.response?.data?.message || "Failed to fetch pending ratings" });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchUserRatings: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/ratings/user/${userId}`);
      if (response.data.success) {
        set({ userRatings: response.data.data.ratings });
      }
    } catch (error: any) {
      set({ error: error.response?.data?.message || "Failed to fetch user ratings" });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchUserRatingStats: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/ratings/stats/${userId}`);
      if (response.data.success) {
        set({ ratingStats: response.data.data });
        return response.data.data;
      }
      return null;
    } catch (error: any) {
      set({ error: error.response?.data?.message || "Failed to fetch rating stats" });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  checkCanRate: async (bookingId: string) => {
    try {
      const response = await api.get(`/ratings/can-rate/${bookingId}`);
      if (response.data.success) {
        return response.data.data;
      }
      return null;
    } catch (error: any) {
      console.log("Error checking can rate:", error);
      return null;
    }
  },

  submitRating: async (bookingId: string, stars: number, comment?: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post("/ratings", {
        booking_id: bookingId,
        stars,
        comment: comment || null,
      });
      
      if (response.data.success) {
        // Remove from pending ratings
        const currentPending = get().pendingRatings;
        set({
          pendingRatings: currentPending.filter((p) => p.booking_id !== bookingId),
        });
        return true;
      }
      return false;
    } catch (error: any) {
      set({ error: error.response?.data?.message || "Failed to submit rating" });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
