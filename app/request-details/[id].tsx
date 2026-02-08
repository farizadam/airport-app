import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRequestStore } from "@/store/requestStore";
import { useAuthStore } from "@/store/authStore";
import { useWalletStore } from "@/store/walletStore";
import { RideRequest, Offer } from "@/types";
import LeafletMap from "@/components/LeafletMap";
import ProfileAvatar from "@/components/ProfileAvatar";
import { getLocationInfo, LOCATION_COLORS, TripData } from "@/utils/tripDisplayUtils";
import { useStripe } from "@stripe/stripe-react-native";
import { api } from "@/lib/api";

export default function RequestDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  // @ts-ignore
  const { fetchRequestById, cancelRequest, makeOffer, acceptOffer, rejectOffer } = useRequestStore();
  const { user } = useAuthStore();
  const { wallet, getWallet, isPaying } = useWalletStore();
  const [request, setRequest] = useState<RideRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  
  // Offer modal state
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [offerPrice, setOfferPrice] = useState("");
  const [submittingOffer, setSubmittingOffer] = useState(false);
  
  // Payment modal state for accepting offers
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'wallet'>('card');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [rejectingOfferId, setRejectingOfferId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        if (id) {
          try {
            // Reset state when ID changes to avoid showing stale data
            setRequest(null);
            setLoading(true);
            const data = await fetchRequestById(id);
            setRequest(data);
            
            // Fetch wallet balance for payment options
            getWallet().catch(err => console.log("Wallet fetch error:", err));
          } catch (error) {
            console.error("Failed to load request:", error);
            Alert.alert("Error", "Failed to load request details");
          } finally {
            setLoading(false);
          }
        }
      };
      loadData();

      return () => {
        setRequest(null);
        setLoading(true);
      };
    }, [id])
  );

  const handleCancel = async () => {
    Alert.alert(
      "Cancel Request",
      "Are you sure you want to cancel this request?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            setIsCancelling(true);
            try {
              await cancelRequest(id);
              Alert.alert("Success", "Request cancelled successfully", [
                { text: "OK", onPress: () => router.replace("/(tabs)/explore?tab=myrequests") }
              ]);
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to cancel request");
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ]
    );
  };

  const openOfferModal = () => {
    setOfferPrice(request?.max_price_per_seat?.toString() || "");
    setOfferModalVisible(true);
  };

  const handleSubmitOffer = async () => {
    if (!offerPrice || parseFloat(offerPrice) <= 0) {
      Alert.alert("Error", "Please enter a valid price per seat");
      return;
    }

    setSubmittingOffer(true);
    try {
      await makeOffer(id, {
        price_per_seat: parseFloat(offerPrice),
      });
      Alert.alert("Success", "Your offer has been sent to the passenger!", [
        { text: "OK", onPress: () => {
          setOfferModalVisible(false);
          router.replace("/(tabs)/explore?tab=myoffers");
        }}
      ]);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to send offer");
    } finally {
      setSubmittingOffer(false);
    }
  };

  // Open payment modal when user wants to accept an offer
  const handleOpenPaymentModal = (offer: Offer) => {
    setSelectedOffer(offer);
    setPaymentMethod('card'); // Default to card
    setPaymentModalVisible(true);
  };

  // Handle offer rejection
  const handleRejectOffer = async (offerId: string) => {
    Alert.alert(
      "Reject Offer",
      "Are you sure you want to reject this offer?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Reject",
          style: "destructive",
          onPress: async () => {
            setRejectingOfferId(offerId);
            try {
              await rejectOffer(id, offerId);
              // Refresh request data
              const data = await fetchRequestById(id);
              setRequest(data);
              Alert.alert("Success", "Offer rejected");
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to reject offer");
            } finally {
              setRejectingOfferId(null);
            }
          },
        },
      ]
    );
  };

  // Process wallet payment for accepting offer
  const processWalletPayment = async () => {
    if (!selectedOffer || !request) return;
    
    setProcessingPayment(true);
    try {
      // Call backend to accept offer with wallet payment
      const response = await api.post(`/ride-requests/${id}/accept-offer-with-payment`, {
        offer_id: selectedOffer._id,
        payment_method: 'wallet',
      });
      
      setPaymentModalVisible(false);
      
      // Refresh wallet
      await getWallet();
      
      Alert.alert(
        "🎉 Success!",
        `Offer accepted!\n\nPaid with wallet balance.\nNo Stripe fees applied! 💰`,
        [{ text: "OK", onPress: () => router.replace("/(tabs)/explore?tab=active") }]
      );
    } catch (error: any) {
      console.log("Wallet payment error:", error);
      Alert.alert("Error", error.response?.data?.message || error.message || "Payment failed");
    } finally {
      setProcessingPayment(false);
    }
  };

  // Process card payment for accepting offer
  const processCardPayment = async () => {
    if (!selectedOffer || !request) return;
    
    setProcessingPayment(true);
    try {
      // Step 1: Create payment intent
      const intentResponse = await api.post("/payments/create-offer-intent", {
        requestId: id,
        offerId: selectedOffer._id,
      });
      
      const { clientSecret, paymentIntentId } = intentResponse.data;

      // Step 2: Initialize payment sheet
      const initResult = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: "Airport Carpooling",
      });
      
      if (initResult.error) {
        Alert.alert("Error", initResult.error.message || "Failed to initialize payment");
        setProcessingPayment(false);
        return;
      }

      // Step 3: Present payment sheet
      const paymentResult = await presentPaymentSheet();
      
      if (paymentResult.error) {
        Alert.alert("Payment Cancelled", paymentResult.error.message || "Payment was not completed.");
        setProcessingPayment(false);
        return;
      }
      
      // Step 4: Complete payment and accept offer
      await api.post(`/ride-requests/${id}/accept-offer-with-payment`, {
        offer_id: selectedOffer._id,
        payment_method: 'card',
        payment_intent_id: paymentIntentId,
      });
      
      setPaymentModalVisible(false);
      
      Alert.alert("Success", "Payment completed! Offer accepted.", [
        { text: "OK", onPress: () => router.replace("/(tabs)/explore?tab=active") }
      ]);
    } catch (error: any) {
      console.log("Card payment error:", error);
      Alert.alert("Error", error.response?.data?.message || error.message || "Payment failed");
    } finally {
      setProcessingPayment(false);
    }
  };

  // Handle payment confirmation
  const handleConfirmPayment = () => {
    if (paymentMethod === 'wallet') {
      processWalletPayment();
    } else {
      processCardPayment();
    }
  };

  // Calculate total amount for selected offer
  const getTotalAmount = () => {
    if (!selectedOffer || !request) return 0;
    return (selectedOffer.price_per_seat || 0) * (request.seats_needed || 1);
  };

  if (loading || !request) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const isOwner = request.passenger?._id === user?._id;
  const date = new Date(request.preferred_datetime);
  const airportName = typeof request.airport === 'object' ? request.airport?.name : "Airport";

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} key={id}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Status Badge */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { 
            backgroundColor: request.status === 'pending' ? '#FEF3C7' : 
                           request.status === 'matched' ? '#DCFCE7' : '#F1F5F9' 
          }]}>
            <Text style={[styles.statusText, {
              color: request.status === 'pending' ? '#D97706' : 
                     request.status === 'matched' ? '#16A34A' : '#64748B'
            }]}>
              {request.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Route Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Route</Text>
          {(() => {
            // Use shared utility for consistent location display
            const locs = getLocationInfo(request as unknown as TripData);
            return (
            <View style={styles.routeContainer}>
              {/* Start / Origin */}
              <View style={styles.routeRow}>
                <Ionicons 
                  name={locs.pickupIcon} 
                  size={16} 
                  color={locs.pickupColor} 
                  style={{ marginRight: 8, width: 20, textAlign: 'center' }}
                />
                <Text style={styles.routeText}>{locs.pickup}</Text>
              </View>
              <View style={{ width: 20, alignItems: 'center', marginVertical: 4 }}>
                <View style={{ width: 2, height: 24, backgroundColor: '#CBD5E1' }} />
                <Ionicons name="chevron-down" size={16} color="#CBD5E1" style={{ marginTop: -4 }} />
              </View>
              {/* End / Destination */}
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
        </View>

        {/* Map Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 Trip Map</Text>
          {request.location_latitude && request.location_longitude ? (
            <View style={styles.mapContainer}>
              <LeafletMap
                mode="view"
                initialRegion={{
                  latitude: request.location_latitude,
                  longitude: request.location_longitude,
                  zoom: 11
                }}
                markers={[
                  {
                    id: 'location',
                    latitude: request.location_latitude,
                    longitude: request.location_longitude,
                    title: request.direction === 'to_airport' ? 'Pickup' : 'Dropoff',
                    type: 'request'
                  },
                  ...(typeof request.airport === 'object' && request.airport?.latitude && request.airport?.longitude ? [{
                    id: 'airport',
                    latitude: request.airport.latitude,
                    longitude: request.airport.longitude,
                    title: request.airport.name || 'Airport',
                    type: 'airport' as const
                  }] : [])
                ]}
                routeCoordinates={
                  typeof request.airport === 'object' && request.airport?.latitude && request.airport?.longitude
                    ? request.direction === 'to_airport'
                      ? [
                          { latitude: request.location_latitude, longitude: request.location_longitude },
                          { latitude: request.airport.latitude, longitude: request.airport.longitude }
                        ]
                      : [
                          { latitude: request.airport.latitude, longitude: request.airport.longitude },
                          { latitude: request.location_latitude, longitude: request.location_longitude }
                        ]
                    : []
                }
              />
              <View style={styles.mapLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#3B82F6" }]} />
                  <Text style={styles.legendText}>
                    {request.direction === 'to_airport' ? 'Pickup' : 'Airport'}
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#EF4444" }]} />
                  <Text style={styles.legendText}>
                    {request.direction === 'to_airport' ? 'Airport' : 'Dropoff'}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={[styles.mapContainer, { backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="map-outline" size={48} color="#CBD5E1" />
              <Text style={{ color: '#64748B', marginTop: 12, fontWeight: '500' }}>
                Location not available
              </Text>
            </View>
          )}
        </View>

        {/* Date & Time */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Date & Time</Text>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={20} color="#64748B" />
            <Text style={styles.infoText}>
              {date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={20} color="#64748B" />
            <Text style={styles.infoText}>
              {date.toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit', hour12: false })}
            </Text>
          </View>
        </View>

        {/* Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Ionicons name="people-outline" size={20} color="#64748B" />
              <Text style={styles.detailLabel}>Seats</Text>
              <Text style={styles.detailValue}>{request.seats_needed}</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="briefcase-outline" size={20} color="#64748B" />
              <Text style={styles.detailLabel}>Luggage</Text>
              <Text style={styles.detailValue}>{request.luggage_count || 0}</Text>
            </View>
            <TouchableOpacity 
              style={[styles.detailItem, { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 8 }]}
              onPress={() => {
                // Handle both request.passenger and request.passenger_id (populated)
                const passengerObj = request.passenger || (typeof request.passenger_id === 'object' ? request.passenger_id : null);
                const passengerId = passengerObj?.id || passengerObj?._id || (typeof request.passenger_id === 'string' ? request.passenger_id : null);
                console.log('👤 Passenger profile tapped, ID:', passengerId, 'Passenger obj:', passengerObj);
                if (passengerId) {
                  router.push({ pathname: "/user-profile/[id]", params: { id: passengerId } });
                } else {
                  console.log('⚠️ No passenger ID found');
                }
              }}
              activeOpacity={0.6}
            >
              {(() => {
                // Handle both request.passenger and request.passenger_id (populated)
                const passengerObj = request.passenger || (typeof request.passenger_id === 'object' ? request.passenger_id : null);
                return (
                  <ProfileAvatar
                    userId={passengerObj?.id || passengerObj?._id}
                    firstName={passengerObj?.first_name}
                    lastName={passengerObj?.last_name}
                    avatarUrl={passengerObj?.avatar_url}
                    rating={passengerObj?.rating}
                    size="small"
                    showRating
                    disabled
                  />
                );
              })()}
              <Text style={[styles.detailLabel, { color: '#3B82F6', fontWeight: '600' }]}>View Passenger</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.detailsGrid, { marginTop: 12 }]}>
            <View style={styles.detailItem}>
              <Ionicons name="cash-outline" size={20} color="#64748B" />
              <Text style={styles.detailLabel}>Max Price</Text>
              <Text style={styles.detailValue}>
                {request.max_price_per_seat ? `${request.max_price_per_seat} EUR` : 'Any'}
              </Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {request.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{request.notes}</Text>
          </View>
        )}

        {/* Offers Section - Only for request owner */}
        {isOwner && request.offers && request.offers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Driver Offers ({request.offers.filter((o: Offer) => o.status === 'pending').length} pending)
            </Text>
            {request.offers.map((offer: Offer) => {
              const driverObj = offer.driver || {};
              const totalPrice = (offer.price_per_seat || 0) * (request.seats_needed || 1);
              
              return (
                <View key={offer._id} style={styles.offerCard}>
                  <View style={styles.offerHeader}>
                    <TouchableOpacity 
                      style={styles.offerDriverInfo}
                      onPress={() => {
                        const driverId = driverObj._id || driverObj.id;
                        if (driverId) {
                          router.push({ pathname: "/user-profile/[id]", params: { id: driverId } });
                        }
                      }}
                    >
                      <ProfileAvatar
                        userId={driverObj._id || driverObj.id}
                        firstName={driverObj.first_name}
                        lastName={driverObj.last_name}
                        avatarUrl={driverObj.avatar_url}
                        rating={driverObj.rating}
                        size="small"
                        showRating
                        disabled
                      />
                      <View style={{ marginLeft: 10, flex: 1 }}>
                        <Text style={styles.offerDriverName}>
                          {driverObj.first_name || "Driver"} {driverObj.last_name || ""}
                        </Text>
                        {driverObj.rating && (
                          <Text style={styles.offerDriverRating}>
                            ★ {driverObj.rating.toFixed(1)}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                    
                    <View style={[
                      styles.offerStatusBadge,
                      offer.status === 'accepted' ? styles.statusAccepted :
                      offer.status === 'rejected' ? styles.statusRejected :
                      styles.statusPending
                    ]}>
                      <Text style={styles.offerStatusText}>
                        {offer.status === 'accepted' ? 'Accepted' : 
                         offer.status === 'rejected' ? 'Rejected' : 'Pending'}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.offerPriceRow}>
                    <View style={styles.offerPriceItem}>
                      <Text style={styles.offerPriceLabel}>Price per seat</Text>
                      <Text style={styles.offerPriceValue}>{offer.price_per_seat} EUR</Text>
                    </View>
                    <View style={styles.offerPriceItem}>
                      <Text style={styles.offerPriceLabel}>Total ({request.seats_needed} seats)</Text>
                      <Text style={[styles.offerPriceValue, { color: '#16A34A' }]}>{totalPrice} EUR</Text>
                    </View>
                  </View>
                  
                  {offer.message && (
                    <Text style={styles.offerMessage}>"{offer.message}"</Text>
                  )}
                  
                  {offer.status === 'pending' && (
                    <View style={styles.offerActions}>
                      <TouchableOpacity
                        style={[styles.offerActionBtn, styles.acceptBtn]}
                        onPress={() => handleOpenPaymentModal(offer)}
                      >
                        <Ionicons name="checkmark" size={18} color="#fff" />
                        <Text style={styles.offerActionBtnText}>Accept & Pay</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={[styles.offerActionBtn, styles.rejectBtn]}
                        onPress={() => handleRejectOffer(offer._id)}
                        disabled={rejectingOfferId === offer._id}
                      >
                        {rejectingOfferId === offer._id ? (
                          <ActivityIndicator size="small" color="#DC2626" />
                        ) : (
                          <>
                            <Ionicons name="close" size={18} color="#DC2626" />
                            <Text style={[styles.offerActionBtnText, { color: '#DC2626' }]}>Reject</Text>
                          </>
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

      {/* Footer Actions - Owner can modify/cancel */}
      {isOwner && request.status === 'pending' && (
        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.modifyButton}
            onPress={() => router.push({ pathname: "/(tabs)/requests/edit", params: { id } })}
          >
            <Ionicons name="create-outline" size={20} color="#007AFF" />
            <Text style={styles.modifyButtonText}>Modify</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.cancelButton}
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
        </View>
      )}

      {/* Offer a Ride button for non-owners */}
      {!isOwner && request.status === 'pending' && (
        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.offerRideButton}
            onPress={openOfferModal}
          >
            <Ionicons name="car" size={22} color="#fff" />
            <Text style={styles.offerRideButtonText}>Offer a Ride for This Request</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Offer Modal - Simple like booking modal */}
      <Modal
        visible={offerModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setOfferModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Offer a Ride</Text>

            <View style={styles.modalInfo}>
              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
                onPress={() => {
                  const passengerId = request.passenger?.id || request.passenger?._id;
                  if (passengerId) {
                    setOfferModalVisible(false);
                    router.push({ pathname: "/user-profile/[id]", params: { id: passengerId } });
                  }
                }}
                activeOpacity={0.7}
              >
                <ProfileAvatar
                  userId={request.passenger?.id || request.passenger?._id}
                  firstName={request.passenger?.first_name}
                  lastName={request.passenger?.last_name}
                  avatarUrl={request.passenger?.avatar_url}
                  rating={request.passenger?.rating}
                  size="small"
                  showRating
                  disabled
                />
                <View style={{ marginLeft: 10 }}>
                  <Text style={{ fontSize: 12, color: '#64748B' }}>Passenger</Text>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#1E293B' }}>
                    {request.passenger?.first_name} {request.passenger?.last_name}
                  </Text>
                </View>
              </TouchableOpacity>
              <Text style={styles.modalInfoText}>
                Seats needed: {request.seats_needed}
              </Text>
              {request.max_price_per_seat && (
                <Text style={styles.modalInfoText}>
                  Max budget: {request.max_price_per_seat} EUR/seat
                </Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Your Price per Seat (EUR)</Text>
              <TextInput
                style={styles.input}
                value={offerPrice}
                onChangeText={setOfferPrice}
                keyboardType="number-pad"
                placeholder={request.max_price_per_seat?.toString() || "50"}
              />
            </View>

            {offerPrice && request.seats_needed && (
              <Text style={styles.totalPrice}>
                Total: {(parseFloat(offerPrice) || 0) * request.seats_needed} EUR
              </Text>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setOfferModalVisible(false)}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, submittingOffer && { opacity: 0.7 }]}
                onPress={handleSubmitOffer}
                disabled={submittingOffer}
              >
                {submittingOffer ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalButtonConfirmText}>Send Offer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Payment Selection Modal for accepting offers */}
      <Modal
        visible={paymentModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => !processingPayment && setPaymentModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>💳 Select Payment Method</Text>

            {selectedOffer && (
              <View style={styles.modalInfo}>
                <View style={styles.paymentSummaryRow}>
                  <Text style={styles.paymentSummaryLabel}>Driver:</Text>
                  <Text style={styles.paymentSummaryValue}>
                    {selectedOffer.driver?.first_name} {selectedOffer.driver?.last_name}
                  </Text>
                </View>
                <View style={styles.paymentSummaryRow}>
                  <Text style={styles.paymentSummaryLabel}>Price per seat:</Text>
                  <Text style={styles.paymentSummaryValue}>{selectedOffer.price_per_seat} EUR</Text>
                </View>
                <View style={styles.paymentSummaryRow}>
                  <Text style={styles.paymentSummaryLabel}>Seats:</Text>
                  <Text style={styles.paymentSummaryValue}>{request?.seats_needed}</Text>
                </View>
                <View style={[styles.paymentSummaryRow, { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 10, marginTop: 6 }]}>
                  <Text style={[styles.paymentSummaryLabel, { fontWeight: '700' }]}>Total:</Text>
                  <Text style={[styles.paymentSummaryValue, { fontWeight: '700', color: '#16A34A', fontSize: 18 }]}>
                    {getTotalAmount()} EUR
                  </Text>
                </View>
              </View>
            )}

            {/* Payment Method Selection */}
            <View style={styles.paymentMethodSection}>
              {/* Wallet Payment Option */}
              <TouchableOpacity
                style={[
                  styles.paymentMethodOption,
                  paymentMethod === 'wallet' && styles.paymentMethodSelected,
                  (wallet?.balance || 0) < getTotalAmount() * 100 && styles.paymentMethodDisabled
                ]}
                onPress={() => {
                  if ((wallet?.balance || 0) >= getTotalAmount() * 100) {
                    setPaymentMethod('wallet');
                  }
                }}
                disabled={(wallet?.balance || 0) < getTotalAmount() * 100}
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
                  <Ionicons name="checkmark-circle" size={24} color="#16A34A" />
                )}
                {(wallet?.balance || 0) >= getTotalAmount() * 100 && (
                  <View style={styles.noFeeBadge}>
                    <Text style={styles.noFeeText}>No fees!</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Insufficient balance warning */}
              {(wallet?.balance || 0) < getTotalAmount() * 100 && (
                <Text style={styles.insufficientBalanceText}>
                  Insufficient wallet balance. Need €{getTotalAmount().toFixed(2)}
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
                      paymentMethod === 'card' && { color: '#3B82F6' }
                    ]}>
                      Credit/Debit Card
                    </Text>
                    <Text style={styles.paymentMethodBalance}>
                      Pay with Stripe
                    </Text>
                  </View>
                </View>
                {paymentMethod === 'card' && (
                  <Ionicons name="checkmark-circle" size={24} color="#3B82F6" />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setPaymentModalVisible(false)}
                disabled={processingPayment}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton, 
                  styles.modalButtonConfirm,
                  paymentMethod === 'wallet' && { backgroundColor: '#16A34A' }
                ]}
                onPress={handleConfirmPayment}
                disabled={processingPayment}
              >
                {processingPayment ? (
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
  errorText: {
    fontSize: 16,
    color: "#DC2626",
    textAlign: "center",
    marginTop: 20,
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
  notesText: {
    fontSize: 15,
    color: "#334155",
    lineHeight: 22,
  },
  footer: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    gap: 12,
  },
  modifyButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  modifyButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
    marginLeft: 8,
  },
  cancelButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF2F2",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#DC2626",
    marginLeft: 8,
  },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  mapLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    fontSize: 13,
    color: '#64748B',
  },
  offerRideButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#8B5CF6",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  offerRideButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "85%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
    textAlign: "center",
    marginBottom: 20,
  },
  modalInfo: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  modalInfoText: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 8,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#1F2937",
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: "700",
    color: "#8B5CF6",
    textAlign: "center",
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonCancel: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  modalButtonCancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748B",
  },
  modalButtonConfirm: {
    backgroundColor: "#8B5CF6",
  },
  modalButtonConfirmText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  offerSummary: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 10,
  },
  offerSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  offerSummaryText: {
    fontSize: 14,
    color: "#475569",
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#1F2937",
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  submitOfferButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#8B5CF6",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
    marginTop: 8,
  },
  submitOfferButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  // Offer Card Styles
  offerCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  offerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  offerDriverInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  offerDriverName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
  },
  offerDriverRating: {
    fontSize: 13,
    color: "#F59E0B",
    marginTop: 2,
  },
  offerStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPending: {
    backgroundColor: "#FEF3C7",
  },
  statusAccepted: {
    backgroundColor: "#DCFCE7",
  },
  statusRejected: {
    backgroundColor: "#FEE2E2",
  },
  offerStatusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  offerPriceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  offerPriceItem: {
    flex: 1,
  },
  offerPriceLabel: {
    fontSize: 12,
    color: "#64748B",
  },
  offerPriceValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginTop: 2,
  },
  offerMessage: {
    fontSize: 14,
    color: "#475569",
    fontStyle: "italic",
    marginBottom: 12,
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 8,
  },
  offerActions: {
    flexDirection: "row",
    gap: 10,
  },
  offerActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  acceptBtn: {
    backgroundColor: "#16A34A",
  },
  rejectBtn: {
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  offerActionBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  // Payment Method Styles
  paymentMethodSection: {
    marginBottom: 20,
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
  paymentSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  paymentSummaryLabel: {
    fontSize: 14,
    color: "#64748B",
  },
  paymentSummaryValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
  },
});