import api from "@/lib/api";
import { Booking } from "@/types";
import { create } from "zustand";

interface BookingState {
  myBookings: Booking[];
  rideBookings: Booking[];
  isLoading: boolean;
  getMyBookings: () => Promise<void>;
  getRideBookings: (rideId: string) => Promise<void>;
  createBooking: (rideId: string, seats: number) => Promise<void>;
  cancelBooking: (bookingId: string) => Promise<void>;
  acceptBooking: (bookingId: string) => Promise<void>;
  rejectBooking: (bookingId: string) => Promise<void>;
}

export const useBookingStore = create<BookingState>((set) => ({
  myBookings: [],
  rideBookings: [],
  isLoading: false,

  getMyBookings: async () => {
    try {
      set({ isLoading: true });
      const response = await api.get<{ data: Booking[] }>(
        "/bookings/my-bookings"
      );
      set({ myBookings: response.data.data });
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Failed to get bookings"
      );
    } finally {
      set({ isLoading: false });
    }
  },

  getRideBookings: async (rideId) => {
    try {
      set({ isLoading: true });
      const response = await api.get<{ data: Booking[] }>(
        `/rides/${rideId}/bookings`
      );
      set({ rideBookings: response.data.data });
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Failed to get ride bookings"
      );
    } finally {
      set({ isLoading: false });
    }
  },

  createBooking: async (rideId, seats) => {
    try {
      const response = await api.post<{ data: Booking }>(
        `/rides/${rideId}/bookings`,
        { seats }
      );
      set((state) => ({
        myBookings: [response.data.data, ...state.myBookings],
      }));
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Failed to create booking"
      );
    }
  },

  cancelBooking: async (bookingId) => {
    try {
      await api.delete(`/bookings/${bookingId}`);
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
      const response = await api.patch<{ data: Booking }>(
        `/bookings/${bookingId}/accept`
      );
      set((state) => ({
        rideBookings: state.rideBookings.map((booking) =>
          booking.id === bookingId ? response.data.data : booking
        ),
      }));
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Failed to accept booking"
      );
    }
  },

  rejectBooking: async (bookingId) => {
    try {
      const response = await api.patch<{ data: Booking }>(
        `/bookings/${bookingId}/reject`
      );
      set((state) => ({
        rideBookings: state.rideBookings.map((booking) =>
          booking.id === bookingId ? response.data.data : booking
        ),
      }));
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Failed to reject booking"
      );
    }
  },
}));
