import { TripCard, TripItem } from "@/components/TripCard";
import { useAuthStore } from "@/store/authStore";
import { useBookingStore } from "@/store/bookingStore";
import { useRequestStore } from "@/store/requestStore";
import { useRideStore } from "@/store/rideStore";
import { getLocationInfo, getDepartureTime, TripData } from "@/utils/tripDisplayUtils";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "../../src/store/toastStore";

type TabType = "active" | "myrides" | "myrequests" | "history";

export default function MyTripsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuthStore();
  
  // Use correct store methods
  const rides = useRideStore((s) => s.myRides);
  const getMyRides = useRideStore((s) => s.getMyRides);
  const cancelRide = useRideStore((s) => s.cancelRide);
  const ridesLoading = useRideStore((s) => s.isLoading);
  
  const requests = useRequestStore((s) => s.requests);
  const getMyRequests = useRequestStore((s) => s.getMyRequests);
  const cancelRequest = useRequestStore((s) => s.cancelRequest);
  const myOffers = useRequestStore((s) => s.myOffers);
  const getMyOffers = useRequestStore((s) => s.getMyOffers);
  const withdrawOffer = useRequestStore((s) => s.withdrawOffer);
  const requestsLoading = useRequestStore((s) => s.loading);
  
  const bookings = useBookingStore((s) => s.myBookings);
  const getMyBookings = useBookingStore((s) => s.getMyBookings);
  const cancelBooking = useBookingStore((s) => s.cancelBooking);
  const bookingsLoading = useBookingStore((s) => s.isLoading);

  const [activeTab, setActiveTab] = useState<TabType>("active");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (params?.tab) {
      const t = params.tab as TabType;
      if (["active", "myrides", "myrequests", "history"].includes(t)) {
        setActiveTab(t);
      }
    }
  }, [params?.tab]);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        loadData();
      }
    }, [isAuthenticated])
  );

  const loadData = async () => {
    await Promise.all([
      getMyRides(),
      getMyRequests(),
      getMyBookings(),
      getMyOffers(),
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const now = new Date();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Helper to check if a date is in the future (or today)
  const isFuture = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return !isNaN(d.getTime()) && d.getTime() >= startOfToday.getTime();
  };

  // Helper to check if a date is in the past (yesterday or older)
  const isPast = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return !isNaN(d.getTime()) && d.getTime() < startOfToday.getTime();
  };

  // Helper to get consistent location display using shared utility
  // RULE: to_airport = City(top) → Airport(bottom), from_airport = Airport(top) → City(bottom)
  const getLocations = (item: any): { pickup: string; dropoff: string } => {
    if (!item) return { pickup: "Unknown", dropoff: "Unknown" };
    const locs = getLocationInfo(item as TripData);
    return { pickup: locs.pickup, dropoff: locs.dropoff };
  };

  // ==========================================
  // TAB 1: MY BOOKINGS - Trips user booked as passenger
  // ==========================================
  const myBookingsTrips: TripItem[] = (bookings || [])
    .filter((b: any) => 
      b.status !== "cancelled" &&
      isFuture(b.ride?.departure_datetime || b.ride?.datetime_start)
    )
    .map((b: any) => {
      const locs = getLocations(b.ride);
      return {
        id: b.id || b._id,
        rideId: b.ride?.id || b.ride?._id || (typeof b.ride_id === 'string' ? b.ride_id : b.ride_id?._id),
        type: "booking" as const,
        role: "passenger" as const,
        status: b.status,
        pickupLocation: locs.pickup,
        dropoffLocation: locs.dropoff,
        departureTime: b.ride?.departure_datetime || b.ride?.datetime_start,
        seats: b.seats_booked || b.seats,
        price: b.ride?.price_per_seat,
        direction: b.ride?.direction,
        luggage: b.luggage,
        driver: {
          id: b.driver_id || b.ride?.driver?.id || b.ride?.driver?._id,
          _id: b.driver_id || b.ride?.driver?._id || b.ride?.driver?.id,
          first_name: b.driver_first_name || b.ride?.driver?.first_name,
          last_name: b.driver_last_name || b.ride?.driver?.last_name,
          phone: b.driver_phone || b.ride?.driver?.phone,
          rating: b.driver_rating || b.ride?.driver?.rating,
          avatar_url: b.driver_avatar_url || b.ride?.driver?.avatar_url,
          car_model: b.ride?.car_model,
          car_color: b.ride?.car_color,
        },
      };
    })
    .sort((a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime());

  // Also add user's offers that have been accepted (as driver, offer confirmed)
  const acceptedOffers: TripItem[] = (myOffers || [])
    .filter((r: any) => {
      const userOffer = r.offers?.find((o: any) => 
        o.driver?._id === user?._id || o.driver === user?._id
      );
      return userOffer?.status === "accepted" && isFuture(r.preferred_datetime);
    })
    .map((r: any) => {
      const locs = getLocations(r);
      const userOffer = r.offers?.find((o: any) => 
        o.driver?._id === user?._id || o.driver === user?._id
      );
      return {
        id: userOffer?._id || r._id,
        requestId: r._id || r.id,
        type: "offer" as const,
        role: "driver" as const,
        status: "accepted",
        pickupLocation: locs.pickup,
        dropoffLocation: locs.dropoff,
        departureTime: r.preferred_datetime,
        seats: r.seats_needed,
        price: userOffer?.price_per_seat,
        direction: r.direction,
        luggage_count: r.luggage_count,
        passenger: {
          id: r.passenger?.id || r.passenger?._id,
          _id: r.passenger?._id || r.passenger?.id,
          first_name: r.passenger?.first_name,
          last_name: r.passenger?.last_name,
          phone: r.passenger?.phone,
          rating: r.passenger?.rating,
          avatar_url: r.passenger?.avatar_url,
        },
      };
    });

  // Rides with accepted bookings (user is driver, has confirmed passengers)
  const ridesWithAcceptedBookings: TripItem[] = (rides || [])
    .filter((ride: any) => {
      const isOwner = ride.driver?._id === user?._id || ride.driver === user?._id || ride.driver_id === user?._id;
      const hasAccepted = ride.bookings?.some((b: any) => b.status === "accepted") ||
                          ride.accepted_count > 0 || ride.accepted_bookings_count > 0;
      return isOwner && hasAccepted && 
             ride.status !== "cancelled" && ride.status !== "completed" &&
             isFuture(ride.departure_datetime || ride.datetime_start);
    })
    .map((r: any) => {
      const locs = getLocations(r);
      const acceptedCount = r.bookings?.filter((b: any) => b.status === "accepted").length || 0;
      return {
        id: r._id || r.id,
        type: "ride" as const,
        role: "driver" as const,
        status: "confirmed",
        pickupLocation: locs.pickup,
        dropoffLocation: locs.dropoff,
        departureTime: r.departure_datetime || r.datetime_start,
        seats: r.available_seats,
        price: r.price_per_seat,
        direction: r.direction,
        luggage_capacity: r.luggage_capacity,
        luggage_left: r.luggage_left,
        acceptedCount,
      };
    });

  // Confirmed trips = user's accepted bookings + accepted offers (as driver) + rides with accepted bookings
  const confirmedTrips = [...myBookingsTrips.filter(b => b.status === "accepted"), ...acceptedOffers, ...ridesWithAcceptedBookings]
    .sort((a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime());

  // ==========================================
  // TAB 2: ACTION NEEDED - Pending decisions
  // ==========================================
  
  // Rides with pending bookings (user is driver, needs to accept/reject)
  const ridesWithPendingBookings = (rides || []).filter((ride: any) => {
    const isOwner = ride.driver?._id === user?._id || ride.driver === user?._id || ride.driver_id === user?._id;
    const hasPending = ride.bookings?.some((b: any) => b.status === "pending") || 
                       ride.pending_count > 0 || ride.pending_bookings_count > 0;
    return isOwner && hasPending && 
           ride.status !== "cancelled" && ride.status !== "completed" &&
           isFuture(ride.departure_datetime || ride.datetime_start);
  });

  // Requests with pending offers (user is passenger, needs to accept/reject)
  const requestsWithPendingOffers = (requests || []).filter((request: any) => {
    const isOwner = request.passenger?._id === user?._id || request.passenger === user?._id;
    const hasPendingOffers = request.offers?.some((o: any) => o.status === "pending");
    return isOwner && hasPendingOffers && 
           request.status !== "cancelled" && request.status !== "completed" && request.status !== "expired" &&
           isFuture(request.preferred_datetime);
  });

  // User's pending offers (waiting for passenger to accept) - Awaiting response
  const pendingOffers = (myOffers || []).filter((r: any) => {
    const userOffer = r.offers?.find((o: any) => 
      o.driver?._id === user?._id || o.driver === user?._id
    );
    return userOffer?.status === "pending" && isFuture(r.preferred_datetime);
  });

  // User's pending bookings (waiting for driver to accept) - Awaiting response
  const pendingBookings = (bookings || []).filter((b: any) => 
    b.status === "pending" && isFuture(b.ride?.departure_datetime || b.ride?.datetime_start)
  );

  const actionNeededTrips: TripItem[] = [
    // Rides needing action (user is driver - NEEDS TO ACT)
    ...ridesWithPendingBookings.map((r: any) => {
      const locs = getLocations(r);
      const pendingCount = r.bookings?.filter((b: any) => b.status === "pending").length || 
                          r.pending_bookings_count || 0;
      return {
        id: r._id || r.id,
        type: "ride" as const,
        role: "driver" as const,
        status: "pending_action",
        actionType: "booking_requests" as const,
        pendingCount,
        pickupLocation: locs.pickup,
        dropoffLocation: locs.dropoff,
        departureTime: r.departure_datetime || r.datetime_start,
        seats: r.available_seats,
        price: r.price_per_seat,
        direction: r.direction,
        luggage_capacity: r.luggage_capacity,
        luggage_left: r.luggage_left,
      };
    }),
    // Requests needing action (user is passenger - NEEDS TO ACT)
    ...requestsWithPendingOffers.map((r: any) => {
      const locs = getLocations(r);
      const pendingCount = r.offers?.filter((o: any) => o.status === "pending").length || 0;
      return {
        id: r._id || r.id,
        type: "request" as const,
        role: "passenger" as const,
        status: "pending_action",
        actionType: "offers_received" as const,
        pendingCount,
        pickupLocation: locs.pickup,
        dropoffLocation: locs.dropoff,
        departureTime: r.preferred_datetime,
        seats: r.seats_needed,
        direction: r.direction,
        luggage_count: r.luggage_count,
      };
    }),
    // Pending offers (user is driver, WAITING for passenger)
    ...pendingOffers.map((r: any) => {
      const locs = getLocations(r);
      const userOffer = r.offers?.find((o: any) => 
        o.driver?._id === user?._id || o.driver === user?._id
      );
      return {
        id: userOffer?._id || r._id,
        requestId: r._id || r.id,
        type: "offer" as const,
        role: "driver" as const,
        status: "pending",
        actionType: "awaiting_response" as const,
        pickupLocation: locs.pickup,
        dropoffLocation: locs.dropoff,
        departureTime: r.preferred_datetime,
        seats: r.seats_needed,
        price: userOffer?.price_per_seat,
        direction: r.direction,
        luggage_count: r.luggage_count,
        passenger: {
          id: r.passenger?.id || r.passenger?._id,
          _id: r.passenger?._id || r.passenger?.id,
          first_name: r.passenger?.first_name,
          last_name: r.passenger?.last_name,
          rating: r.passenger?.rating,
          avatar_url: r.passenger?.avatar_url,
        },
      };
    }),
    // Pending bookings (user is passenger, WAITING for driver)
    ...pendingBookings.map((b: any) => {
      const locs = getLocations(b.ride);
      return {
        id: b.id || b._id,
        rideId: b.ride?.id || b.ride?._id,
        type: "booking" as const,
        role: "passenger" as const,
        status: "pending",
        actionType: "awaiting_response" as const,
        pickupLocation: locs.pickup,
        dropoffLocation: locs.dropoff,
        departureTime: b.ride?.departure_datetime || b.ride?.datetime_start,
        seats: b.seats_booked || b.seats,
        price: b.ride?.price_per_seat,
        direction: b.ride?.direction,
        luggage: b.luggage,
        driver: {
          id: b.driver_id || b.ride?.driver?.id || b.ride?.driver?._id,
          _id: b.driver_id || b.ride?.driver?._id || b.ride?.driver?.id,
          first_name: b.driver_first_name || b.ride?.driver?.first_name,
          last_name: b.driver_last_name || b.ride?.driver?.last_name,
          rating: b.driver_rating || b.ride?.driver?.rating,
          avatar_url: b.driver_avatar_url || b.ride?.driver?.avatar_url,
        },
      };
    }),
  ].sort((a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime());

  // ==========================================
  // TAB 3: UPCOMING (WAITING) - Rides/requests with NO interactions yet
  // ==========================================
  
  // Rides with no bookings at all
  const ridesNoInteraction = (rides || []).filter((ride: any) => {
    const isOwner = ride.driver?._id === user?._id || ride.driver === user?._id || ride.driver_id === user?._id;
    const hasNoBookings = (!ride.bookings || ride.bookings.length === 0) &&
                          !ride.pending_count && !ride.accepted_count &&
                          !ride.pending_bookings_count && !ride.accepted_bookings_count;
    const noPending = !ride.pending_bookings_count || ride.pending_bookings_count === 0;
    return isOwner && hasNoBookings && noPending && 
           ride.status !== "cancelled" && ride.status !== "completed" &&
           isFuture(ride.departure_datetime || ride.datetime_start);
  });

  // Requests with no offers at all
  const requestsNoInteraction = (requests || []).filter((request: any) => {
    const isOwner = request.passenger?._id === user?._id || request.passenger === user?._id;
    const hasNoOffers = !request.offers || request.offers.length === 0;
    return isOwner && hasNoOffers &&
           request.status !== "cancelled" && request.status !== "completed" && request.status !== "expired" &&
           isFuture(request.preferred_datetime);
  });

  const upcomingTrips: TripItem[] = [
    ...ridesNoInteraction.map((r: any) => {
      const locs = getLocations(r);
      return {
        id: r.id || r._id,
        type: "ride" as const,
        role: "driver" as const,
        status: r.status,
        pickupLocation: locs.pickup,
        dropoffLocation: locs.dropoff,
        departureTime: r.departure_datetime || r.datetime_start,
        seats: r.available_seats,
        price: r.price_per_seat,
        direction: r.direction,
        luggage_capacity: r.luggage_capacity,
        luggage_left: r.luggage_left,
      };
    }),
    ...requestsNoInteraction.map((r: any) => {
      const locs = getLocations(r);
      return {
        id: r.id || r._id,
        type: "request" as const,
        role: "passenger" as const,
        status: r.status,
        pickupLocation: locs.pickup,
        dropoffLocation: locs.dropoff,
        departureTime: r.preferred_datetime,
        seats: r.seats_needed,
        direction: r.direction,
        luggage_count: r.luggage_count,
      };
    }),
  ].sort((a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime());

  // ==========================================
  // TAB 4 & 5: MY RIDES & MY REQUESTS (all active, for management)
  // ==========================================
  const myRidesAll = (rides || []).filter((ride: any) => 
    (ride.driver?._id === user?._id || ride.driver === user?._id || ride.driver_id === user?._id) &&
    ride.status !== "cancelled" &&
    ride.status !== "completed" &&
    isFuture(ride.departure_datetime || ride.datetime_start)
  );

  const myRequestsAll = (requests || []).filter((request: any) => 
    (request.passenger?._id === user?._id || request.passenger === user?._id) &&
    request.status !== "cancelled" &&
    request.status !== "completed" &&
    request.status !== "expired" &&
    isFuture(request.preferred_datetime)
  );

  // ==========================================
  // TAB 6: HISTORY - Past trips
  // ==========================================
  const pastTrips: TripItem[] = [
    ...(rides || [])
      .filter((r: any) => (r.driver?._id === user?._id || r.driver === user?._id || r.driver_id === user?._id) && 
        r.status !== "cancelled" && (isPast(r.departure_datetime || r.datetime_start) || r.status === "completed"))
      .map((r: any) => {
        const locs = getLocations(r);
        return {
          id: r.id || r._id,
          type: "ride" as const,
          role: "driver" as const,
          status: r.status,
          pickupLocation: locs.pickup,
          dropoffLocation: locs.dropoff,
          departureTime: r.departure_datetime || r.datetime_start,
          seats: r.available_seats,
          price: r.price_per_seat,
          direction: r.direction,
        luggage_capacity: r.luggage_capacity,
        luggage_left: r.luggage_left,
        };
      }),
    ...(requests || [])
      .filter((r: any) => (r.passenger?._id === user?._id || r.passenger === user?._id) && 
        r.status !== "cancelled" && (isPast(r.preferred_datetime) || r.status === "completed" || r.status === "expired"))
      .map((r: any) => {
        const locs = getLocations(r);
        return {
          id: r.id || r._id,
          type: "request" as const,
          role: "passenger" as const,
          status: r.status,
          pickupLocation: locs.pickup,
          dropoffLocation: locs.dropoff,
          departureTime: r.preferred_datetime,
          seats: r.seats_needed,
          direction: r.direction,
          luggage_count: r.luggage_count,
        };
      }),
    ...(bookings || [])
      .filter((b: any) => b.status !== "cancelled" && (isPast(b.ride?.departure_datetime || b.ride?.datetime_start) || b.status === "completed"))
      .map((b: any) => {
        const locs = getLocations(b.ride);
        return {
          id: b.id || b._id,
          rideId: b.ride?.id || b.ride?._id || (typeof b.ride_id === 'string' ? b.ride_id : b.ride_id?._id),
          type: "booking" as const,
          role: "passenger" as const,
          status: b.status,
          pickupLocation: locs.pickup,
          dropoffLocation: locs.dropoff,
          departureTime: b.ride?.departure_datetime || b.ride?.datetime_start,
          seats: b.seats_booked,
          direction: b.ride?.direction,
          luggage: b.luggage,
          driver: {
            id: b.driver_id || b.ride?.driver?.id || b.ride?.driver?._id,
            _id: b.driver_id || b.ride?.driver?._id || b.ride?.driver?.id,
            first_name: b.driver_first_name || b.ride?.driver?.first_name,
            last_name: b.driver_last_name || b.ride?.driver?.last_name,
            phone: b.driver_phone || b.ride?.driver?.phone,
            rating: b.driver_rating || b.ride?.driver?.rating,
            avatar_url: b.driver_avatar_url || b.ride?.driver?.avatar_url,
            car_model: b.ride?.car_model,
            car_color: b.ride?.car_color,
          },
        };
      }),
    ...(myOffers || [])
      .filter((r: any) => r.status !== "cancelled" && (isPast(r.preferred_datetime) || r.status === "completed" || r.status === "expired"))
      .map((r: any) => {
        const locs = getLocations(r);
        const userOffer = r.offers?.find((o: any) => 
          o.driver?._id === user?._id || o.driver === user?._id
        );
        return {
          id: userOffer?._id || r._id,
          requestId: r._id || r.id,
          type: "offer" as const,
          role: "driver" as const,
          status: userOffer?.status || r.status,
          pickupLocation: locs.pickup,
          dropoffLocation: locs.dropoff,
          departureTime: r.preferred_datetime,
          seats: r.seats_needed,
          price: userOffer?.price_per_seat,
          direction: r.direction,
          luggage_count: r.luggage_count,
          passenger: {
            id: r.passenger?.id || r.passenger?._id,
            _id: r.passenger?._id || r.passenger?.id,
            first_name: r.passenger?.first_name,
            last_name: r.passenger?.last_name,
            rating: r.passenger?.rating,
            avatar_url: r.passenger?.avatar_url,
          },
        };
      }),
  ].sort((a, b) => new Date(b.departureTime).getTime() - new Date(a.departureTime).getTime());

  const isLoading = ridesLoading || requestsLoading || bookingsLoading;

  const handleCancel = (item: TripItem) => {
    const title = item.type === "offer" ? "Withdraw Offer" : "Cancel Trip";
    const message = item.type === "offer" 
      ? "Are you sure you want to withdraw your offer?" 
      : "Are you sure you want to cancel this?";
    const buttonText = item.type === "offer" ? "Yes, Withdraw" : "Yes, Cancel";

    Alert.alert(
      title,
      message,
      [
        { text: "No", style: "cancel" },
        {
          text: buttonText,
          style: "destructive",
          onPress: async () => {
            try {
              if (item.type === "ride") await cancelRide(item.id);
              else if (item.type === "request") await cancelRequest(item.id);
              else if (item.type === "booking") await cancelBooking(item.id);
              else if (item.type === "offer" && item.requestId) await withdrawOffer(item.requestId);
              
              loadData(); // Refresh data
            } catch (error: any) {
              toast.error("Error", error.message || "Failed to cancel");
            }
          }
        }
      ]
    );
  };

  const renderContent = () => {
    if (!isAuthenticated) {
      return (
        <View style={styles.loginPrompt}>
          <Ionicons name="lock-closed-outline" size={64} color="#CBD5E1" />
          <Text style={styles.loginPromptTitle}>Login Required</Text>
          <Text style={styles.loginPromptSubtitle}>
            Sign in to view and manage your trips
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push("/login")}
          >
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (isLoading && !refreshing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading your trips...</Text>
        </View>
      );
    }

    let trips: TripItem[] = [];
    let emptyMessage = "";
    let emptySubtitle = "";
    let emptyIcon: keyof typeof Ionicons.glyphMap = "car-outline";

    switch (activeTab) {
      case "active":
        // Combine all active interactions:
        // 1. User's bookings on other rides
        // 2. User's offers on other requests  
        // 3. Action needed items (pending bookings/offers)
        // 4. User's rides that have any bookings
        // 5. User's requests that have any offers
        
        // Rides with any bookings (not in actionNeededTrips already)
        const ridesWithBookings: TripItem[] = (rides || [])
          .filter((ride: any) => {
            const isOwner = ride.driver?._id === user?._id || ride.driver === user?._id || ride.driver_id === user?._id;
            const hasBookings = (ride.bookings && ride.bookings.length > 0) ||
                                ride.pending_count > 0 || ride.accepted_count > 0 ||
                                ride.pending_bookings_count > 0 || ride.accepted_bookings_count > 0;
            return isOwner && hasBookings && 
                   ride.status !== "cancelled" && ride.status !== "completed" &&
                   isFuture(ride.departure_datetime || ride.datetime_start);
          })
          .map((r: any) => {
            const locs = getLocations(r);
            const pendingCount = r.bookings?.filter((b: any) => b.status === "pending").length || r.pending_count || r.pending_bookings_count || 0;
            const acceptedCount = r.bookings?.filter((b: any) => b.status === "accepted").length || r.accepted_count || r.accepted_bookings_count || 0;
            return {
              id: r._id || r.id,
              type: "ride" as const,
              role: "driver" as const,
              status: acceptedCount > 0 ? "confirmed" : (pendingCount > 0 ? "pending_action" : r.status),
              actionType: pendingCount > 0 ? "booking_requests" as const : undefined,
              pendingCount,
              acceptedCount,
              pickupLocation: locs.pickup,
              dropoffLocation: locs.dropoff,
              departureTime: r.departure_datetime || r.datetime_start,
              seats: r.available_seats,
              price: r.price_per_seat,
              direction: r.direction,
              luggage_capacity: r.luggage_capacity,
              luggage_left: r.luggage_left,
            };
          });
        
        // Requests with any offers
        const requestsWithOffers: TripItem[] = (requests || [])
          .filter((request: any) => {
            const isOwner = request.passenger?._id === user?._id || request.passenger === user?._id;
            const hasOffers = request.offers && request.offers.length > 0;
            return isOwner && hasOffers &&
                   request.status !== "cancelled" && request.status !== "completed" && request.status !== "expired" &&
                   isFuture(request.preferred_datetime);
          })
          .map((r: any) => {
            const locs = getLocations(r);
            const pendingCount = r.offers?.filter((o: any) => o.status === "pending").length || 0;
            const acceptedCount = r.offers?.filter((o: any) => o.status === "accepted").length || 0;
            return {
              id: r._id || r.id,
              type: "request" as const,
              role: "passenger" as const,
              status: acceptedCount > 0 ? "matched" : (pendingCount > 0 ? "pending_action" : r.status),
              actionType: pendingCount > 0 ? "offers_received" as const : undefined,
              pendingCount,
              acceptedCount,
              pickupLocation: locs.pickup,
              dropoffLocation: locs.dropoff,
              departureTime: r.preferred_datetime,
              seats: r.seats_needed,
              direction: r.direction,
              luggage_count: r.luggage_count,
            };
          });
        
        // Combine all and remove duplicates by id
        const allActiveItems = [
          ...myBookingsTrips, 
          ...acceptedOffers,
          ...pendingOffers.map((r: any) => {
            const locs = getLocations(r);
            const userOffer = r.offers?.find((o: any) => 
              o.driver?._id === user?._id || o.driver === user?._id
            );
            return {
              id: userOffer?._id || r._id,
              requestId: r._id || r.id,
              type: "offer" as const,
              role: "driver" as const,
              status: "pending",
              actionType: "awaiting_response" as const,
              pickupLocation: locs.pickup,
              dropoffLocation: locs.dropoff,
              departureTime: r.preferred_datetime,
              seats: r.seats_needed,
              price: userOffer?.price_per_seat,
              direction: r.direction,
              luggage_count: r.luggage_count,
              passenger: {
                first_name: r.passenger?.first_name,
                last_name: r.passenger?.last_name,
              },
            };
          }),
          ...ridesWithBookings,
          ...requestsWithOffers,
        ];
        
        // Remove duplicates and sort
        const seenIds = new Set<string>();
        trips = allActiveItems
          .filter(item => {
            const key = `${item.type}-${item.id}`;
            if (seenIds.has(key)) return false;
            seenIds.add(key);
            return true;
          })
          .sort((a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime());
        
        emptyMessage = "No active bookings";
        emptySubtitle = "Your bookings, offers, and pending requests will appear here";
        emptyIcon = "swap-horizontal-outline";
        break;
      case "myrides":
        trips = myRidesAll
          .map((r: any) => {
            const locs = getLocations(r);
            const pendingCount = r.bookings?.filter((b: any) => b.status === "pending").length || 0;
            const acceptedCount = r.bookings?.filter((b: any) => b.status === "accepted").length || 0;
            return {
              id: r._id,
              type: "ride" as const,
              role: "driver" as const,
              status: r.status,
              pickupLocation: locs.pickup,
              dropoffLocation: locs.dropoff,
              departureTime: r.departure_datetime || r.datetime_start,
              seats: r.available_seats,
              price: r.price_per_seat,
              direction: r.direction,
              luggage_capacity: r.luggage_capacity,
              luggage_left: r.luggage_left,
              pendingCount,
              acceptedCount,
            };
          });
        emptyMessage = "No rides yet";
        emptySubtitle = "Create a ride to offer seats";
        emptyIcon = "car-outline";
        break;
      case "myrequests":
        trips = myRequestsAll
          .map((r: any) => {
            const locs = getLocations(r);
            const pendingOffers = r.offers?.filter((o: any) => o.status === "pending").length || 0;
            return {
              id: r._id,
              type: "request" as const,
              role: "passenger" as const,
              status: r.status,
              pickupLocation: locs.pickup,
              dropoffLocation: locs.dropoff,
              departureTime: r.preferred_datetime,
              seats: r.seats_needed,
              direction: r.direction,
              luggage_count: r.luggage_count,
              pendingCount: pendingOffers,
            };
          });
        emptyMessage = "No requests yet";
        emptySubtitle = "Create a request if you need a ride";
        emptyIcon = "hand-right-outline";
        break;
      case "history":
        trips = pastTrips;
        emptyMessage = "No history yet";
        emptySubtitle = "Completed trips will appear here";
        emptyIcon = "time-outline";
        break;
    }

    if (trips.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name={emptyIcon} size={48} color="#3B82F6" />
          </View>
          <Text style={styles.emptyStateTitle}>{emptyMessage}</Text>
          <Text style={styles.emptyStateSubtitle}>{emptySubtitle}</Text>
          {activeTab !== "history" && (
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() => router.push("/(tabs)")}
            >
              <Ionicons name="search" size={18} color="#fff" />
              <Text style={styles.emptyStateButtonText}>Find a Ride</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return (
      <View style={styles.tripsList}>
        {trips.map((item) => (
          <TripCard
            key={`${item.type}-${item.id}`}
            item={item}
            onCancel={handleCancel}
            showCancelButton={activeTab !== 'history'}
          />
        ))}
      </View>
    );
  };

  // Count for badge on Active tab (items needing action)
  const actionCount = actionNeededTrips.filter(t => 
    t.actionType === "booking_requests" || t.actionType === "offers_received"
  ).length;

  // Rides with any bookings count
  const ridesWithBookingsCount = (rides || []).filter((ride: any) => {
    const isOwner = ride.driver?._id === user?._id || ride.driver === user?._id || ride.driver_id === user?._id;
    const hasBookings = (ride.bookings && ride.bookings.length > 0) ||
                        ride.pending_count > 0 || ride.accepted_count > 0 ||
                        ride.pending_bookings_count > 0 || ride.accepted_bookings_count > 0;
    return isOwner && hasBookings && 
           ride.status !== "cancelled" && ride.status !== "completed" &&
           isFuture(ride.departure_datetime || ride.datetime_start);
  }).length;

  // Requests with any offers count
  const requestsWithOffersCount = (requests || []).filter((request: any) => {
    const isOwner = request.passenger?._id === user?._id || request.passenger === user?._id;
    const hasOffers = request.offers && request.offers.length > 0;
    return isOwner && hasOffers &&
           request.status !== "cancelled" && request.status !== "completed" && request.status !== "expired" &&
           isFuture(request.preferred_datetime);
  }).length;

  // Combined count for active tab (unique items)
  const activeCount = myBookingsTrips.length + acceptedOffers.length + pendingOffers.length + ridesWithBookingsCount + requestsWithOffersCount;

  const tabItems = [
    { 
      key: "active" as TabType, 
      label: "Active", 
      icon: "swap-horizontal",
      iconOutline: "swap-horizontal-outline",
      count: activeCount,
      badge: actionCount > 0 ? actionCount : undefined,
      color: "#3B82F6"
    },
    { 
      key: "myrides" as TabType, 
      label: "Rides", 
      icon: "car",
      iconOutline: "car-outline",
      count: myRidesAll.length,
      color: "#10B981"
    },
    { 
      key: "myrequests" as TabType, 
      label: "Requests", 
      icon: "hand-right",
      iconOutline: "hand-right-outline",
      count: myRequestsAll.length,
      color: "#8B5CF6"
    },
    { 
      key: "history" as TabType, 
      label: "History", 
      icon: "time",
      iconOutline: "time-outline",
      count: pastTrips.length,
      color: "#64748B"
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient
        colors={["#1E3A8A", "#3B82F6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>My Trips</Text>
        <Text style={styles.headerSubtitle}>
          {isAuthenticated ? `Manage your rides and requests` : "Login to see your trips"}
        </Text>
      </LinearGradient>

      {/* Tabs */}
      {isAuthenticated && (
        <View style={styles.tabsContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.tabsScrollContent}
          >
            {tabItems.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tab, 
                  activeTab === tab.key && styles.tabActive,
                  activeTab === tab.key && { borderColor: tab.color, backgroundColor: tab.color + '15' }
                ]}
                onPress={() => setActiveTab(tab.key)}
              >
                <View style={styles.tabIconContainer}>
                  <Ionicons 
                    name={activeTab === tab.key ? tab.icon as any : tab.iconOutline as any} 
                    size={16} 
                    color={activeTab === tab.key ? tab.color : "#64748B"} 
                  />
                  {tab.badge && (
                    <View style={[styles.tabBadge, { backgroundColor: "#EF4444" }]}>
                      <Text style={styles.tabBadgeText}>{tab.badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={[
                  styles.tabText, 
                  activeTab === tab.key && styles.tabTextActive,
                  activeTab === tab.key && { color: tab.color }
                ]}>
                  {tab.label} ({tab.count})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          isAuthenticated ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#3B82F6"]}
              tintColor="#3B82F6"
            />
          ) : undefined
        }
      >
        {renderContent()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  tabsContainer: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  tabsScrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    marginRight: 6,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  tabActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabIconContainer: {
    position: "relative",
  },
  tabBadge: {
    position: "absolute",
    top: -6,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#fff",
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    marginLeft: 4,
  },
  tabTextActive: {
    fontWeight: "700",
  },
  tabCount: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    marginLeft: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 80,
  },
  loadingText: {
    fontSize: 16,
    color: "#64748B",
    marginTop: 12,
  },
  loginPrompt: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  loginPromptTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1E293B",
    marginTop: 20,
  },
  loginPromptSubtitle: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
  loginButton: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
  },
  emptyStateSubtitle: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
  emptyStateButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3B82F6",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  emptyStateButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    marginLeft: 8,
  },
  tripsList: {
    gap: 12,
  },
  fabContainer: {
    position: "absolute",
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  fabPrimary: {
    backgroundColor: "#3B82F6",
  },
  fabSecondary: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#8B5CF6",
  },
});
