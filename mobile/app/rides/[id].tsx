import { useAuthStore } from "@/store/authStore";
import { useBookingStore } from "@/store/bookingStore";
import { useRideStore } from "@/store/rideStore";
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
    console.log("Params:", params);
    console.log("ID from params:", id, "Type:", typeof id);
    if (id && typeof id === "string") {
      console.log("Loading ride with ID:", id);
      getRideById(id).catch((error) => {
        console.error("Failed to load ride:", error);
        Alert.alert("Error", "Failed to load ride details");
      });
    }
  }, [id]);

  useEffect(() => {
    console.log("Current ride data:", currentRide);
    console.log("User:", user);
    console.log("User ID:", user?.id);
    console.log("Driver ID:", currentRide?.driver_id);
    console.log("IDs match:", user?.id === currentRide?.driver_id);
    console.log(
      "String match:",
      String(user?.id) === String(currentRide?.driver_id)
    );
  }, [currentRide, user]);

  useEffect(() => {
    // Compare as strings to handle ObjectId vs string mismatch
    const userId = String(user?.id || "");
    const driverId = String(currentRide?.driver_id || "");
    console.log("Checking if should load bookings:", {
      id,
      userId,
      driverId,
      match: userId === driverId,
    });

    if (
      id &&
      currentRide &&
      user &&
      userId &&
      driverId &&
      userId === driverId
    ) {
      console.log("Loading ride bookings for ride:", id);
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
      router.push("../bookings/index");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  const handleAccept = async (bookingId: string) => {
    try {
      console.log("=== HANDLE ACCEPT START ===");
      console.log("Booking ID to accept:", bookingId);
      setActionId(bookingId);
      await acceptBooking(bookingId);
      console.log("Accept booking completed, refreshing ride...");
      // Refresh ride details to update seat count
      if (id) {
        await getRideById(id);
        console.log(
          "Ride refreshed. Current ride seats_left:",
          currentRide?.seats_left
        );
      }
      Alert.alert("Success", "Booking accepted");
    } catch (err: any) {
      console.log("Handle accept error:", err);
      Alert.alert("Error", err.message || "Failed to accept booking");
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (bookingId: string) => {
    try {
      setActionId(bookingId);
      await rejectBooking(bookingId);
      // Refresh ride details
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
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const isOwner =
    String(user?.id || "") === String(currentRide.driver_id || "");
  const canBook = user?.role === "passenger" || user?.role === "both";

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.route}>
            {currentRide.home_city}{" "}
            {currentRide.direction === "to_airport" ? "→" : "←"}{" "}
            {currentRide.airport?.name}
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
              ${currentRide.price_per_seat}
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
          canBook &&
          currentRide.status === "active" &&
          (currentRide.seats_left ?? 0) > 0 && (
            <TouchableOpacity
              style={styles.bookButton}
              onPress={() => setBookingModalVisible(true)}
            >
              <Text style={styles.bookButtonText}>Book This Ride</Text>
            </TouchableOpacity>
          )}

        {isOwner && (
          <View style={styles.ownerActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push(`/rides/${id}/bookings`)}
            >
              <Text style={styles.actionButtonText}>View All Bookings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={() => router.push(`/rides/edit/${id}`)}
            >
              <Text style={styles.actionButtonText}>Edit Ride</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Booking Requests Section for Driver */}
        {isOwner && rideBookings && rideBookings.length > 0 && (
          <View style={styles.bookingsSection}>
            <Text style={styles.bookingsSectionTitle}>Booking Requests</Text>
            {bookingLoading && (
              <ActivityIndicator size="small" color="#2563eb" />
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
                Price: ${currentRide.price_per_seat} per seat
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
              Total: ${(parseFloat(seats) || 0) * currentRide.price_per_seat}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  route: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1f2937",
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: "#d1fae5",
  },
  statusInactive: {
    backgroundColor: "#fee2e2",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1f2937",
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
    borderBottomColor: "#f3f4f6",
  },
  infoLabel: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 14,
    color: "#1f2937",
    fontWeight: "600",
    textAlign: "right",
    flex: 1,
    marginLeft: 12,
  },
  seatsAvailable: {
    color: "#2563eb",
  },
  price: {
    color: "#10b981",
    fontSize: 16,
  },
  commentSection: {
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  commentLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  commentText: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
  },
  bookButton: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
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
    backgroundColor: "#2563eb",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  editButton: {
    backgroundColor: "#6b7280",
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
    color: "#1f2937",
    marginBottom: 16,
  },
  modalInfo: {
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  modalInfoText: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 4,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#10b981",
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
    backgroundColor: "#f3f4f6",
  },
  modalButtonCancelText: {
    color: "#374151",
    fontWeight: "600",
  },
  modalButtonConfirm: {
    backgroundColor: "#2563eb",
  },
  modalButtonConfirmText: {
    color: "#fff",
    fontWeight: "600",
  },
  // Bookings Section Styles
  bookingsSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  bookingsSectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 16,
  },
  bookingCard: {
    backgroundColor: "#f9fafb",
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
    fontSize: 17,
    fontWeight: "700",
    color: "#000000",
  },
  bookingStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPending: {
    backgroundColor: "#fef3c7",
  },
  statusAccepted: {
    backgroundColor: "#d1fae5",
  },
  statusRejected: {
    backgroundColor: "#fee2e2",
  },
  statusCancelled: {
    backgroundColor: "#f3f4f6",
  },
  bookingStatusText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
    color: "#374151",
  },
  bookingInfo: {
    fontSize: 15,
    color: "#000000",
    marginBottom: 6,
    fontWeight: "500",
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
    backgroundColor: "#10b981",
  },
  rejectBtn: {
    backgroundColor: "#ef4444",
  },
  bookingActionText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
});
