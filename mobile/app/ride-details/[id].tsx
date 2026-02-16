import { useAuthStore } from "../../src/store/authStore";
import { useBookingStore } from "../../src/store/bookingStore";
import { useRideStore } from "../../src/store/rideStore";
import { useWalletStore } from "../../src/store/walletStore";
import RideMap from "../../src/components/RideMap";
import ProfileAvatar from "../../src/components/ProfileAvatar";
import { getLocationInfo, LOCATION_COLORS, TripData } from "../../src/utils/tripDisplayUtils";
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
  Linking,
  KeyboardAvoidingView,
  Platform,
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
  
  const { wallet, getWallet, payWithWallet, isPaying } = useWalletStore();
  
  const { user, isAuthenticated } = useAuthStore();
  
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [seats, setSeats] = useState(1);
  const [luggageCount, setLuggageCount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'wallet'>('card');
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
          console.log("👤 Driver data in ride:", data.driver, "Driver ID field:", data.driver_id);
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
      
      // Fetch wallet balance for wallet payment option
      if (isAuthenticated) {
        getWallet().catch(err => console.log("Wallet fetch error:", err));
      }

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
    if (seats < 1) {
      Alert.alert("Error", "Please select at least 1 seat");
      return;
    }

    if (seats > (ride?.seats_left || 0)) {
      Alert.alert("Error", "Not enough seats available");
      return;
    }

    const luggage = luggageCount;
    if (luggage > (ride?.luggage_left ?? ride?.luggage_capacity ?? 0)) {
      Alert.alert("Error", `Only ${ride?.luggage_left ?? ride?.luggage_capacity ?? 0} luggage spot(s) available`);
      return;
    }

    // Check payment method selected
    if (paymentMethod === 'wallet') {
      processWalletPayment();
    } else {
      processPaymentAndBooking();
    }
  };

  const processWalletPayment = async () => {
    try {
      setBookingModalVisible(false);
      
      console.log("Processing wallet payment for ride:", id, "seats:", seats);
      
      const result = await payWithWallet(id!, seats, luggageCount);
      
      if (result.success) {
        // Refresh bookings
        await getMyBookings();
        
        Alert.alert(
          "🎉 Success!", 
          `Booking confirmed!\n\nPaid with wallet balance.\nNew balance: €${(result.newBalance! / 100).toFixed(2)}\n\nNo Stripe fees applied! 💰`,
          [{ text: "OK", onPress: () => router.replace("/(tabs)/explore?tab=active") }]
        );
      } else {
        Alert.alert("Payment Failed", result.message || "Could not process wallet payment");
      }
    } catch (error: any) {
      console.log("Wallet payment error:", error);
      Alert.alert("Error", error.message || "Wallet payment failed");
    }
  };

  const processPaymentAndBooking = async () => {
    try {
      setBookingModalVisible(false);
      
      console.log("Creating payment intent for ride:", id, "seats:", seats);
      
      // Step 1: Create PaymentIntent (NO booking yet)
      const response = await api.post("/payments/create-intent", {
        rideId: id,
        seats: seats,
        luggage_count: luggageCount,
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
        seats: seats,
        luggage_count: luggageCount,
      });
      
      console.log("Complete response:", completeResponse.data);
      
      // Refresh bookings
      await getMyBookings();
      
      Alert.alert("Success", "Payment completed! Your booking is confirmed.", [
        { text: "OK", onPress: () => router.replace("/(tabs)/explore?tab=active") }
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

        {/* === Passenger Booking Status Banner === */}
        {!isOwner && myBooking && (() => {
          const statusConfig: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; title: string; subtitle: string }> = {
            pending: {
              icon: 'hourglass-outline',
              color: '#D97706',
              bg: '#FFFBEB',
              title: 'Booking Pending',
              subtitle: 'Waiting for the driver to accept your request.',
            },
            accepted: {
              icon: 'checkmark-circle',
              color: '#16A34A',
              bg: '#F0FDF4',
              title: 'Booking Confirmed',
              subtitle: 'Your seat is secured. You can view the map and contact the driver.',
            },
            rejected: {
              icon: 'close-circle',
              color: '#DC2626',
              bg: '#FEF2F2',
              title: 'Booking Rejected',
              subtitle: 'The driver did not accept your booking. You have not been charged.',
            },
            cancelled: {
              icon: 'ban',
              color: '#DC2626',
              bg: '#FEF2F2',
              title: 'Booking Cancelled',
              subtitle: 'This booking has been cancelled. Any payment will be refunded to your wallet.',
            },
          };
          const cfg = statusConfig[myBooking.status] || statusConfig.pending;
          return (
            <View style={[styles.bookingBanner, { backgroundColor: cfg.bg, borderLeftColor: cfg.color }]}> 
              <View style={styles.bookingBannerHeader}>
                <Ionicons name={cfg.icon} size={22} color={cfg.color} />
                <Text style={[styles.bookingBannerTitle, { color: cfg.color }]}>{cfg.title}</Text>
              </View>
              <Text style={styles.bookingBannerSubtitle}>{cfg.subtitle}</Text>
              {myBooking.seats && (
                <Text style={styles.bookingBannerMeta}>
                  {myBooking.seats} seat(s)
                </Text>
              )}
              {((myBooking.luggage_count ?? 0) > 0) && (
                <Text style={styles.bookingBannerMeta}>
                  {myBooking.luggage_count} luggage item(s)
                </Text>
              )}
            </View>
          );
        })()}

        {/* === Ride Cancelled Context for Passengers === */}
        {!isOwner && !myBooking && ride.status === 'cancelled' && (
          <View style={[styles.bookingBanner, { backgroundColor: '#FEF2F2', borderLeftColor: '#DC2626' }]}> 
            <View style={styles.bookingBannerHeader}>
              <Ionicons name="information-circle" size={22} color="#DC2626" />
              <Text style={[styles.bookingBannerTitle, { color: '#DC2626' }]}>Ride Cancelled</Text>
            </View>
            <Text style={styles.bookingBannerSubtitle}>
              This ride has been cancelled by the driver. If you had a booking, any payment has been refunded to your wallet.
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Route</Text>
          {(() => {
            // Use shared utility for consistent location display
            const locs = getLocationInfo(ride as unknown as TripData);
            return (
            <View style={styles.routeContainer}>
              {/* Start point (top) */}
              <View style={styles.routeRow}>
                <Ionicons 
                  name={locs.pickupIcon} 
                  size={16} 
                  color={locs.pickupColor} 
                  style={{ marginRight: 8, width: 20, textAlign: 'center' }}
                />
                <Text style={styles.routeText}>{locs.pickup}</Text>
              </View>
              <View style={{ marginVertical: 4, width: 20, alignItems: 'center' }}>
                <View style={{ width: 2, height: 24, backgroundColor: '#CBD5E1' }} />
                <Ionicons name="chevron-down" size={16} color="#CBD5E1" style={{ marginTop: -4 }} />
              </View>
              {/* End point (bottom) */}
              <View style={styles.routeRow}>
                <Ionicons 
                  name={locs.dropoffIcon} 
                  size={16} 
                  color={locs.dropoffColor} 
                  style={{ marginRight: 8, width: 20, textAlign: 'center' }}
                />
                <Text style={styles.routeText}>{locs.dropoff}</Text>
              </View>
            </View>
            );
          })()}
          
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
                {ride.seats_total - ride.seats_left}/{ride.seats_total}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="briefcase-outline" size={20} color="#64748B" />
              <Text style={styles.detailLabel}>Luggage</Text>
              <Text style={styles.detailValue}>
                {(ride.luggage_capacity ?? 0) - (ride.luggage_left ?? ride.luggage_capacity ?? 0)}/{ride.luggage_capacity ?? 0}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="cash-outline" size={20} color="#64748B" />
              <Text style={styles.detailLabel}>Price</Text>
              <Text style={[styles.detailValue, { color: '#16A34A' }]}>
                {ride.price_per_seat} EUR
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.detailItem, { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 8 }]}
              onPress={() => {
                // Handle both ride.driver and ride.driver_id (populated)
                const driverObj = ride.driver || (typeof ride.driver_id === 'object' ? ride.driver_id : null);
                const driverId = driverObj?.id || driverObj?._id || (typeof ride.driver_id === 'string' ? ride.driver_id : null);
                console.log('👤 Driver profile tapped, ID:', driverId, 'Driver obj:', driverObj);
                if (driverId) {
                  router.push({ pathname: "/user-profile/[id]", params: { id: driverId } });
                } else {
                  console.log('⚠️ No driver ID found');
                }
              }}
              activeOpacity={0.6}
            >
              {(() => {
                // Handle both ride.driver and ride.driver_id (populated)
                const driverObj = ride.driver || (typeof ride.driver_id === 'object' ? ride.driver_id : null);
                return (
                  <ProfileAvatar
                    userId={driverObj?.id || driverObj?._id}
                    firstName={driverObj?.first_name}
                    lastName={driverObj?.last_name}
                    avatarUrl={driverObj?.avatar_url}
                    rating={driverObj?.rating}
                    size="small"
                    showRating
                    disabled
                  />
                );
              })()}
              <Text style={[styles.detailLabel, { color: '#3B82F6', fontWeight: '600' }]}>View Driver</Text>
            </TouchableOpacity>
          </View>
        </View>

        {ride.driver_comment && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Driver's Comment</Text>
            <Text style={styles.notesText}>{ride.driver_comment}</Text>
          </View>
        )}

        {/* Accepted Passenger Section - Show driver details and chat */}
        {!isOwner && isAcceptedPassenger && myBooking && (() => {
          const driverObj = ride.driver || (typeof ride.driver_id === 'object' ? ride.driver_id : null);
          const totalPrice = (ride.price_per_seat || 0) * (myBooking.seats || myBooking.seats_booked || 1);
          
          return (
            <View style={styles.section}>
              <View style={[styles.statusBadge, { backgroundColor: '#DCFCE7', alignSelf: 'flex-start', marginBottom: 16 }]}>
                <Ionicons name="checkmark-circle" size={18} color="#16A34A" style={{ marginRight: 6 }} />
                <Text style={[styles.statusText, { color: '#16A34A' }]}>
                  BOOKING CONFIRMED!
                </Text>
              </View>

              <Text style={styles.sectionTitle}>Driver Details</Text>
              
              <TouchableOpacity 
                style={styles.acceptedDriverCard}
                onPress={() => {
                  const driverId = driverObj?._id || driverObj?.id;
                  if (driverId) {
                    router.push({ pathname: "/user-profile/[id]", params: { id: driverId } });
                  }
                }}
              >
                <ProfileAvatar
                  userId={driverObj?._id || driverObj?.id}
                  firstName={driverObj?.first_name}
                  lastName={driverObj?.last_name}
                  avatarUrl={driverObj?.avatar_url}
                  rating={driverObj?.rating}
                  size="medium"
                  showRating
                  disabled
                />
                <View style={{ marginLeft: 14, flex: 1 }}>
                  <Text style={styles.acceptedDriverName}>
                    {driverObj?.first_name} {driverObj?.last_name}
                  </Text>
                  {(ride.driver?.phone || ride.driver?.phone_number || driverObj?.phone) && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <Ionicons name="call-outline" size={14} color="#64748B" />
                      <Text style={styles.acceptedDriverPhone}> {ride.driver?.phone || ride.driver?.phone_number || driverObj?.phone}</Text>
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
              </TouchableOpacity>

              <View style={styles.tripSummaryCard}>
                <View style={styles.tripSummaryRow}>
                  <Text style={styles.tripSummaryLabel}>Seats booked:</Text>
                  <Text style={styles.tripSummaryValue}>{myBooking.seats || myBooking.seats_booked || 1}</Text>
                </View>
                {((myBooking.luggage_count ?? 0) > 0) && (
                  <View style={styles.tripSummaryRow}>
                    <Text style={styles.tripSummaryLabel}>Luggage:</Text>
                    <Text style={styles.tripSummaryValue}>{myBooking.luggage_count} item(s)</Text>
                  </View>
                )}
                <View style={styles.tripSummaryRow}>
                  <Text style={styles.tripSummaryLabel}>Price per seat:</Text>
                  <Text style={styles.tripSummaryValue}>{ride.price_per_seat} EUR</Text>
                </View>
                <View style={[styles.tripSummaryRow, { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 10, marginTop: 6 }]}>
                  <Text style={[styles.tripSummaryLabel, { fontWeight: '700' }]}>Total Paid:</Text>
                  <Text style={[styles.tripSummaryValue, { fontWeight: '700', color: '#16A34A', fontSize: 18 }]}>
                    {totalPrice} EUR
                  </Text>
                </View>
              </View>

              <View style={styles.contactButtonsRow}>
                <TouchableOpacity 
                  style={[styles.chatContactBtn, { flex: 1 }]}
                  onPress={() => router.push({ pathname: "/chat", params: { bookingId: myBooking._id || myBooking.id } })}
                >
                  <Ionicons name="chatbubbles" size={20} color="#fff" />
                  <Text style={styles.chatContactBtnText}>Chat with Driver</Text>
                </TouchableOpacity>
                {(ride.driver?.phone || ride.driver?.phone_number || driverObj?.phone) && (
                  <TouchableOpacity 
                    style={[styles.callContactBtn, { flex: 1 }]}
                    onPress={() => Linking.openURL(`tel:${ride.driver?.phone || ride.driver?.phone_number || driverObj?.phone}`)}
                  >
                    <Ionicons name="call" size={18} color="#fff" />
                    <Text style={styles.callContactBtnText}>Call</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })()}

        {isOwner && rideBookings && rideBookings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Manage Bookings</Text>
            {bookingLoading && (
              <ActivityIndicator size="small" color="#007AFF" style={{marginBottom: 10}} />
            )}
            {rideBookings.map((booking: any) => {
              const passengerId = booking.passenger_id?._id || booking.passenger_id || booking.passenger?._id || booking.passenger?.id;
              const passengerFirstName = booking.passenger_first_name || booking.passenger_id?.first_name || booking.passenger?.first_name;
              const passengerLastName = booking.passenger_last_name || booking.passenger_id?.last_name || booking.passenger?.last_name;
              const passengerAvatarUrl = booking.passenger_id?.avatar_url || booking.passenger?.avatar_url;
              const passengerRating = booking.passenger_id?.rating || booking.passenger?.rating;
              
              return (
              <View key={booking._id || booking.id} style={styles.bookingCard}>
                <View style={styles.bookingHeader}>
                  <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                    onPress={() => {
                      if (passengerId) router.push({ pathname: "/user-profile/[id]", params: { id: passengerId } });
                    }}
                    activeOpacity={0.7}
                  >
                    <ProfileAvatar
                      userId={passengerId}
                      firstName={passengerFirstName}
                      lastName={passengerLastName}
                      avatarUrl={passengerAvatarUrl}
                      rating={passengerRating}
                      size="small"
                      showRating
                      disabled
                    />
                    <Text style={styles.bookingPassenger}>
                      {passengerFirstName || "Unknown"} {passengerLastName || ""}
                    </Text>
                  </TouchableOpacity>
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
                {(booking.luggage_count > 0) && (
                  <View style={[styles.passengerRow, { marginTop: 4 }]}>
                    <Ionicons name="briefcase-outline" size={16} color="#64748B" />
                    <Text style={styles.bookingInfo}>
                      {booking.luggage_count} luggage item(s)
                    </Text>
                  </View>
                )}

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
                    <TouchableOpacity 
                      style={styles.passengerRow}
                      onPress={() => Linking.openURL(`tel:${booking.passenger_phone || booking.passenger?.phone}`)}
                    >
                        <Ionicons name="call-outline" size={16} color="#007AFF" />
                        <Text style={[styles.bookingInfo, { color: '#007AFF' }]}>
                        {booking.passenger_phone || booking.passenger?.phone}
                        </Text>
                    </TouchableOpacity>
                    )}
                    <View style={styles.driverContactButtonsRow}>
                      <TouchableOpacity 
                        style={[styles.driverChatBtn, { flex: 1 }]}
                        onPress={() => router.push({ pathname: "/chat", params: { bookingId: booking._id || booking.id } })}
                      >
                        <Ionicons name="chatbubbles" size={20} color="#fff" />
                        <Text style={styles.driverChatBtnText}>Chat</Text>
                      </TouchableOpacity>
                      {(booking.passenger_phone || booking.passenger?.phone) && (
                        <TouchableOpacity 
                          style={[styles.driverCallBtn, { flex: 1 }]}
                          onPress={() => Linking.openURL(`tel:${booking.passenger_phone || booking.passenger?.phone}`)}
                        >
                          <Ionicons name="call" size={18} color="#fff" />
                          <Text style={styles.driverCallBtnText}>Call</Text>
                        </TouchableOpacity>
                      )}
                    </View>
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
            );
            })}
          </View>
        )}
        
        <View style={{ height: 100 }} />
      </ScrollView>

      
      <View style={styles.footer}>
          {!isOwner && ride.status === "active" && (ride.seats_left ?? 0) > 0 && !myBooking && (
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
          {!isOwner && myBooking?.status === 'pending' && (
            <View style={styles.pendingFooterBanner}>
              <Ionicons name="hourglass-outline" size={18} color="#D97706" />
              <Text style={styles.pendingFooterText}>Waiting for driver approval...</Text>
            </View>
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
        <KeyboardAvoidingView
          behavior="padding"
          style={{ flex: 1 }}
          keyboardVerticalOffset={20}
        >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Book Ride</Text>

            <View style={styles.modalInfo}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={styles.modalInfoText}>
                  Seats: {(ride.seats_total - ride.seats_left)}/{ride.seats_total}
                </Text>
                <Text style={styles.modalInfoText}>
                  Luggage: {(ride.luggage_capacity ?? 0) - (ride.luggage_left ?? ride.luggage_capacity ?? 0)}/{ride.luggage_capacity ?? 0}
                </Text>
              </View>
              <Text style={styles.modalInfoText}>
                Price: {ride.price_per_seat} EUR per seat
              </Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Number of Seats</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 4 }}>
                <TouchableOpacity
                  onPress={() => setSeats(Math.max(1, seats - 1))}
                  style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: seats > 1 ? '#E2E8F0' : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
                  disabled={seats <= 1}
                >
                  <Ionicons name="remove" size={22} color={seats > 1 ? '#334155' : '#CBD5E1'} />
                </TouchableOpacity>
                <View style={{ minWidth: 50, alignItems: 'center' }}>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: '#1E293B' }}>{seats}</Text>
                  <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>seat{seats !== 1 ? 's' : ''}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSeats(Math.min(ride.seats_left, seats + 1))}
                  style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: seats < ride.seats_left ? '#DBEAFE' : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
                  disabled={seats >= ride.seats_left}
                >
                  <Ionicons name="add" size={22} color={seats < ride.seats_left ? '#3B82F6' : '#CBD5E1'} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Number of Luggage</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 4 }}>
                <TouchableOpacity
                  onPress={() => setLuggageCount(Math.max(0, luggageCount - 1))}
                  style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: luggageCount > 0 ? '#E2E8F0' : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
                  disabled={luggageCount <= 0}
                >
                  <Ionicons name="remove" size={22} color={luggageCount > 0 ? '#334155' : '#CBD5E1'} />
                </TouchableOpacity>
                <View style={{ minWidth: 50, alignItems: 'center' }}>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: '#1E293B' }}>{luggageCount}</Text>
                  <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>bag{luggageCount !== 1 ? 's' : ''}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setLuggageCount(Math.min(ride?.luggage_left ?? ride?.luggage_capacity ?? 0, luggageCount + 1))}
                  style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: luggageCount < (ride?.luggage_left ?? ride?.luggage_capacity ?? 0) ? '#DBEAFE' : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
                  disabled={luggageCount >= (ride?.luggage_left ?? ride?.luggage_capacity ?? 0)}
                >
                  <Ionicons name="add" size={22} color={luggageCount < (ride?.luggage_left ?? ride?.luggage_capacity ?? 0) ? '#3B82F6' : '#CBD5E1'} />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.totalPrice}>
              Total: {seats * ride.price_per_seat} EUR
            </Text>

            {/* Payment Method Selection */}
            <View style={styles.paymentMethodSection}>
              <Text style={styles.paymentMethodTitle}>Payment Method</Text>
              
              {/* Wallet Payment Option */}
              <TouchableOpacity
                style={[
                  styles.paymentMethodOption,
                  paymentMethod === 'wallet' && styles.paymentMethodSelected,
                  (wallet?.balance || 0) < seats * (ride?.price_per_seat || 0) * 100 && styles.paymentMethodDisabled
                ]}
                onPress={() => {
                  const totalCents = seats * (ride?.price_per_seat || 0) * 100;
                  if ((wallet?.balance || 0) >= totalCents) {
                    setPaymentMethod('wallet');
                  }
                }}
                disabled={(wallet?.balance || 0) < seats * (ride?.price_per_seat || 0) * 100}
              >
                <View style={styles.paymentMethodLeft}>
                  <Ionicons 
                    name="wallet" 
                    size={24} 
                    color={paymentMethod === 'wallet' ? '#16A34A' : '#64748B'} 
                  />
                  <View style={styles.paymentMethodInfo}>
                    <Text style={[
                      styles.paymentMethodName,
                      paymentMethod === 'wallet' && styles.paymentMethodNameSelected
                    ]}>
                      Wallet Balance
                    </Text>
                    <Text style={styles.paymentMethodBalance}>
                      Available: €{wallet?.balance_display || '0.00'}
                    </Text>
                  </View>
                </View>
                {paymentMethod === 'wallet' && (
                  <View style={styles.paymentMethodCheck}>
                    <Ionicons name="checkmark-circle" size={24} color="#16A34A" />
                  </View>
                )}
                {(wallet?.balance || 0) >= seats * (ride?.price_per_seat || 0) * 100 && (
                  <View style={styles.noFeeBadge}>
                    <Text style={styles.noFeeText}>No fees!</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Insufficient balance warning */}
              {(wallet?.balance || 0) < seats * (ride?.price_per_seat || 0) * 100 && (
                <Text style={styles.insufficientBalanceText}>
                  Insufficient wallet balance. Need €{(seats * (ride?.price_per_seat || 0)).toFixed(2)}
                </Text>
              )}

              {/* Card Payment Option */}
              <TouchableOpacity
                style={[
                  styles.paymentMethodOption,
                  paymentMethod === 'card' && styles.paymentMethodSelected
                ]}
                onPress={() => setPaymentMethod('card')}
              >
                <View style={styles.paymentMethodLeft}>
                  <Ionicons 
                    name="card" 
                    size={24} 
                    color={paymentMethod === 'card' ? '#3B82F6' : '#64748B'} 
                  />
                  <View style={styles.paymentMethodInfo}>
                    <Text style={[
                      styles.paymentMethodName,
                      paymentMethod === 'card' && styles.paymentMethodNameSelected
                    ]}>
                      Credit/Debit Card
                    </Text>
                    <Text style={styles.paymentMethodBalance}>
                      Pay with Stripe
                    </Text>
                  </View>
                </View>
                {paymentMethod === 'card' && (
                  <View style={styles.paymentMethodCheck}>
                    <Ionicons name="checkmark-circle" size={24} color="#3B82F6" />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setBookingModalVisible(false)}
                disabled={isPaying}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton, 
                  styles.modalButtonConfirm,
                  paymentMethod === 'wallet' && styles.modalButtonWallet
                ]}
                onPress={handleBooking}
                disabled={isPaying}
              >
                {isPaying ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalButtonConfirmText}>
                    {paymentMethod === 'wallet' ? '💰 Pay with Wallet' : 'Pay with Card'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
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
  // Passenger booking status banner
  bookingBanner: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  bookingBannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  bookingBannerTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  bookingBannerSubtitle: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 20,
    marginLeft: 30,
  },
  bookingBannerMeta: {
    fontSize: 13,
    color: "#64748B",
    marginLeft: 30,
    marginTop: 4,
    fontWeight: "500",
  },
  pendingFooterBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFBEB",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
    flex: 1,
  },
  pendingFooterText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#D97706",
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
  contactButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  chatContactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  chatContactBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  callContactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  callContactBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  driverContactSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
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
  // Payment Method Styles
  paymentMethodSection: {
    marginBottom: 20,
  },
  paymentMethodTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 12,
  },
  paymentMethodOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: "#FAFAFA",
  },
  paymentMethodSelected: {
    borderColor: "#16A34A",
    backgroundColor: "#F0FDF4",
  },
  paymentMethodDisabled: {
    opacity: 0.5,
    backgroundColor: "#F1F5F9",
  },
  paymentMethodLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  paymentMethodInfo: {
    marginLeft: 12,
  },
  paymentMethodName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#334155",
  },
  paymentMethodNameSelected: {
    color: "#16A34A",
  },
  paymentMethodBalance: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  paymentMethodCheck: {
    marginLeft: 8,
  },
  noFeeBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  noFeeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#16A34A",
  },
  insufficientBalanceText: {
    fontSize: 12,
    color: "#DC2626",
    marginTop: -6,
    marginBottom: 10,
    marginLeft: 4,
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
  modalButtonWallet: {
    backgroundColor: "#16A34A",
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
  // Accepted Driver/Passenger Styles
  acceptedDriverCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  acceptedDriverName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
  },
  acceptedDriverPhone: {
    fontSize: 14,
    color: "#64748B",
    marginLeft: 4,
  },
  tripSummaryCard: {
    backgroundColor: "#F8FAFC",
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  tripSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  tripSummaryLabel: {
    fontSize: 14,
    color: "#64748B",
  },
  tripSummaryValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
  },
  contactButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chatContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  chatContactBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  callContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  callContactBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  driverContactButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  driverChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  driverChatBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  driverCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28A745',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  driverCallBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});