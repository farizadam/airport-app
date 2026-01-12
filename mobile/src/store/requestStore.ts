import { create } from "zustand";
import api from "../lib/api";

interface Offer {
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

interface RideRequest {
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
  };
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

interface RequestStore {
  requests: RideRequest[];
  availableRequests: RideRequest[];
  myOffers: RideRequest[]; // Driver's offers
  currentRequest: RideRequest | null;
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    totalPages: number;
    total: number;
  };

  // Passenger actions
  createRequest: (data: any) => Promise<RideRequest>;
  getMyRequests: (status?: string) => Promise<void>;
  cancelRequest: (requestId: string) => Promise<void>;
  acceptOffer: (requestId: string, offerId: string) => Promise<void>;
  rejectOffer: (requestId: string, offerId: string) => Promise<void>;

  // Driver actions
  getAvailableRequests: (filters?: any) => Promise<void>;
  getMyOffers: (status?: string) => Promise<void>;
  makeOffer: (
    requestId: string,
    data: { price_per_seat: number; message?: string; ride_id?: string }
  ) => Promise<void>;
  withdrawOffer: (requestId: string) => Promise<void>;

  // Common actions
  getRequest: (requestId: string) => Promise<void>;
  clearError: () => void;
  clearCurrentRequest: () => void;
}

export const useRequestStore = create<RequestStore>((set, get) => ({
  requests: [],
  availableRequests: [],
  myOffers: [],
  currentRequest: null,
  loading: false,
  error: null,
  pagination: {
    page: 1,
    totalPages: 1,
    total: 0,
  },

  createRequest: async (data) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post("/ride-requests", data);
      const newRequest = response.data.request;
      set((state) => ({
        requests: [newRequest, ...state.requests],
        loading: false,
      }));
      return newRequest;
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Failed to create request";
      set({ error: message, loading: false });
      throw new Error(message);
    }
  },

  getMyRequests: async (status?: string) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (status) params.append("status", status);

      const response = await api.get(`/ride-requests/my-requests?${params}`);
      set({
        requests: response.data.requests,
        pagination: response.data.pagination,
        loading: false,
      });
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Failed to fetch requests";
      set({ error: message, loading: false });
    }
  },

  getAvailableRequests: async (filters?: any) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (filters?.airport_id) params.append("airport_id", filters.airport_id);
      if (filters?.direction) params.append("direction", filters.direction);
      if (filters?.date) params.append("date", filters.date);
      if (filters?.city) params.append("city", filters.city);

      console.log(
        "[RequestStore] Fetching available requests with params:",
        params.toString()
      );
      const response = await api.get(`/ride-requests/available?${params}`);
      console.log("[RequestStore] Available requests response:", response.data);
      console.log(
        "[RequestStore] Found",
        response.data.requests?.length || 0,
        "requests"
      );

      set({
        availableRequests: response.data.requests || [],
        pagination: response.data.pagination,
        loading: false,
      });
    } catch (error: any) {
      console.error(
        "[RequestStore] Error fetching available requests:",
        error.response?.data || error.message
      );
      const message =
        error.response?.data?.message || "Failed to fetch available requests";
      set({ error: message, loading: false });
    }
  },

  getMyOffers: async (status?: string) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (status) params.append("status", status);

      const response = await api.get(`/ride-requests/my-offers?${params}`);
      set({
        myOffers: response.data.requests,
        pagination: response.data.pagination,
        loading: false,
      });
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Failed to fetch your offers";
      set({ error: message, loading: false });
    }
  },

  getRequest: async (requestId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await api.get(`/ride-requests/${requestId}`);
      set({
        currentRequest: response.data.request,
        loading: false,
      });
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Failed to fetch request";
      set({ error: message, loading: false });
    }
  },

  cancelRequest: async (requestId: string) => {
    set({ loading: true, error: null });
    try {
      await api.put(`/ride-requests/${requestId}/cancel`);
      set((state) => ({
        requests: state.requests.map((r) =>
          r._id === requestId ? { ...r, status: "cancelled" } : r
        ),
        loading: false,
      }));
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Failed to cancel request";
      set({ error: message, loading: false });
      throw new Error(message);
    }
  },

  acceptOffer: async (requestId: string, offerId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await api.put(
        `/ride-requests/${requestId}/accept-offer`,
        { offer_id: offerId }
      );
      set((state) => ({
        requests: state.requests.map((r) =>
          r._id === requestId ? response.data.request : r
        ),
        currentRequest: response.data.request,
        loading: false,
      }));
    } catch (error: any) {
      const message = error.response?.data?.message || "Failed to accept offer";
      set({ error: message, loading: false });
      throw new Error(message);
    }
  },

  rejectOffer: async (requestId: string, offerId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await api.put(
        `/ride-requests/${requestId}/reject-offer`,
        { offer_id: offerId }
      );
      set((state) => ({
        requests: state.requests.map((r) =>
          r._id === requestId ? response.data.request : r
        ),
        currentRequest: response.data.request,
        loading: false,
      }));
    } catch (error: any) {
      const message = error.response?.data?.message || "Failed to reject offer";
      set({ error: message, loading: false });
      throw new Error(message);
    }
  },

  makeOffer: async (requestId: string, data) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post(
        `/ride-requests/${requestId}/offer`,
        data
      );
      set((state) => ({
        availableRequests: state.availableRequests.map((r) =>
          r._id === requestId ? response.data.request : r
        ),
        currentRequest: response.data.request,
        loading: false,
      }));
    } catch (error: any) {
      const message = error.response?.data?.message || "Failed to make offer";
      set({ error: message, loading: false });
      throw new Error(message);
    }
  },

  withdrawOffer: async (requestId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await api.delete(`/ride-requests/${requestId}/offer`);
      set((state) => ({
        availableRequests: state.availableRequests.map((r) =>
          r._id === requestId ? response.data.request : r
        ),
        loading: false,
      }));
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Failed to withdraw offer";
      set({ error: message, loading: false });
      throw new Error(message);
    }
  },

  clearError: () => set({ error: null }),
  clearCurrentRequest: () => set({ currentRequest: null }),
}));
