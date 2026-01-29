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
import { RideRequest } from "@/types";
import LeafletMap from "@/components/LeafletMap";

export default function RequestDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  // @ts-ignore
  const { fetchRequestById, cancelRequest, makeOffer } = useRequestStore();
  const { user } = useAuthStore();
  const [request, setRequest] = useState<RideRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  
  // Offer modal state
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [offerPrice, setOfferPrice] = useState("");
  const [submittingOffer, setSubmittingOffer] = useState(false);

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
    <SafeAreaView style={styles.container} edges={['top']} key={id}>
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
          <View style={styles.routeContainer}>
            {/* Start / Origin */}
            <View style={styles.routeRow}>
              <Ionicons 
                name={request.direction === 'to_airport' ? "location" : "airplane"} 
                size={16} 
                color={request.direction === 'to_airport' ? "#EF4444" : "#007AFF"} 
                style={{ marginRight: 8, width: 20, textAlign: 'center' }}
              />
              <Text style={styles.routeText}>
                {request.direction === 'to_airport' 
                  ? (request.location_address || request.location_city || "Pickup Location")
                  : (airportName || "Airport")}
              </Text>
            </View>
            <View style={{ width: 20, alignItems: 'center', marginVertical: 4 }}>
              <View style={{ width: 2, height: 24, backgroundColor: '#CBD5E1' }} />
              <Ionicons name="chevron-down" size={16} color="#CBD5E1" style={{ marginTop: -4 }} />
            </View>
            {/* End / Destination */}
            <View style={styles.routeRow}>
              <Ionicons 
                name={request.direction === 'to_airport' ? "airplane" : "location"} 
                size={16} 
                color={request.direction === 'to_airport' ? "#007AFF" : "#EF4444"} 
                style={{ marginRight: 8, width: 20, textAlign: 'center' }}
              />
              <Text style={styles.routeText}>
                {request.direction === 'to_airport'
                  ? (airportName || "Airport")
                  : (request.location_address || request.location_city || "Dropoff Location")}
              </Text>
            </View>
          </View>
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
              {date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
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
            <View style={styles.detailItem}>
              <Ionicons name="cash-outline" size={20} color="#64748B" />
              <Text style={styles.detailLabel}>Max Price</Text>
              <Text style={styles.detailValue}>
                {request.max_price_per_seat ? `${request.max_price_per_seat} MAD` : 'Any'}
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
              <Text style={styles.modalInfoText}>
                Passenger: {request.passenger?.first_name} {request.passenger?.last_name}
              </Text>
              <Text style={styles.modalInfoText}>
                Seats needed: {request.seats_needed}
              </Text>
              {request.max_price_per_seat && (
                <Text style={styles.modalInfoText}>
                  Max budget: {request.max_price_per_seat} MAD/seat
                </Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Your Price per Seat (MAD)</Text>
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
                Total: {(parseFloat(offerPrice) || 0) * request.seats_needed} MAD
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
});