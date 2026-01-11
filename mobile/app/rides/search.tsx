import { useAirportStore } from "@/store/airportStore";
import { useRideStore } from "@/store/rideStore";
import LocationPicker, { LocationData } from "@/components/LocationPicker";
import MapLocationPicker, {
  MapLocationData,
} from "@/components/MapLocationPicker";
import { format } from "date-fns";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";

export default function SearchRidesScreen() {
  const router = useRouter();
  const { rides, searchRides, isLoading, pagination } = useRideStore();
  const { airports, fetchAirports } = useAirportStore();
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(
    null
  );

  const [filters, setFilters] = useState({
    airport_id: "",
    direction: "to_airport" as "to_airport" | "from_airport",
    date: format(new Date(), "yyyy-MM-dd"),
    home_postcode: "",
    home_city: "",
    seats_min: "1",
    page: 1,
    limit: 10,
  });

  useEffect(() => {
    fetchAirports();
  }, []);

  const handleLocationSelect = (location: LocationData) => {
    setSelectedLocation(location);
    setFilters((prev) => ({
      ...prev,
      home_postcode: location.postcode,
      home_city: location.city,
    }));
  };

  const handleMapLocationSelect = (location: MapLocationData) => {
    setSelectedLocation({
      ...location,
      placeId: "",
    });
    setFilters((prev) => ({
      ...prev,
      home_postcode: location.postcode,
      home_city: location.city,
    }));
  };

  const handleSearch = async () => {
    const searchFilters: any = {
      page: filters.page,
      limit: filters.limit,
    };

    if (filters.airport_id) searchFilters.airport_id = filters.airport_id;
    if (filters.direction) searchFilters.direction = filters.direction;
    if (filters.date) searchFilters.date = filters.date;
    if (filters.home_postcode)
      searchFilters.home_postcode = filters.home_postcode;
    if (filters.home_city) searchFilters.home_city = filters.home_city;
    if (filters.seats_min)
      searchFilters.seats_min = parseInt(filters.seats_min);

    try {
      await searchRides(searchFilters);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const updateFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.filterSection}>
          <Text style={styles.sectionTitle}>Search Filters</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Airport *</Text>
            <TouchableOpacity style={styles.pickerInput}>
              <Text
                style={[
                  styles.pickerText,
                  !filters.airport_id && styles.pickerPlaceholder,
                ]}
              >
                {filters.airport_id
                  ? airports.find((a) => a.id === filters.airport_id)?.name +
                    " (" +
                    airports.find((a) => a.id === filters.airport_id)?.code +
                    ")"
                  : "Select Airport"}
              </Text>
            </TouchableOpacity>
            {airports.length > 0 && (
              <View style={styles.airportDropdown}>
                <ScrollView style={styles.airportList}>
                  <TouchableOpacity
                    style={styles.airportOption}
                    onPress={() => updateFilter("airport_id", "")}
                  >
                    <Text style={styles.airportOptionText}>Select Airport</Text>
                  </TouchableOpacity>
                  {airports.map((airport) => (
                    <TouchableOpacity
                      key={airport.id}
                      style={[
                        styles.airportOption,
                        filters.airport_id === airport.id &&
                          styles.airportOptionActive,
                      ]}
                      onPress={() => updateFilter("airport_id", airport.id)}
                    >
                      <Text
                        style={[
                          styles.airportOptionText,
                          filters.airport_id === airport.id &&
                            styles.airportOptionTextActive,
                        ]}
                      >
                        {airport.name} ({airport.code})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Direction *</Text>
            <View style={styles.directionContainer}>
              <TouchableOpacity
                style={[
                  styles.directionButton,
                  filters.direction === "to_airport" &&
                    styles.directionButtonActive,
                ]}
                onPress={() => updateFilter("direction", "to_airport")}
              >
                <Text
                  style={[
                    styles.directionText,
                    filters.direction === "to_airport" &&
                      styles.directionTextActive,
                  ]}
                >
                  To Airport →
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.directionButton,
                  filters.direction === "from_airport" &&
                    styles.directionButtonActive,
                ]}
                onPress={() => updateFilter("direction", "from_airport")}
              >
                <Text
                  style={[
                    styles.directionText,
                    filters.direction === "from_airport" &&
                      styles.directionTextActive,
                  ]}
                >
                  ← From Airport
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Date</Text>
            <TextInput
              style={styles.input}
              value={filters.date}
              onChangeText={(value) => updateFilter("date", value)}
              placeholder="YYYY-MM-DD"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              {filters.direction === "to_airport"
                ? "Pickup Location"
                : "Dropoff Location"}
            </Text>

            {/* Two buttons: Search and Map */}
            <View style={styles.locationButtonsRow}>
              <TouchableOpacity
                style={styles.locationButtonHalf}
                onPress={() => setShowLocationPicker(true)}
              >
                <Text style={styles.locationButtonIcon}>🔍</Text>
                <Text style={styles.locationButtonLabel}>Search</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.locationButtonHalf}
                onPress={() => setShowMapPicker(true)}
              >
                <Text style={styles.locationButtonIcon}>📍</Text>
                <Text style={styles.locationButtonLabel}>Pin on Map</Text>
              </TouchableOpacity>
            </View>

            {/* Selected location display */}
            {selectedLocation && (
              <View style={styles.selectedLocationBox}>
                <View style={styles.selectedLocationContainer}>
                  <Text style={styles.selectedLocationText} numberOfLines={1}>
                    {selectedLocation.address}
                  </Text>
                  <Text style={styles.selectedLocationDetails}>
                    {selectedLocation.city}
                    {selectedLocation.postcode
                      ? ` • ${selectedLocation.postcode}`
                      : ""}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.clearLocationButtonInline}
                  onPress={() => {
                    setSelectedLocation(null);
                    setFilters((prev) => ({
                      ...prev,
                      home_postcode: "",
                      home_city: "",
                    }));
                  }}
                >
                  <Text style={styles.clearLocationText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Minimum Seats</Text>
            <TextInput
              style={styles.input}
              value={filters.seats_min}
              onChangeText={(value) => updateFilter("seats_min", value)}
              placeholder="1"
              keyboardType="number-pad"
            />
          </View>

          <TouchableOpacity
            style={[
              styles.searchButton,
              isLoading && styles.searchButtonDisabled,
            ]}
            onPress={handleSearch}
            disabled={isLoading}
          >
            <Text style={styles.searchButtonText}>
              {isLoading ? "Searching..." : "Search Rides"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.resultsSection}>
          <Text style={styles.sectionTitle}>
            {rides.length > 0
              ? `${pagination?.total || rides.length} Rides Found`
              : "Search Results"}
          </Text>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
          ) : rides.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>🔍</Text>
              <Text style={styles.emptyStateText}>No rides found</Text>
              <Text style={styles.emptyStateSubtext}>
                Try adjusting your search filters
              </Text>
            </View>
          ) : (
            rides.map((ride) => {
              const rideId =
                typeof ride.id === "string"
                  ? ride.id
                  : String(ride.id || ride.id);
              return (
                <TouchableOpacity
                  key={rideId}
                  style={styles.rideCard}
                  onPress={() => router.push(`/rides/${rideId}`)}
                >
                  <View style={styles.rideHeader}>
                    <Text style={styles.rideRoute}>
                      {ride.home_city}{" "}
                      {ride.direction === "to_airport" ? "→" : "←"}{" "}
                      {ride.airport?.code}
                    </Text>
                    <Text style={styles.ridePrice}>${ride.price_per_seat}</Text>
                  </View>

                  <Text style={styles.rideDate}>
                    {ride.departure_datetime &&
                      format(
                        new Date(ride.departure_datetime),
                        "MMM d, yyyy • HH:mm"
                      )}
                  </Text>

                  <View style={styles.rideFooter}>
                    <Text style={styles.rideSeats}>
                      {ride.available_seats} seat
                      {ride.available_seats !== 1 ? "s" : ""} available
                    </Text>
                    <Text style={styles.rideDriver}>
                      by {ride.driver?.first_name}
                    </Text>
                  </View>

                  {ride.driver_comment && (
                    <Text style={styles.rideComment} numberOfLines={2}>
                      {ride.driver_comment}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })
          )}

          {pagination && pagination.totalPages > 1 && (
            <View style={styles.pagination}>
              <TouchableOpacity
                style={[
                  styles.paginationButton,
                  pagination.page === 1 && styles.paginationButtonDisabled,
                ]}
                onPress={() => {
                  if (pagination.page > 1) {
                    updateFilter("page", (pagination.page - 1).toString());
                    handleSearch();
                  }
                }}
                disabled={pagination.page === 1}
              >
                <Text style={styles.paginationButtonText}>Previous</Text>
              </TouchableOpacity>

              <Text style={styles.paginationText}>
                Page {pagination.page} of {pagination.totalPages}
              </Text>

              <TouchableOpacity
                style={[
                  styles.paginationButton,
                  pagination.page === pagination.totalPages &&
                    styles.paginationButtonDisabled,
                ]}
                onPress={() => {
                  if (pagination.page < pagination.totalPages) {
                    updateFilter("page", (pagination.page + 1).toString());
                    handleSearch();
                  }
                }}
                disabled={pagination.page === pagination.totalPages}
              >
                <Text style={styles.paginationButtonText}>Next</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      <LocationPicker
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSelectLocation={handleLocationSelect}
        placeholder={
          filters.direction === "to_airport"
            ? "Search pickup location..."
            : "Search dropoff location..."
        }
      />

      <MapLocationPicker
        visible={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        onSelectLocation={handleMapLocationSelect}
        showAirports={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  scrollView: {
    flex: 1,
  },
  filterSection: {
    backgroundColor: "#fff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 16,
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
    backgroundColor: "#fff",
  },
  pickerInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
    justifyContent: "center",
  },
  pickerText: {
    fontSize: 16,
    color: "#1f2937",
  },
  pickerPlaceholder: {
    color: "#9ca3af",
  },
  airportDropdown: {
    maxHeight: 200,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  airportList: {
    maxHeight: 200,
  },
  airportOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  airportOptionActive: {
    backgroundColor: "#2563eb",
  },
  airportOptionText: {
    fontSize: 14,
    color: "#1f2937",
  },
  airportOptionTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  directionContainer: {
    flexDirection: "row",
    gap: 8,
  },
  directionButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  directionButtonActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  directionText: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  directionTextActive: {
    color: "#fff",
  },
  searchButton: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  resultsSection: {
    padding: 16,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#6b7280",
  },
  rideCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  rideHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  rideRoute: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    flex: 1,
  },
  ridePrice: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#10b981",
  },
  rideDate: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 8,
  },
  rideFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rideSeats: {
    fontSize: 14,
    color: "#2563eb",
    fontWeight: "500",
  },
  rideDriver: {
    fontSize: 14,
    color: "#6b7280",
  },
  rideComment: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 8,
    fontStyle: "italic",
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  paginationButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#2563eb",
  },
  paginationButtonDisabled: {
    backgroundColor: "#d1d5db",
  },
  paginationButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  paginationText: {
    fontSize: 14,
    color: "#6b7280",
  },
  locationButtonsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  locationButtonHalf: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 16,
    backgroundColor: "#fff",
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 16,
    backgroundColor: "#fff",
    marginBottom: 12,
  },
  locationButtonIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  locationButtonLabel: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  selectedLocationBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2563eb",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#eff6ff",
  },
  clearLocationButtonInline: {
    padding: 8,
  },
  selectedLocationContainer: {
    flex: 1,
  },
  selectedLocationText: {
    fontSize: 16,
    color: "#1f2937",
    fontWeight: "500",
  },
  selectedLocationDetails: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 2,
  },
  clearLocationText: {
    fontSize: 14,
    color: "#dc2626",
  },
});
