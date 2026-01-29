import { useAuthStore } from "../../../../src/store/authStore";
import { useBookingStore } from "../../../../src/store/bookingStore";
import { useRideStore } from "../../../../src/store/rideStore";
import RideMap from "../../../../src/components/RideMap";
import { format } from "date-fns";
import { useStripe } from "@stripe/stripe-react-native";
import { api } from "../../../../src/lib/api";
import {
  useLocalSearchParams,
  useRouter,
  useGlobalSearchParams,
} from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ride } from "@/types";

export default function RideDetailsScreen() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [isPaying, setIsPaying] = useState(false);
  // Payment handler for accepted booking
  const handlePayForBooking = async () => {
    if (!myBooking) return;
    setIsPaying(true);
    try {
      // Call backend to create PaymentIntent
      const response = await api.post("/payments/ride", {
        bookingId: myBooking.id || myBooking._id,
      });
      const { clientSecret } = response.data;
      // Initialize payment sheet
      const initResult = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
      });
      if (initResult.error) {
        Alert.alert(
          "Error",
          initResult.error.message || "Failed to initialize payment",
        );
        setIsPaying(false);
        return;
      }
      // Present payment sheet
      const paymentResult = await presentPaymentSheet();
      if (paymentResult.error) {
        Alert.alert(
          "Payment Failed",
          paymentResult.error.message || "Payment was not completed.",
        );
      } else {
        Alert.alert("Success", "Payment completed!");
        await getMyBookings();
        // Optionally refresh ride data or navigate
      }
    } catch (error: any) {
      Alert.alert(
        "Error",
        error?.response?.data?.message || error.message || "Payment failed",
      );
    } finally {
      setIsPaying(false);
    }
  };
  const router = useRouter();
  const localParams = useLocalSearchParams<{
    id: string;
    pickupLat?: string;
    pickupLng?: string;
    pickupAddress?: string;
  }>();
  const globalParams = useGlobalSearchParams<{ id: string }>();

  const id = localParams?.id || globalParams?.id;
  const pickupLocation =
    localParams?.pickupLat && localParams?.pickupLng
      ? {
          latitude: parseFloat(localParams.pickupLat),
          longitude: parseFloat(localParams.pickupLng),
          address: localParams.pickupAddress,
        }
      : null;

  const { fetchRideById, cancelRide, getMyRides } = useRideStore();
  const {
    createBooking,
    getRideBookings,
    rideBookings,
    acceptBooking,
    rejectBooking,
    getMyBookings,
    myBookings,
    isLoading: bookingLoading,
  } = useBookingStore();

  const { user, isAuthenticated } = useAuthStore();

  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [seats, setSeats] = useState("1");
  const [actionId, setActionId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      console.log("🔄 RideDetailsScreen FOCUSED. ID:", id);
      console.log("   - Local ID:", localParams?.id);
      console.log("   - Global ID:", globalParams?.id);

      const loadRideDetails = async () => {
        if (!id || typeof id !== "string") {
          console.log("⚠️ Invalid ID in loadRideDetails:", id);
          return;
        }

        setLoading(true);
        // Clear previous ride data immediately to prevent stale data
        setRide(null);

        try {
          console.log("📡 Fetching ride data for ID:", id);
          const data = await fetchRideById(id);
          console.log(
            "✅ Ride data received for ID:",
            id,
            "Data ID:",
            data.id || data._id,
          );
          setRide(data);

          // Fetch bookings if this is the driver
          const userId = String(user?.id || "");
          const dId = data?.driver_id;
          const driverId = String(
            typeof dId === "object" && dId !== null && "_id" in dId
              ? dId._id
              : dId || "",
          );

          if (userId && driverId && userId === driverId) {
            console.log("👤 User is driver, fetching bookings...");
            await getRideBookings(id);
          }
        } catch (error) {
          console.error("Failed to load ride:", error);
          Alert.alert("Error", "Failed to load ride details");
        } finally {
          setLoading(false);
        }
      };

      loadRideDetails();
      getMyBookings(); // Fetch my bookings to check status

      return () => {
        console.log("👋 RideDetailsScreen BLURRED/UNMOUNTED. Clearing state.");
        setRide(null);
        setLoading(true);
        useBookingStore.getState().clearRideBookings();
      };
    }, [id, user?.id]),
  );

  // Removed separate fetchRide function as it's now inside useFocusEffect

  const onRefresh = useCallback(async () => {
    if (!id) return;
    setRefreshing(true);
    try {
      await fetchRide();
      await getMyBookings();

      // If driver, refresh bookings too
      const userId = String(user?.id || "");
      const dId = ride?.driver_id;
      const driverId = String(
        typeof dId === "object" && dId !== null && "_id" in dId
          ? dId._id
          : dId || "",
      );

      if (userId && driverId && userId === driverId) {
        await getRideBookings(id);
      }
    } catch (error) {
      console.error("Refresh failed:", error);
    } finally {
      setRefreshing(false);
    }
  }, [id, user, ride, fetchRideById, getRideBookings, getMyBookings]);

  const handleBooking = async () => {
    if (!seats || parseInt(seats) < 1) {
      Alert.alert("Error", "Please enter a valid number of seats");
      return;
    }

    if (parseInt(seats) > (ride?.seats_left || 0)) {
      Alert.alert("Error", "Not enough seats available");
      return;
    }

    // Start payment process directly
    processPaymentAndBooking();
  };

  const processPaymentAndBooking = async () => {
    try {
      setBookingModalVisible(false);
      
      console.log("Creating payment intent for ride:", id, "seats:", seats);
      
      // Step 1: Create PaymentIntent (NO booking yet)
      const response = await api.post("/payments/create-intent", {
        rideId: id,
        seats: parseInt(seats),
      });
      
      console.log("Payment intent response:", response.data);
      
      const { clientSecret, paymentIntentId } = response.data;

      // Step 2: Initialize payment sheet
      const initResult = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: "Airport Carpooling",
      });
      
      console.log("Payment sheet init result:", initResult);
      
      if (initResult.error) {
        Alert.alert("Error", initResult.error.message || "Failed to initialize payment");
        return;
      }

      // Step 3: Present payment sheet to user
      const paymentResult = await presentPaymentSheet();
      
      console.log("Payment result:", paymentResult);
      
      if (paymentResult.error) {
        Alert.alert("Payment Cancelled", paymentResult.error.message || "Payment was not completed.");
        return;
      }
      
      // Step 4: Payment succeeded! Now create the booking
      console.log("Payment succeeded, creating booking...");
      
      const completeResponse = await api.post("/payments/complete", {
        paymentIntentId: paymentIntentId,
        rideId: id,
        seats: parseInt(seats),
      });
      
      console.log("Complete response:", completeResponse.data);
      
      // Refresh bookings
      await getMyBookings();
      
      Alert.alert("Success", "Payment completed! Your booking is confirmed.", [
        { text: "OK", onPress: () => router.replace("/(tabs)/explore?tab=mybookings") }
      ]);
      
    } catch (error: any) {
      console.log("Payment error:", error);
      console.log("Error response:", error?.response?.data);
      Alert.alert("Error", error?.response?.data?.message || error.message || "Payment failed");
    }
  };

  const handleAccept = async (bookingId: string) => {
    try {
      setActionId(bookingId);
      await acceptBooking(bookingId);
      await fetchRide(); // Refresh local ride data
      await getMyRides(); // Update list view
      Alert.alert("Success", "Booking accepted");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to accept booking");
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (bookingId: string) => {
    try {
      setActionId(bookingId);
      await rejectBooking(bookingId);
      await fetchRide(); // Refresh local ride data
      await getMyRides(); // Update list view
      Alert.alert("Success", "Booking rejected");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to reject booking");
    } finally {
      setActionId(null);
    }
  };

  const handleCancel = async () => {
    Alert.alert(
      "Cancel Ride",
      "Are you sure you want to cancel this ride? All current bookings will be cancelled.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            setIsCancelling(true);
            try {
              if (id) {
                await cancelRide(id);
                // Redirect to My Trips tab after cancellation
                Alert.alert("Success", "Ride cancelled successfully", [
                  {
                    text: "OK",
                    onPress: () =>
                      router.replace("/(tabs)/explore?tab=myrides"),
                  },
                ]);
              }
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to cancel ride");
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ],
    );
  };

  const routeCoordinates = useMemo(() => {
    if (!ride?.route?.coordinates) return [];
    return ride.route.coordinates.map((coord: number[]) => ({
      latitude: coord[1],
      longitude: coord[0],
    }));
  }, [ride]);

  const mapItems = useMemo(() => {
    if (!ride) return [];
    const items: any[] = [];

    // Home
    if (ride.home_latitude && ride.home_longitude) {
      items.push({
        _id: "origin",
        type: "ride",
        pickup_location: {
          latitude: ride.home_latitude,
          longitude: ride.home_longitude,
          city: ride.home_city,
        },
        // Dummy data to satisfy interface
        dropoff_location: { latitude: 0, longitude: 0 },
      });
    }

    // Airport
    if (ride.airport?.latitude && ride.airport?.longitude) {
      items.push({
        _id: "dest",
        type: "airport",
        pickup_location: {
          latitude: ride.airport.latitude,
          longitude: ride.airport.longitude,
          city: ride.airport.name,
        },
        dropoff_location: { latitude: 0, longitude: 0 },
      });
    }
    return items;
  }, [ride]);

  const pendingBookings = useMemo(
    () => rideBookings?.filter((b: any) => b.status === "pending") || [],
    [rideBookings],
  );

  const acceptedBookings = useMemo(
    () => rideBookings?.filter((b: any) => b.status === "accepted") || [],
    [rideBookings],
  );

  if (loading || !ride) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const dId = ride.driver_id;
  const driverId = String(
    typeof dId === "object" && dId !== null && "_id" in dId
      ? dId._id
      : dId || "",
  );
  const isOwner = String(user?.id || "") === driverId;

  // Check if current user has an accepted booking
  const myBooking = myBookings?.find(
    (b: any) => b.ride_id?._id === ride._id || b.ride_id === ride._id,
  );
  const isAcceptedPassenger = myBooking?.status === "accepted";
  const shouldShowMapAndDriver = isOwner || isAcceptedPassenger;

  const rideDate = ride.datetime_start
    ? new Date(ride.datetime_start.replace(" ", "T"))
    : new Date();

  return (
    <SafeAreaView style={styles.container} edges={["top"]} key={id}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ride Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Booking status for passenger */}
        {!isOwner && myBooking && myBooking.status === "accepted" && (
          <View
            style={[styles.section, { borderColor: "#16A34A", borderWidth: 1 }]}
          >
            <Text style={{ fontWeight: "bold", fontSize: 16, marginBottom: 8, color: "#16A34A" }}>
              ✅ Your booking is confirmed!
            </Text>
            <Text style={{ marginBottom: 8 }}>
              Payment completed. Your seat is reserved.
            </Text>
          </View>
        )}
        {/* Route Info with Enhanced A → B → C Display */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {pickupLocation ? "🛣️ Route with your pickup" : "🛣️ Route"}
          </Text>

          {/* Enhanced Route Display */}
          <View style={styles.routeContainer}>
            {pickupLocation ? (
              <>
                {/* A - Start Point */}
                <View style={styles.enhancedRoutePoint}>
                  <View style={styles.routePointLeftSide}>
                    <View
                      style={[
                        styles.routeMarker,
                        { backgroundColor: "#10B981" },
                      ]}
                    >
                      <Text style={styles.routeMarkerText}>A</Text>
                    </View>
                    <View style={styles.routeVerticalLine} />
                  </View>
                  <View style={styles.routePointDetails}>
                    <Text style={styles.routePointLabel}>START POINT</Text>
                    <Text style={styles.routePointAddress}>
                      {ride.direction === "to_airport"
                        ? ride.home_address ||
                          ride.home_city ||
                          "Driver's Location"
                        : ride.airport?.name || "Airport"}
                    </Text>
                  </View>
                </View>

                {/* B - User's Pickup/Dropoff */}
                <View style={styles.enhancedRoutePoint}>
                  <View style={styles.routePointLeftSide}>
                    <View
                      style={[
                        styles.routeMarker,
                        {
                          backgroundColor: "#F59E0B",
                          borderWidth: 3,
                          borderColor: "#FCD34D",
                        },
                      ]}
                    >
                      <Text style={styles.routeMarkerText}>B</Text>
                    </View>
                    <View style={styles.routeVerticalLine} />
                  </View>
                  <View
                    style={[
                      styles.routePointDetails,
                      styles.routePointHighlighted,
                    ]}
                  >
                    <Text
                      style={[styles.routePointLabel, { color: "#F59E0B" }]}
                    >
                      📍{" "}
                      {ride.direction === "to_airport"
                        ? "YOUR PICKUP"
                        : "YOUR DROP-OFF"}
                    </Text>
                    <Text
                      style={[
                        styles.routePointAddress,
                        { color: "#92400E", fontWeight: "600" },
                      ]}
                    >
                      {pickupLocation.address}
                    </Text>
                    <Text style={styles.routePointSubtext}>
                      This ride passes through your location
                    </Text>
                  </View>
                </View>

                {/* C - Destination */}
                <View style={styles.enhancedRoutePoint}>
                  <View style={styles.routePointLeftSide}>
                    <View
                      style={[
                        styles.routeMarker,
                        { backgroundColor: "#EF4444" },
                      ]}
                    >
                      <Text style={styles.routeMarkerText}>C</Text>
                    </View>
                  </View>
                  <View style={styles.routePointDetails}>
                    <Text style={styles.routePointLabel}>DESTINATION</Text>
                    <Text style={styles.routePointAddress}>
                      {ride.direction === "to_airport"
                        ? ride.airport?.name || "Airport"
                        : ride.home_address ||
                          ride.home_city ||
                          "Driver's Location"}
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <>
                {/* Simple A → B Route */}
                <View style={styles.enhancedRoutePoint}>
                  <View style={styles.routePointLeftSide}>
                    <View
                      style={[
                        styles.routeMarker,
                        { backgroundColor: "#3B82F6" },
                      ]}
                    >
                      <Text style={styles.routeMarkerText}>A</Text>
                    </View>
                    <View style={styles.routeVerticalLine} />
                  </View>
                  <View style={styles.routePointDetails}>
                    <Text style={styles.routePointLabel}>
                      {ride.direction === "to_airport" ? "PICKUP" : "DEPARTURE"}
                    </Text>
                    <Text style={styles.routePointAddress}>
                      {ride.direction === "to_airport"
                        ? ride.home_address ||
                          ride.home_city ||
                          "Driver's Location"
                        : ride.airport?.name || "Airport"}
                    </Text>
                  </View>
                </View>

                <View style={styles.enhancedRoutePoint}>
                  <View style={styles.routePointLeftSide}>
                    <View
                      style={[
                        styles.routeMarker,
                        { backgroundColor: "#EF4444" },
                      ]}
                    >
                      <Text style={styles.routeMarkerText}>B</Text>
                    </View>
                  </View>
                  <View style={styles.routePointDetails}>
                    <Text style={styles.routePointLabel}>DESTINATION</Text>
                    <Text style={styles.routePointAddress}>
                      {ride.direction === "to_airport"
                        ? ride.airport?.name || "Airport"
                        : ride.home_address ||
                          ride.home_city ||
                          "Driver's Location"}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Map Section - Always show the route map */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 Map</Text>
          {routeCoordinates.length > 0 ? (
            <View style={styles.mapContainer}>
              <RideMap
                routeCoordinates={routeCoordinates}
                items={mapItems}
                style={{ flex: 1 }}
              />
              <View style={styles.mapLegendOverlay}>
                <View style={styles.mapLegendRow}>
                  <View style={styles.legendDotItem}>
                    <View
                      style={[styles.legendDot, { backgroundColor: "#10B981" }]}
                    />
                    <Text style={styles.legendDotText}>Start</Text>
                  </View>
                  {pickupLocation && (
                    <View style={styles.legendDotItem}>
                      <View
                        style={[
                          styles.legendDot,
                          { backgroundColor: "#F59E0B" },
                        ]}
                      />
                      <Text style={styles.legendDotText}>Your stop</Text>
                    </View>
                  )}
                  <View style={styles.legendDotItem}>
                    <View
                      style={[styles.legendDot, { backgroundColor: "#EF4444" }]}
                    />
                    <Text style={styles.legendDotText}>End</Text>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View
              style={[
                styles.mapContainer,
                {
                  backgroundColor: "#F1F5F9",
                  justifyContent: "center",
                  alignItems: "center",
                },
              ]}
            >
              <Ionicons name="map-outline" size={48} color="#CBD5E1" />
              <Text
                style={{ color: "#64748B", marginTop: 12, fontWeight: "500" }}
              >
                Route map not available
              </Text>
            </View>
          )}
        </View>

        {/* Status Badge */}
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  ride.status === "active"
                    ? "#DCFCE7"
                    : ride.status === "cancelled"
                      ? "#FEE2E2"
                      : "#F1F5F9",
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                {
                  color:
                    ride.status === "active"
                      ? "#16A34A"
                      : ride.status === "cancelled"
                        ? "#DC2626"
                        : "#64748B",
                },
              ]}
            >
              {ride.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Date & Time */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Date & Time</Text>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={20} color="#64748B" />
            <Text style={styles.infoText}>
              {format(rideDate, "EEEE, MMMM d, yyyy")}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={20} color="#64748B" />
            <Text style={styles.infoText}>{format(rideDate, "HH:mm")}</Text>
          </View>
        </View>

        {/* Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Ionicons name="people-outline" size={20} color="#64748B" />
              <Text style={styles.detailLabel}>Seats</Text>
              <Text style={styles.detailValue}>
                {ride.seats_left} / {ride.seats_total}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="cash-outline" size={20} color="#64748B" />
              <Text style={styles.detailLabel}>Price</Text>
              <Text style={[styles.detailValue, { color: "#16A34A" }]}>
                {ride.price_per_seat} MAD
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="person-outline" size={20} color="#64748B" />
              <Text style={styles.detailLabel}>Driver</Text>
              <Text style={styles.detailValue}>
                {ride.driver?.first_name || "Unknown"}
              </Text>
            </View>
          </View>

          {shouldShowMapAndDriver && ride.driver?.phone_number && (
            <View style={styles.phoneRow}>
              <Ionicons name="call-outline" size={16} color="#64748B" />
              <Text style={styles.phoneText}>{ride.driver.phone_number}</Text>
            </View>
          )}
        </View>

        {/* Notes */}
        {ride.driver_comment && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Driver's Comment</Text>
            <Text style={styles.notesText}>{ride.driver_comment}</Text>
          </View>
        )}

        {/* Driver's View: All Booking Requests */}
        {isOwner && rideBookings && rideBookings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Manage Bookings</Text>
            {bookingLoading && (
              <ActivityIndicator
                size="small"
                color="#007AFF"
                style={{ marginBottom: 10 }}
              />
            )}
            {rideBookings.map((booking: any) => (
              <View key={booking._id || booking.id} style={styles.bookingCard}>
                <View style={styles.bookingHeader}>
                  <Text style={styles.bookingPassenger}>
                    {booking.passenger_first_name ||
                      booking.passenger_id?.first_name ||
                      booking.passenger?.first_name ||
                      "Unknown"}{" "}
                    {booking.passenger_last_name ||
                      booking.passenger_id?.last_name ||
                      booking.passenger?.last_name ||
                      ""}
                  </Text>
                  <View
                    style={[
                      styles.bookingStatusBadge,
                      booking.status === "accepted"
                        ? styles.statusAccepted
                        : booking.status === "rejected"
                          ? styles.statusRejected
                          : booking.status === "cancelled"
                            ? styles.statusCancelled
                            : styles.statusPending,
                    ]}
                  >
                    <Text style={styles.bookingStatusText}>
                      {booking.status === "accepted"
                        ? "Confirmed"
                        : booking.status}
                    </Text>
                  </View>
                </View>

                {/* Common Details */}
                <View style={styles.passengerRow}>
                  <Ionicons name="people-outline" size={16} color="#64748B" />
                  <Text style={styles.bookingInfo}>
                    {booking.seats || booking.seats_booked || 1} seat(s)
                    requested
                  </Text>
                </View>

                {/* Accepted: Show Phone */}
                {booking.status === "accepted" && (
                  <View style={styles.passengerDetails}>
                    {(booking.passenger_phone ||
                      booking.passenger_id?.phone ||
                      booking.passenger?.phone_number) && (
                      <View style={styles.passengerRow}>
                        <Ionicons
                          name="call-outline"
                          size={16}
                          color="#64748B"
                        />
                        <Text style={styles.bookingInfo}>
                          {booking.passenger_phone ||
                            booking.passenger_id?.phone ||
                            booking.passenger?.phone_number}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Pending: Show Actions */}
                {booking.status === "pending" && (
                  <View style={styles.bookingActions}>
                    <TouchableOpacity
                      style={[styles.bookingActionBtn, styles.acceptBtn]}
                      onPress={() => handleAccept(booking._id || booking.id)}
                      disabled={actionId === (booking._id || booking.id)}
                    >
                      {actionId === (booking._id || booking.id) ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.bookingActionText}>Accept</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.bookingActionBtn, styles.rejectBtn]}
                      onPress={() => handleReject(booking._id || booking.id)}
                      disabled={actionId === (booking._id || booking.id)}
                    >
                      {actionId === (booking._id || booking.id) ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.bookingActionText}>Reject</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Footer Actions */}
      <View style={styles.footer}>
        {!isOwner && ride.status === "active" && (ride.seats_left ?? 0) > 0 && (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              if (!isAuthenticated) {
                Alert.alert(
                  "Login Required",
                  "You need to log in to book a ride.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Login",
                      onPress: () => router.push("/login"),
                    },
                  ],
                );
                return;
              }
              setBookingModalVisible(true);
            }}
          >
            <Ionicons name="car" size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>Book This Ride</Text>
          </TouchableOpacity>
        )}

        {isOwner && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.modifyButton]}
              onPress={() =>
                router.push({ pathname: "/(tabs)/rides/edit", params: { id } })
              }
            >
              <Ionicons name="create-outline" size={20} color="#007AFF" />
              <Text style={styles.modifyButtonText}>Modify</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={handleCancel}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <ActivityIndicator color="#DC2626" />
              ) : (
                <>
                  <Ionicons
                    name="close-circle-outline"
                    size={20}
                    color="#DC2626"
                  />
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Booking Modal */}
      <Modal
        visible={bookingModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBookingModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Book Ride</Text>

            <View style={styles.modalInfo}>
              <Text style={styles.modalInfoText}>
                Available: {ride.seats_left} seats
              </Text>
              <Text style={styles.modalInfoText}>
                Price: {ride.price_per_seat} MAD per seat
              </Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Number of Seats</Text>
              <TextInput
                style={styles.input}
                value={seats}
                onChangeText={setSeats}
                keyboardType="number-pad"
                placeholder="1"
              />
            </View>

            <Text style={styles.totalPrice}>
              Total: {(parseFloat(seats) || 0) * ride.price_per_seat} MAD
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setBookingModalVisible(false)}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleBooking}
              >
                <Text style={styles.modalButtonConfirmText}>
                  Confirm Booking
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statusContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "700",
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 12,
  },
  routeContainer: {
    paddingLeft: 8,
  },
  enhancedRoutePoint: {
    flexDirection: "row",
    marginBottom: 4,
  },
  routePointLeftSide: {
    width: 32,
    alignItems: "center",
  },
  routeMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  routeMarkerText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  routeVerticalLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#CBD5E1",
    marginVertical: 2,
    minHeight: 24,
  },
  routePointDetails: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 10,
  },
  routePointHighlighted: {
    backgroundColor: "#FEF3C7",
    marginLeft: 8,
    marginRight: -4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  routePointLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  routePointAddress: {
    fontSize: 14,
    color: "#1E293B",
    lineHeight: 20,
  },
  routePointSubtext: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  mapLegendOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  mapLegendRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
  },
  legendDotItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendDotText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  line: {
    width: 2,
    height: 20,
    backgroundColor: "#E2E8F0",
    marginLeft: 4,
    marginVertical: 4,
  },
  routeText: {
    fontSize: 15,
    color: "#334155",
    flex: 1,
  },
  addressContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    gap: 8,
  },
  addressText: {
    fontSize: 14,
    color: "#64748B",
    flex: 1,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 15,
    color: "#334155",
    marginLeft: 12,
  },
  detailsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailItem: {
    alignItems: "center",
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
    marginTop: 2,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    gap: 6,
  },
  phoneText: {
    fontSize: 14,
    color: "#64748B",
  },
  notesText: {
    fontSize: 15,
    color: "#334155",
    lineHeight: 22,
  },
  footer: {
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    flexDirection: "row",
    gap: 12,
  },
  primaryButton: {
    backgroundColor: "#28a745",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    flex: 1,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    gap: 8,
  },
  modifyButton: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
  },
  modifyButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
  },
  cancelButton: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#DC2626",
  },

  // Booking Card Styles
  bookingCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  bookingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  bookingPassenger: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  bookingStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPending: { backgroundColor: "#fff3cd" },
  statusAccepted: { backgroundColor: "#d4edda" },
  statusRejected: { backgroundColor: "#f8d7da" },
  statusCancelled: { backgroundColor: "#e9ecef" },
  bookingStatusText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
    color: "#333",
  },
  bookingInfo: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  bookingActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  bookingActionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptBtn: { backgroundColor: "#28a745" },
  rejectBtn: { backgroundColor: "#dc3545" },
  bookingActionText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    width: "85%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  modalInfo: {
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  modalInfoText: {
    fontSize: 14,
    color: "#333",
    marginBottom: 4,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#28a745",
    marginBottom: 20,
    textAlign: "center",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  modalButtonCancel: {
    backgroundColor: "#f0f0f0",
  },
  modalButtonCancelText: {
    color: "#333",
    fontWeight: "600",
  },
  modalButtonConfirm: {
    backgroundColor: "#007AFF",
  },
  modalButtonConfirmText: {
    color: "#fff",
    fontWeight: "600",
  },
  mapContainer: {
    height: 200,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  passengerDetails: {
    marginTop: 8,
    backgroundColor: "#F1F5F9",
    padding: 8,
    borderRadius: 8,
  },
  passengerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
});
