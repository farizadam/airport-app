import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocationStore, SavedLocation } from "@/store/locationStore";

// Using Nominatim (OpenStreetMap) - FREE, no API key needed!

export interface LocationData {
  address: string;
  city: string;
  postcode: string;
  country: string;
  latitude: number;
  longitude: number;
  placeId: string;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: {
    house_number?: string;
    road?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
  type: string;
  class: string;
}

interface LocationPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectLocation: (location: LocationData) => void;
  placeholder?: string;
  initialValue?: string;
  showSavedLocations?: boolean;
}

export default function LocationPicker({
  visible,
  onClose,
  onSelectLocation,
  placeholder = "Search for a location...",
  initialValue = "",
  showSavedLocations = true,
}: LocationPickerProps) {
  const { savedLocations, getSavedLocations, addSavedLocation, isLoading } =
    useLocationStore();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [locationToSave, setLocationToSave] = useState<LocationData | null>(
    null
  );
  const [locationName, setLocationName] = useState("");
  const [activeTab, setActiveTab] = useState<"search" | "saved">("search");
  const [searchQuery, setSearchQuery] = useState(initialValue);
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      console.log("LocationPicker opened (using OpenStreetMap/Nominatim)");
      if (initialValue) {
        setSearchQuery(initialValue);
      }
      if (showSavedLocations) {
        getSavedLocations().catch(console.error);
      }
    } else {
      // Reset state when closed
      setSearchQuery("");
      setSearchResults([]);
      setSearchError(null);
    }
  }, [visible, initialValue, showSavedLocations]);

  // Debounced search function using Nominatim (OpenStreetMap)
  const searchLocations = useCallback(async (query: string) => {
    if (!query || query.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      // Nominatim API - FREE geocoding from OpenStreetMap
      // Adding countrycodes=fr to bias results to France, but still shows worldwide
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
          `q=${encodeURIComponent(query)}` +
          `&format=json` +
          `&addressdetails=1` +
          `&limit=10` +
          `&accept-language=en,fr`,
        {
          headers: {
            "User-Agent": "MyAirportApp/1.0", // Required by Nominatim
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data: NominatimResult[] = await response.json();
      setSearchResults(data);
    } catch (error: any) {
      console.error("Nominatim search error:", error);
      setSearchError(error.message || "Search failed");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounce search input
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchLocations(searchQuery);
    }, 500); // 500ms debounce for Nominatim rate limiting

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchLocations]);

  const getCityFromResult = (address: NominatimResult["address"]): string => {
    return (
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.county ||
      ""
    );
  };

  const getShortAddress = (result: NominatimResult): string => {
    const parts: string[] = [];
    if (result.address.house_number) parts.push(result.address.house_number);
    if (result.address.road) parts.push(result.address.road);
    if (result.address.suburb) parts.push(result.address.suburb);
    return parts.join(" ") || result.display_name.split(",")[0];
  };

  const handleSelectResult = (result: NominatimResult) => {
    const location: LocationData = {
      address: result.display_name,
      city: getCityFromResult(result.address),
      postcode: result.address.postcode || "",
      country: result.address.country || "",
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      placeId: result.place_id.toString(),
    };

    // Ask if user wants to save the location
    Alert.alert("Use this location", getShortAddress(result), [
      {
        text: "Use Once",
        onPress: () => {
          onSelectLocation(location);
          onClose();
        },
      },
      {
        text: "Save & Use",
        onPress: () => {
          setLocationToSave(location);
          setShowSaveModal(true);
        },
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  };

  const handleSaveLocation = async () => {
    if (!locationToSave || !locationName.trim()) {
      Alert.alert("Error", "Please enter a name for this location");
      return;
    }

    try {
      await addSavedLocation({
        name: locationName.trim(),
        address: locationToSave.address,
        city: locationToSave.city,
        postcode: locationToSave.postcode,
        country: locationToSave.country,
        latitude: locationToSave.latitude,
        longitude: locationToSave.longitude,
        placeId: locationToSave.placeId,
      });

      onSelectLocation(locationToSave);
      setShowSaveModal(false);
      setLocationToSave(null);
      setLocationName("");
      onClose();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  const handleSelectSavedLocation = (saved: SavedLocation) => {
    const location: LocationData = {
      address: saved.address,
      city: saved.city,
      postcode: saved.postcode || "",
      country: saved.country || "",
      latitude: saved.latitude,
      longitude: saved.longitude,
      placeId: saved.placeId || "",
    };
    onSelectLocation(location);
    onClose();
  };

  const getLocationIcon = (result: NominatimResult): string => {
    const type = result.type || result.class;
    switch (type) {
      case "house":
      case "residential":
      case "building":
        return "🏠";
      case "aerodrome":
      case "airport":
        return "✈️";
      case "station":
      case "railway":
        return "🚉";
      case "city":
      case "town":
      case "village":
        return "🏙️";
      case "road":
      case "street":
        return "🛣️";
      default:
        return "📍";
    }
  };

  const renderSearchResult = ({ item }: { item: NominatimResult }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleSelectResult(item)}
    >
      <View style={styles.resultIcon}>
        <Text style={styles.resultIconText}>{getLocationIcon(item)}</Text>
      </View>
      <View style={styles.resultInfo}>
        <Text style={styles.resultName} numberOfLines={1}>
          {getShortAddress(item)}
        </Text>
        <Text style={styles.resultAddress} numberOfLines={2}>
          {getCityFromResult(item.address)}
          {item.address.postcode ? ` • ${item.address.postcode}` : ""}
          {item.address.country ? `, ${item.address.country}` : ""}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Select Location</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {showSavedLocations && (
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === "search" && styles.tabActive]}
              onPress={() => setActiveTab("search")}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "search" && styles.tabTextActive,
                ]}
              >
                Search
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === "saved" && styles.tabActive]}
              onPress={() => setActiveTab("saved")}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "saved" && styles.tabTextActive,
                ]}
              >
                Saved ({savedLocations.length})
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === "search" ? (
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder={placeholder}
                placeholderTextColor="#9ca3af"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                  style={styles.clearButton}
                >
                  <Text style={styles.clearButtonText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {isSearching && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#2563eb" />
                <Text style={styles.loadingText}>Searching...</Text>
              </View>
            )}

            {searchError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorBoxText}>{searchError}</Text>
              </View>
            )}

            {!isSearching && searchResults.length > 0 && (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.place_id.toString()}
                renderItem={renderSearchResult}
                style={styles.resultsList}
                keyboardShouldPersistTaps="handled"
              />
            )}

            {!isSearching &&
              searchQuery.length >= 3 &&
              searchResults.length === 0 &&
              !searchError && (
                <View style={styles.noResults}>
                  <Text style={styles.noResultsText}>No locations found</Text>
                  <Text style={styles.noResultsSubtext}>
                    Try a different search term
                  </Text>
                </View>
              )}

            {searchQuery.length < 3 && (
              <View style={styles.helpContainer}>
                <Text style={styles.helpText}>
                  Type at least 3 characters to search
                </Text>
                <Text style={styles.helpTextSmall}>
                  🗺️ Powered by OpenStreetMap
                </Text>
              </View>
            )}
          </View>
        ) : (
          <ScrollView style={styles.savedContainer}>
            {isLoading ? (
              <ActivityIndicator
                size="large"
                color="#2563eb"
                style={styles.loader}
              />
            ) : savedLocations.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>📍</Text>
                <Text style={styles.emptyStateText}>No saved locations</Text>
                <Text style={styles.emptyStateSubtext}>
                  Search and save locations for quick access
                </Text>
              </View>
            ) : (
              savedLocations.map((location) => (
                <TouchableOpacity
                  key={location.id}
                  style={styles.savedLocationItem}
                  onPress={() => handleSelectSavedLocation(location)}
                >
                  <View style={styles.savedLocationIcon}>
                    <Text style={styles.savedLocationIconText}>📍</Text>
                  </View>
                  <View style={styles.savedLocationInfo}>
                    <Text style={styles.savedLocationName}>
                      {location.name}
                    </Text>
                    <Text style={styles.savedLocationAddress} numberOfLines={1}>
                      {location.address}
                    </Text>
                    <Text style={styles.savedLocationCity}>
                      {location.city}
                      {location.postcode ? ` • ${location.postcode}` : ""}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        )}

        {/* Save Location Modal */}
        <Modal
          visible={showSaveModal}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowSaveModal(false)}
        >
          <View style={styles.saveModalOverlay}>
            <View style={styles.saveModalContent}>
              <Text style={styles.saveModalTitle}>Save Location</Text>
              <Text style={styles.saveModalAddress} numberOfLines={2}>
                {locationToSave?.address}
              </Text>
              <TextInput
                style={styles.saveModalInput}
                placeholder="Enter a name (e.g., Home, Work)"
                value={locationName}
                onChangeText={setLocationName}
                autoFocus
              />
              <View style={styles.saveModalButtons}>
                <TouchableOpacity
                  style={styles.saveModalCancelButton}
                  onPress={() => {
                    setShowSaveModal(false);
                    setLocationToSave(null);
                    setLocationName("");
                  }}
                >
                  <Text style={styles.saveModalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveModalSaveButton}
                  onPress={handleSaveLocation}
                >
                  <Text style={styles.saveModalSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 20,
    color: "#6b7280",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
    marginHorizontal: 4,
  },
  tabActive: {
    backgroundColor: "#2563eb",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  tabTextActive: {
    color: "#fff",
  },
  searchContainer: {
    flex: 1,
    padding: 16,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: "#1f2937",
  },
  clearButton: {
    padding: 8,
  },
  clearButtonText: {
    fontSize: 16,
    color: "#9ca3af",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#6b7280",
  },
  errorBox: {
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  errorBoxText: {
    color: "#dc2626",
    fontSize: 14,
  },
  resultsList: {
    flex: 1,
    marginTop: 12,
  },
  resultItem: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#dbeafe",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  resultIconText: {
    fontSize: 18,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  resultAddress: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
  },
  noResults: {
    alignItems: "center",
    paddingVertical: 40,
  },
  noResultsText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: "#6b7280",
  },
  helpContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  helpText: {
    fontSize: 14,
    color: "#6b7280",
  },
  helpTextSmall: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 8,
  },
  savedContainer: {
    flex: 1,
    padding: 16,
  },
  loader: {
    marginTop: 40,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyStateIcon: {
    fontSize: 48,
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
    textAlign: "center",
  },
  savedLocationItem: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  savedLocationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#dbeafe",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  savedLocationIconText: {
    fontSize: 20,
  },
  savedLocationInfo: {
    flex: 1,
  },
  savedLocationName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  savedLocationAddress: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 2,
  },
  savedLocationCity: {
    fontSize: 13,
    color: "#9ca3af",
  },
  saveModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  saveModalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  saveModalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 12,
  },
  saveModalAddress: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 16,
  },
  saveModalInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  saveModalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  saveModalCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  saveModalCancelText: {
    fontSize: 16,
    color: "#6b7280",
    fontWeight: "500",
  },
  saveModalSaveButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveModalSaveText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },
});
