import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRequestStore } from "../../src/store/requestStore";
import { useAirportStore } from "../../src/store/airportStore";

export default function AvailableRequestsScreen() {
  const router = useRouter();
  const { availableRequests, getAvailableRequests, makeOffer, loading } =
    useRequestStore();
  const { airports, fetchAirports } = useAirportStore();

  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState({
    airport_id: "",
    direction: "",
    date: "",
    city: "",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [filterDate, setFilterDate] = useState<Date | null>(null);

  // Offer modal state
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [offerPrice, setOfferPrice] = useState("");
  const [offerMessage, setOfferMessage] = useState("");
  const [submittingOffer, setSubmittingOffer] = useState(false);

  useEffect(() => {
    fetchAirports();
    loadRequests();
  }, []);

  const loadRequests = async () => {
    await getAvailableRequests(filters);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  };

  const applyFilters = () => {
    const newFilters = {
      ...filters,
      date: filterDate ? filterDate.toISOString().split("T")[0] : "",
    };
    setFilters(newFilters);
    getAvailableRequests(newFilters);
    setShowFilters(false);
  };

  const clearFilters = () => {
    setFilters({ airport_id: "", direction: "", date: "", city: "" });
    setFilterDate(null);
    getAvailableRequests({});
    setShowFilters(false);
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return (
      date.toLocaleDateString() +
      " at " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  };

  const openOfferModal = (request: any) => {
    setSelectedRequest(request);
    setOfferPrice(request.max_price_per_seat?.toString() || "");
    setOfferMessage("");
    setOfferModalVisible(true);
  };

  const handleSubmitOffer = async () => {
    if (!offerPrice || parseFloat(offerPrice) <= 0) {
      Alert.alert("Error", "Please enter a valid price");
      return;
    }

    setSubmittingOffer(true);
    try {
      await makeOffer(selectedRequest._id, {
        price_per_seat: parseFloat(offerPrice),
        message: offerMessage || undefined,
      });
      Alert.alert("Success", "Your offer has been sent to the passenger!");
      setOfferModalVisible(false);
      loadRequests();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSubmittingOffer(false);
    }
  };

  const renderRequest = ({ item }: any) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.airportBadge}>
          <Text style={styles.airportCode}>{item.airport?.code}</Text>
        </View>
        <View style={styles.seatsInfo}>
          <Ionicons name="people" size={16} color="#666" />
          <Text style={styles.seatsText}>{item.seats_needed} seat(s)</Text>
        </View>
      </View>

      <View style={styles.passengerRow}>
        <View style={styles.passengerAvatar}>
          <Ionicons name="person" size={16} color="#fff" />
        </View>
        <View style={styles.passengerInfo}>
          <Text style={styles.passengerName}>
            {item.passenger?.first_name} {item.passenger?.last_name}
          </Text>
          {item.passenger?.rating && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={12} color="#ffc107" />
              <Text style={styles.ratingText}>
                {item.passenger.rating.toFixed(1)}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.routeContainer}>
        <Ionicons
          name={item.direction === "to_airport" ? "car" : "airplane"}
          size={16}
          color="#28a745"
        />
        <Text style={styles.routeText}>
          {item.direction === "to_airport"
            ? `${item.location_city || "Location"} → ${item.airport?.code}`
            : `${item.airport?.code} → ${item.location_city || "Location"}`}
        </Text>
      </View>

      <Text style={styles.addressText} numberOfLines={2}>
        {item.location_address}
      </Text>

      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Ionicons name="calendar-outline" size={14} color="#666" />
          <Text style={styles.detailText}>
            {formatDateTime(item.preferred_datetime)}
          </Text>
        </View>
      </View>

      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Ionicons name="time-outline" size={14} color="#666" />
          <Text style={styles.detailText}>
            ±{item.time_flexibility} min flexibility
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="briefcase-outline" size={14} color="#666" />
          <Text style={styles.detailText}>{item.luggage_count} luggage</Text>
        </View>
      </View>

      {item.max_price_per_seat && (
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Budget:</Text>
          <Text style={styles.priceValue}>
            up to {item.max_price_per_seat} MAD/seat
          </Text>
        </View>
      )}

      {item.notes && (
        <Text style={styles.notesText} numberOfLines={2}>
          "{item.notes}"
        </Text>
      )}

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.viewButton}
          onPress={() => router.push(`/requests/${item._id}`)}
        >
          <Text style={styles.viewButtonText}>View Details</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.offerButton}
          onPress={() => openOfferModal(item)}
        >
          <Ionicons name="hand-left" size={18} color="#fff" />
          <Text style={styles.offerButtonText}>Make Offer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Passenger Requests</Text>
        <TouchableOpacity
          onPress={() => setShowFilters(true)}
          style={styles.filterButton}
        >
          <Ionicons name="filter" size={22} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>
        Passengers looking for rides - make them an offer!
      </Text>

      {loading && availableRequests.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : availableRequests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No requests found</Text>
          <Text style={styles.emptySubtext}>
            Try adjusting your filters or check back later
          </Text>
        </View>
      ) : (
        <FlatList
          data={availableRequests}
          keyExtractor={(item) => item._id}
          renderItem={renderRequest}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      {/* Filter Modal */}
      <Modal visible={showFilters} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Requests</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <Text style={styles.filterLabel}>Airport</Text>
            <View style={styles.airportGrid}>
              <TouchableOpacity
                style={[
                  styles.airportChip,
                  !filters.airport_id && styles.airportChipActive,
                ]}
                onPress={() => setFilters({ ...filters, airport_id: "" })}
              >
                <Text
                  style={[
                    styles.airportChipText,
                    !filters.airport_id && styles.airportChipTextActive,
                  ]}
                >
                  All
                </Text>
              </TouchableOpacity>
              {airports.map((airport) => (
                <TouchableOpacity
                  key={airport._id}
                  style={[
                    styles.airportChip,
                    filters.airport_id === airport._id &&
                      styles.airportChipActive,
                  ]}
                  onPress={() =>
                    setFilters({ ...filters, airport_id: airport._id })
                  }
                >
                  <Text
                    style={[
                      styles.airportChipText,
                      filters.airport_id === airport._id &&
                        styles.airportChipTextActive,
                    ]}
                  >
                    {airport.code}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterLabel}>Direction</Text>
            <View style={styles.directionRow}>
              {[
                { label: "All", value: "" },
                { label: "To Airport", value: "to_airport" },
                { label: "From Airport", value: "from_airport" },
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.directionChip,
                    filters.direction === option.value &&
                      styles.directionChipActive,
                  ]}
                  onPress={() =>
                    setFilters({ ...filters, direction: option.value })
                  }
                >
                  <Text
                    style={[
                      styles.directionChipText,
                      filters.direction === option.value &&
                        styles.directionChipTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterLabel}>Date</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar" size={18} color="#666" />
              <Text style={styles.dateButtonText}>
                {filterDate ? filterDate.toLocaleDateString() : "Any date"}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={filterDate || new Date()}
                mode="date"
                minimumDate={new Date()}
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date) setFilterDate(date);
                }}
              />
            )}

            <Text style={styles.filterLabel}>City</Text>
            <TextInput
              style={styles.cityInput}
              placeholder="e.g., Casablanca"
              value={filters.city}
              onChangeText={(text) => setFilters({ ...filters, city: text })}
            />

            <View style={styles.filterActions}>
              <TouchableOpacity
                style={styles.clearButton}
                onPress={clearFilters}
              >
                <Text style={styles.clearButtonText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={applyFilters}
              >
                <Text style={styles.applyButtonText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Offer Modal */}
      <Modal visible={offerModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Make an Offer</Text>
              <TouchableOpacity onPress={() => setOfferModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {selectedRequest && (
              <>
                <View style={styles.offerRequestInfo}>
                  <Text style={styles.offerRequestRoute}>
                    {selectedRequest.direction === "to_airport"
                      ? `${selectedRequest.location_city} → ${selectedRequest.airport?.code}`
                      : `${selectedRequest.airport?.code} → ${selectedRequest.location_city}`}
                  </Text>
                  <Text style={styles.offerRequestDate}>
                    {formatDateTime(selectedRequest.preferred_datetime)}
                  </Text>
                  <Text style={styles.offerRequestSeats}>
                    {selectedRequest.seats_needed} seat(s) needed
                  </Text>
                </View>

                <Text style={styles.filterLabel}>Your Price (per seat)</Text>
                <View style={styles.priceInputContainer}>
                  <TextInput
                    style={styles.priceInput}
                    placeholder="e.g., 100"
                    keyboardType="numeric"
                    value={offerPrice}
                    onChangeText={setOfferPrice}
                  />
                  <Text style={styles.priceUnit}>MAD</Text>
                </View>

                {selectedRequest.max_price_per_seat && (
                  <Text style={styles.budgetHint}>
                    Passenger's budget: up to{" "}
                    {selectedRequest.max_price_per_seat} MAD/seat
                  </Text>
                )}

                <Text style={styles.filterLabel}>Message (optional)</Text>
                <TextInput
                  style={styles.messageInput}
                  placeholder="Introduce yourself or share pickup details..."
                  multiline
                  numberOfLines={3}
                  value={offerMessage}
                  onChangeText={setOfferMessage}
                />

                <TouchableOpacity
                  style={[
                    styles.submitOfferButton,
                    submittingOffer && styles.submitOfferButtonDisabled,
                  ]}
                  onPress={handleSubmitOffer}
                  disabled={submittingOffer}
                >
                  {submittingOffer ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="send" size={18} color="#fff" />
                      <Text style={styles.submitOfferButtonText}>
                        Send Offer
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
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
    paddingBottom: 12,
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
  filterButton: {
    padding: 8,
  },
  subtitle: {
    fontSize: 13,
    color: "#666",
    backgroundColor: "#e8f4ff",
    paddingVertical: 8,
    paddingHorizontal: 16,
    textAlign: "center",
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  airportBadge: {
    backgroundColor: "#e8f4ff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  airportCode: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#007AFF",
  },
  seatsInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  seatsText: {
    fontSize: 13,
    color: "#666",
  },
  passengerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  passengerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#17a2b8",
    justifyContent: "center",
    alignItems: "center",
  },
  passengerInfo: {
    flex: 1,
  },
  passengerName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  ratingText: {
    fontSize: 12,
    color: "#666",
  },
  routeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  routeText: {
    fontSize: 15,
    color: "#333",
    fontWeight: "500",
  },
  addressText: {
    fontSize: 13,
    color: "#666",
    marginLeft: 24,
    marginBottom: 8,
  },
  detailsRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 4,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: "#666",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  priceLabel: {
    fontSize: 13,
    color: "#666",
  },
  priceValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#28a745",
  },
  notesText: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  viewButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#007AFF",
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#007AFF",
  },
  offerButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#28a745",
  },
  offerButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13,
    color: "#bbb",
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 8,
    marginTop: 12,
  },
  airportGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  airportChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
  },
  airportChipActive: {
    backgroundColor: "#007AFF",
  },
  airportChipText: {
    fontSize: 13,
    color: "#666",
  },
  airportChipTextActive: {
    color: "#fff",
    fontWeight: "500",
  },
  directionRow: {
    flexDirection: "row",
    gap: 8,
  },
  directionChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  directionChipActive: {
    backgroundColor: "#007AFF",
  },
  directionChipText: {
    fontSize: 13,
    color: "#666",
  },
  directionChipTextActive: {
    color: "#fff",
    fontWeight: "500",
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
  },
  dateButtonText: {
    fontSize: 14,
    color: "#333",
  },
  cityInput: {
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  filterActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  clearButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  clearButtonText: {
    fontSize: 14,
    color: "#666",
  },
  applyButton: {
    flex: 2,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#007AFF",
  },
  applyButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  offerRequestInfo: {
    backgroundColor: "#f8f9fa",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  offerRequestRoute: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  offerRequestDate: {
    fontSize: 13,
    color: "#666",
    marginBottom: 2,
  },
  offerRequestSeats: {
    fontSize: 13,
    color: "#666",
  },
  priceInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  priceInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  priceUnit: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  budgetHint: {
    fontSize: 12,
    color: "#28a745",
    marginTop: 4,
  },
  messageInput: {
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
  },
  submitOfferButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#28a745",
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 20,
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
