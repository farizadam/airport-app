import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRequestStore } from "@/store/requestStore";
import { useAuthStore } from "@/store/authStore";
import { RideRequest } from "@/types";
import LeafletMap from "@/components/LeafletMap";
import { toast } from "../../../src/store/toastStore";

export default function RequestDetailsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  // @ts-ignore
  const { fetchRequestById, cancelRequest } = useRequestStore();
  const { user } = useAuthStore();
  const [request, setRequest] = useState<RideRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);

  // Handle back navigation - just go back to previous screen
  const handleGoBack = () => {
    router.back();
  };

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
            toast.error("Error", "Failed to load request details");
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
    }, [id]),
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
              toast.success("Request Cancelled", "Request cancelled successfully");
              router.replace("/(tabs)/explore?tab=myrequests");
            } catch (error: any) {
              toast.error("Error", error.message || "Failed to cancel request");
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ],
    );
  };

  if (loading || !request) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const isOwner = request.passenger?._id === user?._id;
  const date = new Date(request.preferred_datetime);
  const airportName =
    typeof request.airport === "object" ? request.airport?.name : "Airport";
  const airportCoords =
    typeof request.airport === "object" &&
    "latitude" in request.airport &&
    "longitude" in request.airport &&
    typeof (request.airport as any).latitude === "number" &&
    typeof (request.airport as any).longitude === "number"
      ? {
          latitude: (request.airport as any).latitude as number,
          longitude: (request.airport as any).longitude as number,
          name: (request.airport as any).name as string,
        }
      : null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]} key={id}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Status Badge */}
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  request.status === "pending"
                    ? "#FEF3C7"
                    : request.status === "matched"
                      ? "#DCFCE7"
                      : "#F1F5F9",
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                {
                  color:
                    request.status === "pending"
                      ? "#D97706"
                      : request.status === "matched"
                        ? "#16A34A"
                        : "#64748B",
                },
              ]}
            >
              {request.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Route Info with Enhanced Display */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🛣️ Route</Text>

          {/* Enhanced Route Display */}
          <View style={styles.routeContainer}>
            {/* A - Start Point */}
            <View style={styles.enhancedRoutePoint}>
              <View style={styles.routePointLeftSide}>
                <View
                  style={[styles.routeMarker, { backgroundColor: "#3B82F6" }]}
                >
                  <Text style={styles.routeMarkerText}>A</Text>
                </View>
                <View style={styles.routeVerticalLine} />
              </View>
              <View style={styles.routePointDetails}>
                <Text style={styles.routePointLabel}>
                  {request.direction === "to_airport"
                    ? "PICKUP LOCATION"
                    : "DEPARTURE"}
                </Text>
                <Text style={styles.routePointAddress}>
                  {request.direction === "to_airport"
                    ? request.location_address ||
                      request.location_city ||
                      "Pickup Location"
                    : airportName || "Airport"}
                </Text>
              </View>
            </View>

            {/* B - Destination */}
            <View style={styles.enhancedRoutePoint}>
              <View style={styles.routePointLeftSide}>
                <View
                  style={[styles.routeMarker, { backgroundColor: "#EF4444" }]}
                >
                  <Text style={styles.routeMarkerText}>B</Text>
                </View>
              </View>
              <View style={styles.routePointDetails}>
                <Text style={styles.routePointLabel}>DESTINATION</Text>
                <Text style={styles.routePointAddress}>
                  {request.direction === "to_airport"
                    ? airportName || "Airport"
                    : request.location_address ||
                      request.location_city ||
                      "Dropoff Location"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Map Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 Map</Text>
          {request.location_latitude && request.location_longitude ? (
            <View style={styles.mapContainer}>
              <LeafletMap
                mode="view"
                initialRegion={{
                  latitude: request.location_latitude,
                  longitude: request.location_longitude,
                  zoom: 11,
                }}
                markers={[
                  {
                    id: "pickup",
                    latitude: request.location_latitude,
                    longitude: request.location_longitude,
                    title:
                      request.direction === "to_airport" ? "Pickup" : "Dropoff",
                    type: "request",
                  },
                  ...(airportCoords
                    ? [
                        {
                          id: "airport",
                          latitude: airportCoords.latitude,
                          longitude: airportCoords.longitude,
                          title: airportCoords.name || "Airport",
                          type: "airport" as const,
                        },
                      ]
                    : []),
                ]}
                routeCoordinates={
                  airportCoords
                    ? request.direction === "to_airport"
                      ? [
                          {
                            latitude: request.location_latitude,
                            longitude: request.location_longitude,
                          },
                          {
                            latitude: airportCoords.latitude,
                            longitude: airportCoords.longitude,
                          },
                        ]
                      : [
                          {
                            latitude: airportCoords.latitude,
                            longitude: airportCoords.longitude,
                          },
                          {
                            latitude: request.location_latitude,
                            longitude: request.location_longitude,
                          },
                        ]
                    : []
                }
              />
              <View style={styles.mapLegendOverlay}>
                <View style={styles.mapLegendRow}>
                  <View style={styles.legendDotItem}>
                    <View
                      style={[styles.legendDot, { backgroundColor: "#3B82F6" }]}
                    />
                    <Text style={styles.legendDotText}>
                      {request.direction === "to_airport"
                        ? "Pickup"
                        : "Airport"}
                    </Text>
                  </View>
                  <View style={styles.legendDotItem}>
                    <View
                      style={[styles.legendDot, { backgroundColor: "#EF4444" }]}
                    />
                    <Text style={styles.legendDotText}>
                      {request.direction === "to_airport"
                        ? "Airport"
                        : "Dropoff"}
                    </Text>
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
              {date.toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={20} color="#64748B" />
            <Text style={styles.infoText}>
              {date.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
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
            <View style={[styles.detailItem, { flex: 1.5 }]}>
              <Ionicons name="briefcase-outline" size={20} color="#64748B" />
              <Text style={styles.detailLabel}>Luggage</Text>
              {(request.luggage && request.luggage.filter(l => l.quantity > 0).length > 0) ? (
                <View style={styles.luggageTagRow}>
                  {request.luggage.filter(l => l.quantity > 0).map((l, i) => {
                    const icons: Record<string, string> = { sac: '🎒', '10kg': '🧳', '20kg': '💼', hors_norme: '📦' };
                    return (
                      <View key={i} style={styles.luggageTag}>
                        <Text style={styles.luggageTagText}>{icons[l.type] || '🧳'} {l.quantity}× {l.type}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.detailValue}>None</Text>
              )}
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="cash-outline" size={20} color="#64748B" />
              <Text style={styles.detailLabel}>Max Price</Text>
              <Text style={styles.detailValue}>
                {request.max_price_per_seat
                  ? `${request.max_price_per_seat} EUR`
                  : "Any"}
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

      {/* Footer Actions */}
      {isOwner && request.status === "pending" && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.modifyButton}
            onPress={() =>
              router.push({ pathname: "/(tabs)/requests/edit", params: { id } })
            }
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
                <Ionicons
                  name="close-circle-outline"
                  size={20}
                  color="#DC2626"
                />
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Offer a Ride button for non-owners */}
      {!isOwner && request.status === "pending" && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.offerRideButton}
            onPress={() =>
              router.push({
                pathname: "/request-details/[id]",
                params: { id },
              })
            }
          >
            <Ionicons name="car" size={20} color="#fff" />
            <Text style={styles.offerRideButtonText}>Offer a Ride</Text>
          </TouchableOpacity>
        </View>
      )}
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
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#F1F5F9",
    position: "relative",
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
  offerRideButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#8B5CF6",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  offerRideButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  luggageTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
    justifyContent: 'center',
  },
  luggageTag: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  luggageTagText: {
    fontSize: 12,
    color: '#1D4ED8',
    fontWeight: '600',
  },
});
