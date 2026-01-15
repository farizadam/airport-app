import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { WebView } from "react-native-webview";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useRequestStore } from "../../../src/store/requestStore";
import { useAuthStore } from "../../../src/store/authStore";

const STATUS_COLORS: Record<string, string> = {
  pending: "#ffc107",
  matched: "#17a2b8",
  accepted: "#28a745",
  cancelled: "#dc3545",
  expired: "#6c757d",
};

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    currentRequest,
    getRequest,
    acceptOffer,
    rejectOffer,
    cancelRequest,
    makeOffer,
    loading,
  } = useRequestStore();
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerPrice, setOfferPrice] = useState("");
  const [offerMessage, setOfferMessage] = useState("");
  const [submittingOffer, setSubmittingOffer] = useState(false);

  useEffect(() => {
    if (id) {
      getRequest(id);
    }
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (id) await getRequest(id);
    setRefreshing(false);
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return (
      date.toLocaleDateString() +
      " at " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  };

  const handleAcceptOffer = (offerId: string, driverName: string) => {
    Alert.alert(
      "Accept Offer",
      `Accept offer from ${driverName}? This will notify the driver and reject other offers.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept",
          onPress: async () => {
            try {
              await acceptOffer(id!, offerId);
              Alert.alert(
                "Success",
                "Offer accepted! The driver has been notified."
              );
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
          },
        },
      ]
    );
  };

  const handleRejectOffer = (offerId: string) => {
    Alert.alert("Reject Offer", "Are you sure you want to reject this offer?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: async () => {
          try {
            await rejectOffer(id!, offerId);
          } catch (err: any) {
            Alert.alert("Error", err.message);
          }
        },
      },
    ]);
  };

  const handleMakeOffer = async () => {
    if (!offerPrice || parseFloat(offerPrice) <= 0) {
      Alert.alert("Error", "Please enter a valid price");
      return;
    }

    setSubmittingOffer(true);
    try {
      await makeOffer(id!, {
        price_per_seat: parseFloat(offerPrice),
        message: offerMessage || undefined,
      });
      setShowOfferModal(false);
      setOfferPrice("");
      setOfferMessage("");
      Alert.alert("Success", "Your offer has been sent to the passenger!");
      // Refresh to show the updated state
      await getRequest(id!);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSubmittingOffer(false);
    }
  };

  const handleCancelRequest = () => {
    Alert.alert(
      "Cancel Request",
      "Are you sure you want to cancel this ride request?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelRequest(id!);
              Alert.alert("Cancelled", "Your request has been cancelled.");
              router.back();
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
          },
        },
      ]
    );
  };

  if (loading && !currentRequest) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!currentRequest) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Request not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOwner =
    currentRequest.passenger?._id === user?._id ||
    (currentRequest.passenger as any)?.id === user?.id;

  // Check if current user is a driver who made an offer
  const myOffer = currentRequest.offers?.find(
    (o: any) =>
      o.driver?._id === user?._id ||
      o.driver?.id === user?.id ||
      o.driver?._id === user?.id ||
      o.driver?.id === user?._id
  );
  const hasAlreadyOffered = !!myOffer;
  const isMatchedDriver =
    currentRequest.matched_driver?._id === user?._id ||
    (currentRequest.matched_driver as any)?.id === user?.id;

  // Check if user can make an offer (anyone who hasn't offered yet)
  const canMakeOffer =
    !isOwner &&
    !hasAlreadyOffered &&
    currentRequest.status === "pending";

  const hasOffers = currentRequest.offers && currentRequest.offers.length > 0;
  const pendingOffers =
    currentRequest.offers?.filter((o: any) => o.status === "pending") || [];

  // Map HTML
  const mapHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        * { margin: 0; padding: 0; }
        html, body, #map { width: 100%; height: 100%; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map').setView([${currentRequest.location_latitude}, ${
    currentRequest.location_longitude
  }], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: ''
        }).addTo(map);
        L.marker([${currentRequest.location_latitude}, ${
    currentRequest.location_longitude
  }])
          .addTo(map)
          .bindPopup('${
            currentRequest.direction === "to_airport" ? "Pickup" : "Dropoff"
          } Location')
          .openPopup();
      </script>
    </body>
    </html>
  `;

  const openInMaps = () => {
    const lat = currentRequest.location_latitude;
    const lng = currentRequest.location_longitude;
    const label = encodeURIComponent(
      currentRequest.location_address || "Location"
    );
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    Linking.openURL(url);
  };

  const callPassenger = () => {
    if (currentRequest.passenger?.phone) {
      Linking.openURL(`tel:${currentRequest.passenger.phone}`);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Request Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Status Banner */}
        <View
          style={[
            styles.statusBanner,
            {
              backgroundColor:
                hasAlreadyOffered && myOffer?.status === "rejected"
                  ? "#dc3545" // Red for rejected driver
                  : hasAlreadyOffered && myOffer?.status === "pending"
                  ? "#ffc107" // Yellow for pending offer
                  : hasAlreadyOffered && isMatchedDriver
                  ? "#28a745" // Green for accepted
                  : STATUS_COLORS[currentRequest.status],
            },
          ]}
        >
          <Ionicons
            name={
              hasAlreadyOffered && myOffer?.status === "rejected"
                ? "close-circle"
                : hasAlreadyOffered && myOffer?.status === "pending"
                ? "time"
                : hasAlreadyOffered && isMatchedDriver
                ? "checkmark-circle"
                : currentRequest.status === "accepted"
                ? "checkmark-circle"
                : currentRequest.status === "cancelled"
                ? "close-circle"
                : "time"
            }
            size={20}
            color="#fff"
          />
          <Text style={styles.statusBannerText}>
            {/* Driver-specific messages */}
            {hasAlreadyOffered && myOffer?.status === "rejected"
              ? "Your offer was not selected"
              : hasAlreadyOffered && isMatchedDriver
              ? "Your offer was accepted!"
              : hasAlreadyOffered && myOffer?.status === "pending"
              ? "Waiting for passenger response"
              : /* Driver who can make offer */
              canMakeOffer
              ? "This request is open for offers"
              : /* Owner (passenger) messages */
              isOwner && currentRequest.status === "pending" && hasOffers
              ? `${pendingOffers.length} offer(s) waiting for your response`
              : isOwner && currentRequest.status === "pending"
              ? "Waiting for driver offers"
              : currentRequest.status === "accepted"
              ? "Request accepted - ride confirmed!"
              : currentRequest.status.charAt(0).toUpperCase() +
                currentRequest.status.slice(1)}
          </Text>
        </View>

        {/* Route Info */}
        <View style={styles.card}>
          {/* Route Summary */}
          <View style={styles.routeSummary}>
            <View style={styles.routeEndpoint}>
              <Ionicons
                name={
                  currentRequest.direction === "to_airport"
                    ? "location"
                    : "airplane"
                }
                size={20}
                color={
                  currentRequest.direction === "to_airport"
                    ? "#28a745"
                    : "#007AFF"
                }
              />
              <Text style={styles.routeEndpointText} numberOfLines={1}>
                {currentRequest.direction === "to_airport"
                  ? currentRequest.location_city || "Pickup"
                  : currentRequest.airport?.iata_code}
              </Text>
            </View>
            <View style={styles.routeArrow}>
              <Ionicons name="arrow-forward" size={18} color="#999" />
            </View>
            <View style={styles.routeEndpoint}>
              <Ionicons
                name={
                  currentRequest.direction === "to_airport"
                    ? "airplane"
                    : "location"
                }
                size={20}
                color={
                  currentRequest.direction === "to_airport"
                    ? "#007AFF"
                    : "#28a745"
                }
              />
              <Text style={styles.routeEndpointText} numberOfLines={1}>
                {currentRequest.direction === "to_airport"
                  ? currentRequest.airport?.iata_code
                  : currentRequest.location_city || "Dropoff"}
              </Text>
            </View>
          </View>

          {/* Direction Badge */}
          <View style={styles.directionBadge}>
            <Text style={styles.directionBadgeText}>
              {currentRequest.direction === "to_airport"
                ? "To Airport"
                : "From Airport"}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Location Details */}
          <View style={styles.locationSection}>
            <Text style={styles.locationSectionTitle}>
              {currentRequest.direction === "to_airport"
                ? "Pickup Location"
                : "Dropoff Location"}
            </Text>
            <Text style={styles.locationAddress}>
              {currentRequest.location_address}
            </Text>
            <Text style={styles.airportName}>
              {currentRequest.airport?.name}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Ionicons name="calendar" size={18} color="#666" />
              <Text style={styles.detailLabel}>Date & Time</Text>
              <Text style={styles.detailValue}>
                {formatDateTime(currentRequest.preferred_datetime)}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="time" size={18} color="#666" />
              <Text style={styles.detailLabel}>Flexibility</Text>
              <Text style={styles.detailValue}>
                ±{currentRequest.time_flexibility} min
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="people" size={18} color="#666" />
              <Text style={styles.detailLabel}>Seats</Text>
              <Text style={styles.detailValue}>
                {currentRequest.seats_needed}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="briefcase" size={18} color="#666" />
              <Text style={styles.detailLabel}>Luggage</Text>
              <Text style={styles.detailValue}>
                {currentRequest.luggage_count}
              </Text>
            </View>
          </View>

          {currentRequest.max_price_per_seat && (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Max Price:</Text>
              <Text style={styles.priceValue}>
                {currentRequest.max_price_per_seat} MAD/seat
              </Text>
            </View>
          )}

          {currentRequest.notes && (
            <View style={styles.notesContainer}>
              <Text style={styles.notesLabel}>Notes:</Text>
              <Text style={styles.notesText}>{currentRequest.notes}</Text>
            </View>
          )}
        </View>

        {/* Map Section */}
        <View style={styles.card}>
          <View style={styles.mapHeader}>
            <Text style={styles.sectionTitle}>
              {currentRequest.direction === "to_airport" ? "Pickup" : "Dropoff"}{" "}
              Location
            </Text>
            <TouchableOpacity
              style={styles.openMapsButton}
              onPress={openInMaps}
            >
              <Ionicons name="navigate" size={16} color="#007AFF" />
              <Text style={styles.openMapsText}>Open in Maps</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.mapContainer}>
            <WebView
              source={{ html: mapHTML }}
              style={styles.map}
              scrollEnabled={false}
              javaScriptEnabled={true}
            />
          </View>
          <Text style={styles.mapAddress}>
            {currentRequest.location_address}
          </Text>
        </View>

        {/* Driver's Own Offer Section (for drivers viewing their offer) */}
        {hasAlreadyOffered && !isOwner && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Your Offer</Text>
            <View
              style={[
                styles.myOfferBox,
                {
                  backgroundColor:
                    myOffer.status === "accepted"
                      ? "#d4edda"
                      : myOffer.status === "rejected"
                      ? "#f8d7da"
                      : "#fff3cd",
                },
              ]}
            >
              <View style={styles.myOfferHeader}>
                <View>
                  <Text style={styles.myOfferPrice}>
                    {myOffer.price_per_seat} MAD/seat
                  </Text>
                  <Text style={styles.myOfferTotal}>
                    Total:{" "}
                    {myOffer.price_per_seat * currentRequest.seats_needed} MAD
                  </Text>
                </View>
                <View
                  style={[
                    styles.myOfferStatus,
                    {
                      backgroundColor:
                        myOffer.status === "accepted"
                          ? "#28a745"
                          : myOffer.status === "rejected"
                          ? "#dc3545"
                          : "#ffc107",
                    },
                  ]}
                >
                  <Text style={styles.myOfferStatusText}>
                    {myOffer.status.charAt(0).toUpperCase() +
                      myOffer.status.slice(1)}
                  </Text>
                </View>
              </View>
              {myOffer.message && (
                <Text style={styles.myOfferMessage}>"{myOffer.message}"</Text>
              )}
            </View>
          </View>
        )}

        {/* Passenger Info (for drivers) */}
        {hasAlreadyOffered && !isOwner && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Passenger</Text>
            <View style={styles.driverInfo}>
              <View style={styles.driverAvatar}>
                <Ionicons name="person" size={24} color="#fff" />
              </View>
              <View style={styles.driverDetails}>
                <Text style={styles.driverName}>
                  {currentRequest.passenger?.first_name}{" "}
                  {currentRequest.passenger?.last_name}
                </Text>
                {currentRequest.passenger?.rating && (
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={14} color="#ffc107" />
                    <Text style={styles.ratingText}>
                      {currentRequest.passenger.rating.toFixed(1)}
                    </Text>
                  </View>
                )}
              </View>
              {(isMatchedDriver || myOffer?.status === "accepted") &&
                currentRequest.passenger?.phone && (
                  <TouchableOpacity
                    style={styles.callButton}
                    onPress={callPassenger}
                  >
                    <Ionicons name="call" size={20} color="#28a745" />
                  </TouchableOpacity>
                )}
            </View>
            {(isMatchedDriver || myOffer?.status === "accepted") &&
              currentRequest.passenger?.phone && (
                <View style={styles.contactInfo}>
                  <Ionicons name="call-outline" size={16} color="#28a745" />
                  <Text style={styles.contactText}>
                    {currentRequest.passenger.phone}
                  </Text>
                </View>
              )}
          </View>
        )}

        {/* Accepted Driver Info (for passenger) */}
        {isOwner &&
          currentRequest.status === "accepted" &&
          currentRequest.matched_driver && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Your Driver</Text>
              <View style={styles.driverInfo}>
                <View style={styles.driverAvatar}>
                  <Ionicons name="person" size={24} color="#fff" />
                </View>
                <View style={styles.driverDetails}>
                  <Text style={styles.driverName}>
                    {currentRequest.matched_driver.first_name}{" "}
                    {currentRequest.matched_driver.last_name}
                  </Text>
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={14} color="#ffc107" />
                    <Text style={styles.ratingText}>
                      {currentRequest.matched_driver.rating?.toFixed(1) ||
                        "New"}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.callButton}>
                  <Ionicons name="call" size={20} color="#28a745" />
                </TouchableOpacity>
              </View>
            </View>
          )}

        {/* Offers Section */}
        {isOwner && hasOffers && currentRequest.status === "pending" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Driver Offers ({pendingOffers.length})
            </Text>
            {currentRequest.offers.map((offer: any) => (
              <View
                key={offer._id}
                style={[
                  styles.offerCard,
                  offer.status !== "pending" && styles.offerCardInactive,
                ]}
              >
                <View style={styles.offerHeader}>
                  <View style={styles.driverAvatar}>
                    <Ionicons name="person" size={20} color="#fff" />
                  </View>
                  <View style={styles.offerDriverInfo}>
                    <Text style={styles.offerDriverName}>
                      {offer.driver?.first_name} {offer.driver?.last_name}
                    </Text>
                    <View style={styles.ratingRow}>
                      <Ionicons name="star" size={12} color="#ffc107" />
                      <Text style={styles.smallRating}>
                        {offer.driver?.rating?.toFixed(1) || "New"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.offerPrice}>
                    <Text style={styles.offerPriceValue}>
                      {offer.price_per_seat}
                    </Text>
                    <Text style={styles.offerPriceUnit}>MAD/seat</Text>
                  </View>
                </View>

                {offer.message && (
                  <Text style={styles.offerMessage}>"{offer.message}"</Text>
                )}

                {offer.status === "pending" && (
                  <View style={styles.offerActions}>
                    <TouchableOpacity
                      style={styles.rejectButton}
                      onPress={() => handleRejectOffer(offer._id)}
                    >
                      <Text style={styles.rejectButtonText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.acceptButton}
                      onPress={() =>
                        handleAcceptOffer(
                          offer._id,
                          `${offer.driver?.first_name}`
                        )
                      }
                    >
                      <Ionicons name="checkmark" size={18} color="#fff" />
                      <Text style={styles.acceptButtonText}>Accept</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {offer.status !== "pending" && (
                  <View
                    style={[
                      styles.offerStatusBadge,
                      {
                        backgroundColor:
                          offer.status === "accepted" ? "#28a745" : "#dc3545",
                      },
                    ]}
                  >
                    <Text style={styles.offerStatusText}>
                      {offer.status.charAt(0).toUpperCase() +
                        offer.status.slice(1)}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Cancel Button */}
        {isOwner && currentRequest.status === "pending" && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelRequest}
          >
            <Ionicons name="close-circle" size={20} color="#dc3545" />
            <Text style={styles.cancelButtonText}>Cancel Request</Text>
          </TouchableOpacity>
        )}

        {/* Make Offer Button (for anyone who hasn't offered yet) */}
        {canMakeOffer && (
          <TouchableOpacity
            style={styles.makeOfferButton}
            onPress={() => setShowOfferModal(true)}
          >
            <Ionicons name="cash" size={20} color="#fff" />
            <Text style={styles.makeOfferButtonText}>Make an Offer</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Make Offer Modal */}
      <Modal
        visible={showOfferModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowOfferModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.offerModalContent}>
            <View style={styles.offerModalHeader}>
              <Text style={styles.offerModalTitle}>Make an Offer</Text>
              <TouchableOpacity onPress={() => setShowOfferModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.offerModalBody}>
              {/* Request Summary */}
              <View style={styles.offerRequestSummary}>
                <Text style={styles.offerSummaryRoute}>
                  {currentRequest.direction === "to_airport"
                    ? `${currentRequest.location_city} → ${
                        currentRequest.airport?.name ||
                        currentRequest.airport?.iata_code
                      }`
                    : `${
                        currentRequest.airport?.name ||
                        currentRequest.airport?.iata_code
                      } → ${currentRequest.location_city}`}
                </Text>
                <Text style={styles.offerSummaryDetails}>
                  {currentRequest.seats_needed} seat(s) •{" "}
                  {formatDateTime(currentRequest.preferred_datetime)}
                </Text>
                {currentRequest.max_price_per_seat && (
                  <Text style={styles.offerSummaryMaxPrice}>
                    Max budget: {currentRequest.max_price_per_seat} MAD/seat
                  </Text>
                )}
              </View>

              {/* Price Input */}
              <Text style={styles.offerInputLabel}>
                Your Price (per seat) *
              </Text>
              <View style={styles.offerPriceInputContainer}>
                <TextInput
                  style={styles.offerPriceInput}
                  placeholder="e.g., 100"
                  keyboardType="numeric"
                  value={offerPrice}
                  onChangeText={setOfferPrice}
                />
                <Text style={styles.offerPriceCurrency}>MAD</Text>
              </View>
              {offerPrice && currentRequest.seats_needed > 0 && (
                <Text style={styles.offerTotalText}>
                  Total: {parseFloat(offerPrice) * currentRequest.seats_needed}{" "}
                  MAD
                </Text>
              )}

              {/* Message Input */}
              <Text style={styles.offerInputLabel}>Message (optional)</Text>
              <TextInput
                style={styles.offerMessageInput}
                placeholder="Add a message to the passenger..."
                multiline
                numberOfLines={3}
                value={offerMessage}
                onChangeText={setOfferMessage}
              />

              {/* Submit Button */}
              <TouchableOpacity
                style={[
                  styles.submitOfferButton,
                  submittingOffer && styles.submitOfferButtonDisabled,
                ]}
                onPress={handleMakeOffer}
                disabled={submittingOffer}
              >
                {submittingOffer ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send" size={18} color="#fff" />
                    <Text style={styles.submitOfferButtonText}>Send Offer</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    color: "#666",
    marginBottom: 16,
  },
  backLink: {
    fontSize: 14,
    color: "#007AFF",
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
    margin: 16,
    borderRadius: 10,
  },
  statusBannerText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#fff",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    overflow: "hidden",
    zIndex: 0,
  },
  routeSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8f9fa",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  routeEndpoint: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  routeEndpointText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  routeArrow: {
    paddingHorizontal: 8,
  },
  directionBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#e8f4ff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  directionBadgeText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#007AFF",
  },
  locationSection: {
    marginBottom: 4,
  },
  locationSectionTitle: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 4,
  },
  airportName: {
    fontSize: 13,
    color: "#007AFF",
  },
  divider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginVertical: 16,
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  detailItem: {
    width: "45%",
    alignItems: "flex-start",
    gap: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: "#666",
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  priceLabel: {
    fontSize: 14,
    color: "#666",
  },
  priceValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#28a745",
  },
  notesContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  notesLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: "#333",
    fontStyle: "italic",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 16,
  },
  driverInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  ratingText: {
    fontSize: 13,
    color: "#666",
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#e8f5e9",
    justifyContent: "center",
    alignItems: "center",
  },
  offerCard: {
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  offerCardInactive: {
    opacity: 0.6,
  },
  offerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  offerDriverInfo: {
    flex: 1,
  },
  offerDriverName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  smallRating: {
    fontSize: 12,
    color: "#666",
  },
  offerPrice: {
    alignItems: "flex-end",
  },
  offerPriceValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#28a745",
  },
  offerPriceUnit: {
    fontSize: 11,
    color: "#666",
  },
  offerMessage: {
    fontSize: 13,
    color: "#666",
    fontStyle: "italic",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  offerActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  rejectButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dc3545",
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#dc3545",
  },
  acceptButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#28a745",
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  offerStatusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 10,
  },
  offerStatusText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#fff",
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dc3545",
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#dc3545",
  },
  // Map styles
  mapHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  openMapsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  openMapsText: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "500",
  },
  mapContainer: {
    height: 180,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
  },
  map: {
    flex: 1,
  },
  mapAddress: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
  },
  // Driver's offer styles
  myOfferBox: {
    padding: 16,
    borderRadius: 10,
  },
  myOfferHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  myOfferPrice: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
  },
  myOfferTotal: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  myOfferStatus: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  myOfferStatusText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
  myOfferMessage: {
    fontSize: 14,
    color: "#555",
    fontStyle: "italic",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  // Contact info
  contactInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  contactText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#28a745",
  },
  // Make Offer Button
  makeOfferButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#28a745",
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
  },
  makeOfferButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  // Make Offer Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  offerModalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
  },
  offerModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  offerModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  offerModalBody: {
    padding: 16,
  },
  offerRequestSummary: {
    backgroundColor: "#f8f9fa",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  offerSummaryRoute: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  offerSummaryDetails: {
    fontSize: 14,
    color: "#666",
  },
  offerSummaryMaxPrice: {
    fontSize: 14,
    fontWeight: "500",
    color: "#28a745",
    marginTop: 8,
  },
  offerInputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  offerPriceInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  offerPriceInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: "600",
  },
  offerPriceCurrency: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  offerTotalText: {
    fontSize: 14,
    color: "#28a745",
    fontWeight: "500",
    marginBottom: 16,
  },
  offerMessageInput: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    padding: 14,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  submitOfferButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#28a745",
    padding: 16,
    borderRadius: 12,
    marginBottom: 30,
  },
  submitOfferButtonDisabled: {
    backgroundColor: "#aaa",
  },
  submitOfferButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
