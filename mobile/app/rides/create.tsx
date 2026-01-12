import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useAirportStore } from "@/store/airportStore";
import { Ionicons } from "@expo/vector-icons";

// Defining a constant for consistent placeholder color
const PLACEHOLDER_COLOR = "#94a3b8";

export default function CreateRideScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [airportModalVisible, setAirportModalVisible] = useState(false);
  const [airportSearch, setAirportSearch] = useState("");

  const { airports, isLoading, fetchAirports } = useAirportStore();

  const [form, setForm] = useState({
    airport_id: "",
    direction: "home_to_airport",
    home_city: "",
    home_postcode: "",
    datetime_start: "",
    seats_total: "",
    price_per_seat: "",
    comment: "",
  });

  const [dateTime, setDateTime] = useState({
    date: "",
    time: "",
  });

  useEffect(() => {
    fetchAirports();
  }, []);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleDateTimeChange = (field: "date" | "time", value: string) => {
    setDateTime((prev) => {
      const updated = { ...prev, [field]: value };
      // Combine date and time into datetime_start
      if (updated.date && updated.time) {
        setForm((prev) => ({
          ...prev,
          datetime_start: `${updated.date} ${updated.time}`,
        }));
      }
      return updated;
    });
  };

  const handleSubmit = async () => {
    const {
      airport_id,
      direction,
      home_city,
      home_postcode,
      datetime_start,
      seats_total,
      price_per_seat,
    } = form;

    if (
      !airport_id ||
      !direction ||
      !home_city ||
      !home_postcode ||
      !datetime_start ||
      !seats_total ||
      !price_per_seat
    ) {
      Alert.alert(
        "Missing Information",
        "Please fill in all required fields *"
      );
      return;
    }

    setLoading(true);
    try {
      const payload = {
        airport_id,
        direction,
        home_city,
        home_postcode,
        datetime_start,
        seats_total: parseInt(seats_total, 10),
        price_per_seat: parseFloat(price_per_seat),
        comment: form.comment,
      };

      console.log("Sending payload:", JSON.stringify(payload, null, 2));
      await api.post("/rides", payload);
      Alert.alert("Success 🎉", "Your ride has been posted!");
      router.replace("/rides/my-rides");
    } catch (error: any) {
      console.error("Full error response:", error.response?.data);
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to create ride"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Offer a Ride</Text>
        <Text style={styles.subtitle}>
          Fill in the details to find travel partners
        </Text>

        {/* Direction Switcher */}
        <View style={styles.section}>
          <Text style={styles.label}>Where are you going? *</Text>
          <View style={styles.directionRow}>
            <TouchableOpacity
              style={[
                styles.directionBtn,
                form.direction === "home_to_airport" && styles.activeBtn,
              ]}
              onPress={() => handleChange("direction", "home_to_airport")}
            >
              <Ionicons
                name="airplane-outline"
                size={20}
                color={
                  form.direction === "home_to_airport" ? "#fff" : "#64748b"
                }
              />
              <Text
                style={[
                  styles.directionText,
                  form.direction === "home_to_airport" && styles.activeBtnText,
                ]}
              >
                To Airport
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.directionBtn,
                form.direction === "airport_to_home" && styles.activeBtn,
              ]}
              onPress={() => handleChange("direction", "airport_to_home")}
            >
              <Ionicons
                name="home-outline"
                size={20}
                color={
                  form.direction === "airport_to_home" ? "#fff" : "#64748b"
                }
              />
              <Text
                style={[
                  styles.directionText,
                  form.direction === "airport_to_home" && styles.activeBtnText,
                ]}
              >
                To Home
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Airport Selection */}
        <View style={styles.section}>
          <Text style={styles.label}>Select Airport *</Text>
          <TouchableOpacity
            style={[styles.input, styles.dropdownTrigger]}
            onPress={() => setAirportModalVisible(true)}
          >
            <Text
              style={{ color: form.airport_id ? "#1e293b" : PLACEHOLDER_COLOR }}
            >
              {form.airport_id
                ? airports.find((a) => a.id === form.airport_id)?.name ||
                  "Select airport"
                : "Select airport"}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* Airport Modal */}
        <Modal
          visible={airportModalVisible}
          animationType="fade"
          transparent={true}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Search Airport</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Type name, code, or city..."
                placeholderTextColor={PLACEHOLDER_COLOR}
                value={airportSearch}
                onChangeText={setAirportSearch}
              />
              <FlatList
                data={airports.filter(
                  (a) =>
                    a.name
                      .toLowerCase()
                      .includes(airportSearch.toLowerCase()) ||
                    a.code
                      ?.toLowerCase()
                      .includes(airportSearch.toLowerCase()) ||
                    a.city.toLowerCase().includes(airportSearch.toLowerCase())
                )}
                keyExtractor={(item) => item.id}
                renderItem={({ item: airport }) => (
                  <TouchableOpacity
                    style={[
                      styles.airportListItem,
                      form.airport_id === airport.id && styles.selectedListItem,
                    ]}
                    onPress={() => {
                      handleChange("airport_id", airport.id);
                      setAirportModalVisible(false);
                      setAirportSearch("");
                    }}
                  >
                    <Text style={styles.airportCodeText}>
                      {airport.iata_code}
                    </Text>
                    <View>
                      <Text style={styles.airportNameText}>{airport.name}</Text>
                      <Text style={styles.airportCityText}>
                        {airport.city}, {airport.country}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setAirportModalVisible(false)}
              >
                <Text style={styles.closeBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Details Section */}
        <View style={styles.section}>
          <Text style={styles.label}>Ride Details *</Text>
          <TextInput
            style={styles.input}
            placeholder="City"
            placeholderTextColor={PLACEHOLDER_COLOR}
            value={form.home_city}
            onChangeText={(v) => handleChange("home_city", v)}
          />
          <TextInput
            style={styles.input}
            placeholder="Postcode"
            placeholderTextColor={PLACEHOLDER_COLOR}
            value={form.home_postcode}
            onChangeText={(v) => handleChange("home_postcode", v)}
          />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <TextInput
                style={styles.input}
                placeholder="Date (YYYY-MM-DD)"
                placeholderTextColor={PLACEHOLDER_COLOR}
                value={dateTime.date}
                onChangeText={(v) => handleDateTimeChange("date", v)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextInput
                style={styles.input}
                placeholder="Time (HH:MM)"
                placeholderTextColor={PLACEHOLDER_COLOR}
                value={dateTime.time}
                onChangeText={(v) => handleDateTimeChange("time", v)}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <TextInput
                style={styles.input}
                placeholder="Seats"
                placeholderTextColor={PLACEHOLDER_COLOR}
                keyboardType="numeric"
                value={form.seats_total}
                onChangeText={(v) => handleChange("seats_total", v)}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <TextInput
                style={styles.input}
                placeholder="Price ($)"
                placeholderTextColor={PLACEHOLDER_COLOR}
                keyboardType="numeric"
                value={form.price_per_seat}
                onChangeText={(v) => handleChange("price_per_seat", v)}
              />
            </View>
          </View>

          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: "top" }]}
            placeholder="Extra notes (luggage size, etc.)"
            placeholderTextColor={PLACEHOLDER_COLOR}
            multiline
            value={form.comment}
            onChangeText={(v) => handleChange("comment", v)}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, (loading || isLoading) && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={loading || isLoading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Publish Ride</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#f8fafc" },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1e293b",
    textAlign: "center",
    marginTop: 20,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 30,
  },
  section: { marginBottom: 20 },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 12,
  },
  directionRow: { flexDirection: "row", gap: 12 },
  directionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 8,
  },
  activeBtn: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  directionText: { fontWeight: "600", color: "#64748b" },
  activeBtnText: { color: "#fff" },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    fontSize: 16,
    color: "#1e293b", // High contrast text color
  },
  dropdownTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  row: { flexDirection: "row" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 15 },
  modalInput: {
    backgroundColor: "#f1f5f9",
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
    color: "#1e293b",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    placeholderTextColor: "#94a3b8",
  },
  airportListItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    flexDirection: "row",
    alignItems: "center",
  },
  selectedListItem: { backgroundColor: "#eff6ff" },
  airportCodeText: {
    fontWeight: "bold",
    marginRight: 15,
    color: "#2563eb",
    width: 40,
  },
  airportNameText: { fontWeight: "600", color: "#1e293b" },
  airportCityText: { fontSize: 12, color: "#64748b" },
  closeBtn: { marginTop: 15, alignItems: "center" },
  closeBtnText: { color: "#ef4444", fontWeight: "600" },
  submitBtn: {
    backgroundColor: "#2563eb",
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 40,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  submitBtnText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
});
