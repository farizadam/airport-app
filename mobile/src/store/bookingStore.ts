import api from "@/lib/api";
import { Booking } from "@/types";
import { create } from "zustand";

interface BookingState {
  myBookings: Booking[];
  rideBookings: Booking[];
  isLoading: boolean;
  getMyBookings: () => Promise<void>;
  getRideBookings: (rideId: string) => Promise<void>;
  createBooking: (
    rideId: string, 
    seats: number,
    luggage_count?: number,
    pickup_location?: { address?: string; latitude?: number; longitude?: number },
    dropoff_location?: { address?: string; latitude?: number; longitude?: number }
  ) => Promise<Booking>;
  cancelBooking: (bookingId: string) => Promise<void>;
  acceptBooking: (bookingId: string) => Promise<void>;
  rejectBooking: (bookingId: string) => Promise<void>;
  clearRideBookings: () => void;
}

export const useBookingStore = create<BookingState>((set) => ({
  myBookings: [],
  rideBookings: [],
  isLoading: false,

  clearRideBookings: () => set({ rideBookings: [] }),

  getMyBookings: async () => {
    try {
      set({ isLoading: true });
      const response = await api.get<{ data: Booking[] }>(
        "/my-bookings"
      );
      set({ myBookings: response.data.data });
    } catch (error: any) {
      console.error("❌ Failed to fetch bookings:", error.response?.data || error.message);
      // Don't throw - just keep existing data so UI still works
    } finally {
      set({ isLoading: false });
    }
  },

  getRideBookings: async (rideId) => {
    try {
      set({ isLoading: true, rideBookings: [] }); // Clear previous bookings immediately
      console.log("Fetching ride bookings for ride:", rideId);
      const response = await api.get<{ data: Booking[] }>(
        `/rides/${rideId}/bookings`
      );
      console.log("Ride bookings response:", response.data);
      set({ rideBookings: response.data.data });
    } catch (error: any) {
      console.error(
        "Failed to get ride bookings:",
        error.response?.data || error.message
      );
      throw new Error(
        error.response?.data?.message || "Failed to get ride bookings"
      );
    } finally {
      set({ isLoading: false });
    }
  },

  createBooking: async (rideId, seats, luggage_count, pickup_location, dropoff_location) => {
    try {
      const response = await api.post<{ data: Booking }>(
        `/rides/${rideId}/bookings`,
        { 
          seats,
          luggage_count: luggage_count || 0,
          pickup_location,
          dropoff_location
        }
      );
      const newBooking = response.data.data;
      set((state) => ({
        myBookings: [newBooking, ...state.myBookings],
      }));
      return newBooking; // Return the created booking
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Failed to create booking"
      );
    }
  },

  cancelBooking: async (bookingId) => {
    try {
      await api.patch(`/bookings/${bookingId}`, { status: "cancelled" });
      set((state) => ({
        myBookings: state.myBookings.filter(
          (booking) => booking.id !== bookingId
        ),
        rideBookings: state.rideBookings.filter(
          (booking) => booking.id !== bookingId
        ),
      }));
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Failed to cancel booking"
      );
    }
  },

  acceptBooking: async (bookingId) => {
    try {
      console.log("=== ACCEPT BOOKING START ===");
      console.log("Booking ID:", bookingId);
      const response = await api.patch<{ data: Booking }>(
        `/bookings/${bookingId}`,
        { status: "accepted" }
      );
      console.log("Accept response:", JSON.stringify(response.data, null, 2));
      const updatedBooking = response.data.data;
      // Update the local state
      set((state) => ({
        rideBookings: state.rideBookings.map((booking) =>
          booking.id === bookingId || booking._id === bookingId
            ? { ...booking, status: "accepted" }
            : booking
        ),
      }));
      console.log("=== ACCEPT BOOKING END ===");
    } catch (error: any) {
      console.log(
        "Accept booking error:",
        error.response?.data?.message || error.message
      );
      throw new Error(
        error.response?.data?.message || "Failed to accept booking"
      );
    }
  },

  rejectBooking: async (bookingId) => {
    try {
      const response = await api.patch<{ data: Booking }>(
        `/bookings/${bookingId}`,
        { status: "rejected" }
      );
      // Update the local state
      set((state) => ({
        rideBookings: state.rideBookings.map((booking) =>
          booking.id === bookingId || booking._id === bookingId
            ? { ...booking, status: "rejected" }
            : booking
        ),
      }));
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Failed to reject booking"
      );
    }
  },
}));
