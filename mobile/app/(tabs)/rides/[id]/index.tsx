import { useAuthStore } from "../../../../src/store/authStore";
import { useBookingStore } from "../../../../src/store/bookingStore";
import { useRideStore } from "../../../../src/store/rideStore";
import { format } from "date-fns";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function RideDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params?.id;
  const { currentRide, getRideById, isLoading } = useRideStore();
  const {
    createBooking,
    getRideBookings,
    rideBookings,
    acceptBooking,
    rejectBooking,
    isLoading: bookingLoading,
  } = useBookingStore();
  const { user } = useAuthStore();
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [seats, setSeats] = useState("1");
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    if (id && typeof id === "string") {
      getRideById(id).catch((error) => {
        console.error("Failed to load ride:", error);
        Alert.alert("Error", "Failed to load ride details");
      });
    }
  }, [id]);

  useEffect(() => {
    const userId = String(user?.id || "");
    const driverId = String(currentRide?.driver_id || "");

    if (
      id &&
      currentRide &&
      user &&
      userId &&
      driverId &&
      userId === driverId
    ) {
      getRideBookings(id as string).catch((error) => {
        console.error("Failed to load ride bookings:", error);
      });
    }
  }, [id, currentRide, user]);

  const handleBooking = async () => {
    if (!seats || parseInt(seats) < 1) {
      Alert.alert("Error", "Please enter a valid number of seats");
      return;
    }

    if (parseInt(seats) > (currentRide?.seats_left || 0)) {
      Alert.alert("Error", "Not enough seats available");
      return;
    }

    try {
      await createBooking(id as string, parseInt(seats));
      Alert.alert("Success", "Booking created successfully!");
      setBookingModalVisible(false);
      router.push("/(tabs)/bookings");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  const handleAccept = async (bookingId: string) => {
    try {
      setActionId(bookingId);
      await acceptBooking(bookingId);
      if (id) {
        await getRideById(id);
      }
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
      if (id) {
        await getRideById(id);
      }
      Alert.alert("Success", "Booking rejected");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to reject booking");
    } finally {
      setActionId(null);
    }
  };

  if (isLoading || !currentRide) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const isOwner =
    String(user?.id || "") === String(currentRide.driver_id || "");

  return (
    <View style={styles.container}>
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

      <ScrollView style={styles.scrollView}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.route}>
              {currentRide.home_city}{" "}
              {currentRide.direction === "to_airport" ? "→" : "←"}{" "}
              {currentRide.airport?.name || currentRide.airport?.iata_code}
            </Text>
            <View
              style={[
                styles.statusBadge,
                currentRide.status === "active"
                  ? styles.statusActive
                  : styles.statusInactive,
              ]}
            >
              <Text style={styles.statusText}>{currentRide.status}</Text>
            </View>
          </View>

          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Airport:</Text>
              <Text style={styles.infoValue}>
                {currentRide.airport?.name || currentRide.airport?.iata_code}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Direction:</Text>
              <Text style={styles.infoValue}>
                {currentRide.direction === "to_airport"
                  ? "To Airport"
                  : "From Airport"}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Date & Time:</Text>
              <Text style={styles.infoValue}>
                {currentRide.datetime_start
                  ? format(
                      new Date(currentRide.datetime_start.replace(" ", "T")),
                      "MMM d, yyyy • HH:mm"
                    )
                  : "N/A"}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Location:</Text>
              <Text style={styles.infoValue}>
                {currentRide.home_city}, {currentRide.home_postcode}
              </Text>
            </View>

            {currentRide.home_address && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Address:</Text>
                <Text style={styles.infoValue}>{currentRide.home_address}</Text>
              </View>
            )}

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Available Seats:</Text>
              <Text style={[styles.infoValue, styles.seatsAvailable]}>
                {currentRide.seats_left} / {currentRide.seats_total}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Price per Seat:</Text>
              <Text style={[styles.infoValue, styles.price]}>
                {currentRide.price_per_seat} MAD
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Driver:</Text>
              <Text style={styles.infoValue}>
                {currentRide.driver?.first_name} {currentRide.driver?.last_name}
              </Text>
            </View>

            {currentRide.driver?.phone_number && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phone:</Text>
                <Text style={styles.infoValue}>
                  {currentRide.driver.phone_number}
                </Text>
              </View>
            )}
          </View>

          {currentRide.driver_comment && (
            <View style={styles.commentSection}>
              <Text style={styles.commentLabel}>Driver's Comment:</Text>
              <Text style={styles.commentText}>{currentRide.driver_comment}</Text>
            </View>
          )}

          {!isOwner &&
            currentRide.status === "active" &&
            (currentRide.seats_left ?? 0) > 0 && (
              <TouchableOpacity
                style={styles.bookButton}
                onPress={() => setBookingModalVisible(true)}
              >
                <Ionicons name="car" size={20} color="#fff" />
                <Text style={styles.bookButtonText}>Book This Ride</Text>
              </TouchableOpacity>
            )}

          {isOwner && (
            <View style={styles.ownerActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push({ pathname: "/(tabs)/rides/[id]/bookings", params: { id } })}
              >
                <Text style={styles.actionButtonText}>View All Bookings</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Booking Requests Section for Driver */}
          {isOwner && rideBookings && rideBookings.length > 0 && (
            <View style={styles.bookingsSection}>
              <Text style={styles.bookingsSectionTitle}>Booking Requests</Text>
              {bookingLoading && (
                <ActivityIndicator size="small" color="#007AFF" />
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
                        booking.status === "pending" && styles.statusPending,
                        booking.status === "accepted" && styles.statusAccepted,
                        booking.status === "rejected" && styles.statusRejected,
                        booking.status === "cancelled" && styles.statusCancelled,
                      ]}
                    >
                      <Text style={styles.bookingStatusText}>
                        {booking.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.bookingInfo}>
                    Seats requested: {booking.seats || booking.seats_booked || 1}
                  </Text>
                  {(booking.passenger_phone ||
                    booking.passenger_id?.phone ||
                    booking.passenger?.phone_number) && (
                    <Text style={styles.bookingInfo}>
                      Phone:{" "}
                      {booking.passenger_phone ||
                        booking.passenger_id?.phone ||
                        booking.passenger?.phone_number}
                    </Text>
                  )}
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
        </View>
      </ScrollView>

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
                Available: {currentRide.seats_left} seats
              </Text>
              <Text style={styles.modalInfoText}>
                Price: {currentRide.price_per_seat} MAD per seat
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
              Total: {(parseFloat(seats) || 0) * currentRide.price_per_seat} MAD
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
  headerTitle: {
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
  card: {
    backgroundColor: "#fff",
    margin: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  route: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: "#d4edda",
  },
  statusInactive: {
    backgroundColor: "#f8d7da",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
    textTransform: "capitalize",
  },
  infoSection: {
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  infoLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 14,
    color: "#333",
    fontWeight: "600",
    textAlign: "right",
    flex: 1,
    marginLeft: 12,
  },
  seatsAvailable: {
    color: "#007AFF",
  },
  price: {
    color: "#28a745",
    fontSize: 16,
  },
  commentSection: {
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  commentLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  commentText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  bookButton: {
    backgroundColor: "#28a745",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  bookButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  ownerActions: {
    gap: 12,
  },
  actionButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
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
  bookingsSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  bookingsSectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginBottom: 16,
  },
  bookingCard: {
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
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
  statusPending: {
    backgroundColor: "#fff3cd",
  },
  statusAccepted: {
    backgroundColor: "#d4edda",
  },
  statusRejected: {
    backgroundColor: "#f8d7da",
  },
  statusCancelled: {
    backgroundColor: "#e9ecef",
  },
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
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptBtn: {
    backgroundColor: "#28a745",
  },
  rejectBtn: {
    backgroundColor: "#dc3545",
  },
  bookingActionText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
});
