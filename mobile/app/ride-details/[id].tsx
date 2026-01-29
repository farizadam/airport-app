import { useAuthStore } from "../../src/store/authStore";
import { useBookingStore } from "../../src/store/bookingStore";
import { useRideStore } from "../../src/store/rideStore";
import RideMap from "../../src/components/RideMap";
import { format } from "date-fns";
import { useStripe } from "@stripe/stripe-react-native";
import { api } from "../../src/lib/api";
import { useLocalSearchParams, useRouter, useGlobalSearchParams, Stack } from "expo-router";
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
  const router = useRouter();
  const localParams = useLocalSearchParams<{ id: string }>();
  const globalParams = useGlobalSearchParams<{ id: string }>();
  
  const id = localParams?.id || globalParams?.id;

  const {
    fetchRideById,
    cancelRide,
    getMyRides,
  } = useRideStore();
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
          console.log("✅ Ride data received for ID:", id, "Data ID:", data.id || data._id);
          setRide(data);
          
          // Fetch bookings if this is the driver
          const userId = String(user?.id || "");
          const dId = data?.driver_id;
          const driverId = String((typeof dId === 'object' && dId !== null && '_id' in dId) ? dId._id : dId || "");
          
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
    }, [id, user?.id])
  );

  const onRefresh = useCallback(async () => {
    if (!id) return;
    setRefreshing(true);
    try {
      await fetchRideById(id);
      await getMyBookings();
      
      const userId = String(user?.id || "");
      const dId = ride?.driver_id;
      const driverId = String((typeof dId === 'object' && dId !== null && '_id' in dId) ? dId._id : dId || "");
      
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
      const data = await fetchRideById(id as string);
      setRide(data);
      await getMyRides(); 
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
      const data = await fetchRideById(id as string);
      setRide(data);
      await getMyRides(); 
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
                Alert.alert("Success", "Ride cancelled successfully", [
                  { 
                    text: "OK", 
                    onPress: () => router.replace("/(tabs)/explore?tab=myrides") 
                  }
                ]);
              }
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to cancel ride");
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ]
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
    
    if (ride.home_latitude && ride.home_longitude) {
      items.push({
        _id: 'origin',
        type: 'ride',
        pickup_location: {
          latitude: ride.home_latitude,
          longitude: ride.home_longitude,
          city: ride.home_city
        },
        dropoff_location: { latitude: 0, longitude: 0 },
      });
    }

    if (ride.airport?.latitude && ride.airport?.longitude) {
      items.push({
        _id: 'dest',
        type: 'airport',
        pickup_location: {
          latitude: ride.airport.latitude,
          longitude: ride.airport.longitude,
          city: ride.airport.name
        },
        dropoff_location: { latitude: 0, longitude: 0 },
      });
    }
    return items;
  }, [ride]);

  if (loading || !ride) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const dId = ride.driver_id;
  const driverId = String((typeof dId === 'object' && dId !== null && '_id' in dId) ? dId._id : dId || "");
  const isOwner = String(user?.id || "") === driverId;

  const myBooking = myBookings?.find((b: any) => 
    (b.ride_id?._id === ride._id || b.ride_id === ride._id)
  );
  const isAcceptedPassenger = myBooking?.status === 'accepted';
  const shouldShowMapAndDriver = isOwner || isAcceptedPassenger;

  const rideDate = ride.datetime_start 
    ? new Date(ride.datetime_start.replace(" ", "T")) 
    : new Date();

  const hasAcceptedBookings = rideBookings?.some((b: any) => b.status === 'accepted');

  return (
    <SafeAreaView style={styles.container} edges={['top']} key={id}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* ... header ... */}
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {shouldShowMapAndDriver && routeCoordinates.length > 0 ? (
          <View style={styles.mapContainer}>
             <RideMap 
               routeCoordinates={routeCoordinates}
               items={mapItems}
               style={{ flex: 1 }}
             />
          </View>
        ) : !shouldShowMapAndDriver && (
          <View style={[styles.mapContainer, { backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="map-outline" size={48} color="#CBD5E1" />
            <Text style={{ color: '#64748B', marginTop: 12, fontWeight: '500' }}>
              Map available after booking acceptance
            </Text>
          </View>
        )}

        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { 
            backgroundColor: ride.status === 'active' ? '#DCFCE7' : 
                           ride.status === 'cancelled' ? '#FEE2E2' : '#F1F5F9' 
          }]}>
            <Text style={[styles.statusText, {
              color: ride.status === 'active' ? '#16A34A' : 
                     ride.status === 'cancelled' ? '#DC2626' : '#64748B'
            }]}>
              {ride.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Route</Text>
          <View style={styles.routeContainer}>
            <View style={styles.routeRow}>
              <Ionicons 
                name={ride.direction === 'to_airport' ? "location" : "airplane"} 
                size={16} 
                color={ride.direction === 'to_airport' ? "#EF4444" : "#007AFF"} 
                style={{ marginRight: 8, width: 20, textAlign: 'center' }}
              />
              <Text style={styles.routeText}>
                {ride.direction === 'to_airport' 
                  ? (ride.home_city || "City")
                  : (ride.airport?.name || ride.airport?.iata_code || "Airport")}
              </Text>
            </View>
            <View style={{ marginVertical: 4, width: 20, alignItems: 'center' }}>
              <View style={{ width: 2, height: 24, backgroundColor: '#CBD5E1' }} />
              <Ionicons name="chevron-down" size={16} color="#CBD5E1" style={{ marginTop: -4 }} />
            </View>
            <View style={styles.routeRow}>
              <Ionicons 
                name={ride.direction === 'to_airport' ? "airplane" : "location"} 
                size={16} 
                color={ride.direction === 'to_airport' ? "#007AFF" : "#EF4444"} 
                style={{ marginRight: 8, width: 20, textAlign: 'center' }}
              />
              <Text style={styles.routeText}>
                {ride.direction === 'to_airport'
                  ? (ride.airport?.name || ride.airport?.iata_code || "Airport")
                  : (ride.home_city || "City")}
              </Text>
            </View>
          </View>
          
          {shouldShowMapAndDriver && ride.home_address && (
            <View style={styles.addressContainer}>
               <Ionicons name="location-outline" size={16} color="#64748B" />
               <Text style={styles.addressText}>{ride.home_address}</Text>
            </View>
          )}
        </View>

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
            <Text style={styles.infoText}>
              {format(rideDate, "HH:mm")}
            </Text>
          </View>
        </View>

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
              <Text style={[styles.detailValue, { color: '#16A34A' }]}>
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
          
          {shouldShowMapAndDriver && (ride.driver?.phone || ride.driver?.phone_number) && (
             <View style={styles.phoneRow}>
                <Ionicons name="call-outline" size={16} color="#64748B" />
                <Text style={styles.phoneText}>{ride.driver?.phone || ride.driver?.phone_number}</Text>
             </View>
          )}
        </View>

        {ride.driver_comment && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Driver's Comment</Text>
            <Text style={styles.notesText}>{ride.driver_comment}</Text>
          </View>
        )}

        {isOwner && rideBookings && rideBookings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Manage Bookings</Text>
            {bookingLoading && (
              <ActivityIndicator size="small" color="#007AFF" style={{marginBottom: 10}} />
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
                  <View style={[
                    styles.bookingStatusBadge, 
                    booking.status === 'accepted' ? styles.statusAccepted : 
                    booking.status === 'rejected' ? styles.statusRejected :
                    booking.status === 'cancelled' ? styles.statusCancelled :
                    styles.statusPending
                  ]}>
                    <Text style={styles.bookingStatusText}>
                      {booking.status === 'accepted' ? 'Confirmed' : booking.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.passengerRow}>
                   <Ionicons name="people-outline" size={16} color="#64748B" />
                   <Text style={styles.bookingInfo}>
                     {booking.seats || booking.seats_booked || 1} seat(s) requested
                   </Text>
                </View>

                {/* Pickup/Dropoff Locations */}
                {(booking.pickup_location?.address || booking.dropoff_location?.address) && (
                  <View style={{ marginTop: 8, paddingLeft: 4 }}>
                    {booking.pickup_location?.address && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Ionicons name="location-outline" size={14} color="#64748B" style={{ marginRight: 6 }} />
                        <Text style={{ fontSize: 13, color: "#475569" }} numberOfLines={1}>
                          <Text style={{ fontWeight: '600' }}>From: </Text>
                          {booking.pickup_location.address.split(',')[0]}
                        </Text>
                      </View>
                    )}
                    {booking.dropoff_location?.address && (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="flag-outline" size={14} color="#64748B" style={{ marginRight: 6 }} />
                        <Text style={{ fontSize: 13, color: "#475569" }} numberOfLines={1}>
                          <Text style={{ fontWeight: '600' }}>To: </Text>
                          {booking.dropoff_location.address.split(',')[0]}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {booking.status === 'accepted' && (
                  <View style={styles.passengerDetails}>
                    {(booking.passenger_phone || booking.passenger?.phone) && (
                    <View style={styles.passengerRow}>
                        <Ionicons name="call-outline" size={16} color="#64748B" />
                        <Text style={styles.bookingInfo}>
                        {booking.passenger_phone || booking.passenger?.phone}
                        </Text>
                    </View>
                    )}
                  </View>
                )}

                {booking.status === 'pending' && (
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
                     ]
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
                style={[
                  styles.actionButton, 
                  styles.modifyButton,
                  hasAcceptedBookings && { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' }
                ]}
                onPress={() => {
                   if (hasAcceptedBookings) {
                      Alert.alert("Cannot Modify", "You cannot modify a ride that has confirmed bookings.");
                      return;
                   }
                   router.push({ pathname: "/(tabs)/rides/edit", params: { id } });
                }}
                disabled={hasAcceptedBookings}
              >
                <Ionicons 
                  name="create-outline" 
                  size={20} 
                  color={hasAcceptedBookings ? "#94A3B8" : "#007AFF"} 
                />
                <Text style={[
                  styles.modifyButtonText,
                  hasAcceptedBookings && { color: "#94A3B8" }
                ]}>Modify</Text>
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
                    <Ionicons name="close-circle-outline" size={20} color="#DC2626" />
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
      </View>

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
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  passengerDetails: {
    marginTop: 8,
    backgroundColor: '#F1F5F9',
    padding: 8,
    borderRadius: 8,
  },
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
});