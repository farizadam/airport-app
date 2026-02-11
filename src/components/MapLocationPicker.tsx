import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  TextInput,
  FlatList,
  Keyboard,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { toast } from "../store/toastStore";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import LeafletMap, { LeafletMapRef } from "./LeafletMap";

export interface MapLocationData {
  address: string;
  city: string;
  postcode: string;
  country: string;
  latitude: number;
  longitude: number;
}

interface MapLocationPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectLocation: (location: MapLocationData) => void;
  initialLocation?: { latitude: number; longitude: number };
  showAirports?: boolean;
}

interface SearchResult {
  id: string;
  description: string;
  lat?: string;
  lon?: string;
  address?: any;
}

export default function MapLocationPicker({
  visible,
  onClose,
  onSelectLocation,
  initialLocation,
}: MapLocationPickerProps) {
  const debounceTimer = useRef<any>(null);
  const mapRef = useRef<LeafletMapRef>(null);

  const [region, setRegion] = useState<{ latitude: number; longitude: number; zoom?: number } | undefined>(
    initialLocation
      ? {
          ...initialLocation,
          zoom: 15
        }
      : undefined
  );
  const [selectedLocation, setSelectedLocation] =
    useState<MapLocationData | null>(null);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const hasLocatedUser = useRef(false);

  useEffect(() => {
    if (visible) {
      console.log(`🗺️ MapLocationPicker opened. Mode: Leaflet WebView`);
      setIsLoading(true);
      setSelectedLocation(null);
      setSearchQuery("");
      setSearchResults([]);
      setShowResults(false);
      // Removed: hasLocatedUser.current = false; // Do NOT reset this to prevent loops

      if (initialLocation && initialLocation.latitude && initialLocation.longitude) {
        setRegion({
            latitude: initialLocation.latitude,
            longitude: initialLocation.longitude,
            zoom: 15
        });
        setTimeout(() => {
           reverseGeocode(initialLocation.latitude, initialLocation.longitude);
           setIsLoading(false);
        }, 500);
      } else {
        // If no initial location, try to get user's current location - BUT ONLY ONCE
        if (!hasLocatedUser.current) {
             hasLocatedUser.current = true;
             setTimeout(() => getMyLocation(), 500);
        } else {
            setIsLoading(false); // Stop loading if we already tried
        }
      }
    }
  }, [visible, initialLocation]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  // --- SEARCH FUNCTIONS ---

  const handleSearch = async () => {
    if (searchQuery.length < 2) {
      toast.warning("Search", "Please enter at least 2 characters");
      return;
    }
    Keyboard.dismiss();
    searchPlacesNominatim(searchQuery);
  };

  const searchPlacesNominatim = async (query: string) => {
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
          `q=${encodeURIComponent(query)}` +
          `&format=json` +
          `&addressdetails=1` +
          `&limit=10` +
          `&accept-language=en,fr`,
        {
          headers: {
            "User-Agent": "MyAirportApp/1.0",
          },
        }
      );
      const data = await response.json();
      if (data) {
        setSearchResults(data.map((p: any) => ({
          id: p.place_id.toString(),
          description: p.display_name,
          lat: p.lat,
          lon: p.lon,
          address: p.address,
        })));
        setShowResults(true);
      }
    } catch (error) {
      console.error("Nominatim search error:", error);
      toast.error("Search Error", "Could not fetch search results from OpenStreetMap.");
    } finally {
      setIsSearching(false);
    }
  };

  const selectSearchResult = async (result: SearchResult) => {
    setSearchQuery(result.description);
    setShowResults(false);
    setSearchResults([]);
    Keyboard.dismiss();
    setIsLoading(true);

    await selectResultNominatim(result);
  };

  const selectResultNominatim = async (result: SearchResult) => {
    try {
      if (result.lat && result.lon) {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        
        setRegion({
          latitude: lat,
          longitude: lng,
          zoom: 16
        });
        
        const address = result.address || {};
        const city = address.city || address.town || address.village || address.municipality || address.county || "";
        
        setSelectedLocation({
            address: result.description,
            city: city,
            postcode: address.postcode || "",
            country: address.country || "",
            latitude: lat,
            longitude: lng,
        });
      }
    } catch (error) {
       console.error("Nominatim selection error:", error);
    } finally {
        setIsLoading(false);
    }
  };

  // --- LOCATION FUNCTIONS ---

  const getMyLocation = async () => {
    setIsGettingLocation(true);
    setIsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        toast.warning(
          "Permission Denied",
          "Please enable location permissions to use this feature."
        );
        setIsGettingLocation(false);
        setIsLoading(false);
        return;
      }
      
      let location = null;
      try {
        // Try Highest Accuracy first (Best for Huawei/Non-GMS to trigger hardware GPS)
        console.log("Trying High/BestForNavigation accuracy...");
        location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      } catch (err: any) {
        console.log("High accuracy failed, retrying with Lowest...", err);
        try {
             location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest });
        } catch (lowestErr: any) {
             console.log("Lowest accuracy also failed.");
             location = null;
        }
      }

      if (location) {
        const { latitude, longitude } = location.coords;
        console.log(`Native GPS Location found: ${latitude}, ${longitude}`);
        
        // Check if coordinates are valid (not 0, 0 which is invalid/null island)
        const isValidLocation = latitude !== 0 || longitude !== 0;
        
        if (isValidLocation && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
          setRegion({
              latitude,
              longitude,
              zoom: 15
          });
          await reverseGeocode(latitude, longitude);
        } else {
          console.log("GPS returned invalid coordinates (0, 0). Trying last known location...");
          // Try to get last known location as fallback
          try {
            const lastKnown = await Location.getLastKnownPositionAsync();
            if (lastKnown && (lastKnown.coords.latitude !== 0 || lastKnown.coords.longitude !== 0)) {
              console.log(`Last known location: ${lastKnown.coords.latitude}, ${lastKnown.coords.longitude}`);
              setRegion({
                latitude: lastKnown.coords.latitude,
                longitude: lastKnown.coords.longitude,
                zoom: 15
              });
              await reverseGeocode(lastKnown.coords.latitude, lastKnown.coords.longitude);
            } else {
              throw new Error("No valid last known location");
            }
          } catch (lastKnownErr) {
            console.log("Last known location also failed. Defaulting to Paris.");
            const defaultLat = 48.8566;
            const defaultLon = 2.3522;
            setRegion({
                latitude: defaultLat,
                longitude: defaultLon,
                zoom: 6
            });
            toast.info("Location Unavailable", "GPS signal not found. Please search for your location or tap on the map.");
          }
        }
      } else {
         console.log("All GPS methods failed. Defaulting to Paris.");
         // Default to Paris, France
         const defaultLat = 48.8566;
         const defaultLon = 2.3522;
         setRegion({
             latitude: defaultLat,
             longitude: defaultLon,
             zoom: 6
         });
         toast.info("Location Unavailable", "GPS signal not found. Please select location manually.");
      }

      setIsGettingLocation(false);
      setIsLoading(false);

    } catch (error: any) {
        console.log("GPS error", error);
        // Default to Paris
         const defaultLat = 48.8566;
         const defaultLon = 2.3522;
         setRegion({
             latitude: defaultLat,
             longitude: defaultLon,
             zoom: 6
         });
         toast.info("Location Unavailable", "GPS signal not found. Please select location manually.");
         setIsGettingLocation(false);
         setIsLoading(false);
    }
  };

  // Removed IP Location function to avoid confusion with incorrect locations

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setIsReverseGeocoding(true);
    try {
      await reverseGeocodeNominatim(lat, lng);
    } catch (error) {
      console.error("Reverse geocode error:", error);
    } finally {
      setIsReverseGeocoding(false);
    }
  }, []);

  const reverseGeocodeNominatim = async (lat: number, lng: number) => {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
            {
              headers: { "User-Agent": "MyAirportApp/1.0" },
            }
          );
          const data = await response.json();
          if (data && data.address) {
            const address = data.address;
            const city = address.city || address.town || address.village || address.municipality || address.county || "";
            
            setSelectedLocation({
              address: data.display_name,
              city: city,
              postcode: address.postcode || "",
              country: address.country || "",
              latitude: lat,
              longitude: lng,
            });
          } else {
             setSelectedLocation({
                address: `Lat: ${lat.toFixed(5)}, Lon: ${lng.toFixed(5)}`,
                city: "Unknown",
                postcode: "",
                country: "",
                latitude: lat,
                longitude: lng,
            });
          }
    } catch(err) {
        console.error("Nominatim Reverse Geocode Error", err);
        setSelectedLocation({
            address: `Lat: ${lat.toFixed(5)}, Lon: ${lng.toFixed(5)}`,
            city: "Pin Location",
            postcode: "",
            country: "",
            latitude: lat,
            longitude: lng,
        });
    }
  };

  // Called when map moves in Leaflet
  const onRegionChange = (newRegion: { latitude: number; longitude: number }) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
        reverseGeocode(newRegion.latitude, newRegion.longitude);
    }, 800);
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      onSelectLocation(selectedLocation);
      onClose();
    } else {
        toast.warning("No Location", "Please select a location on the map.");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Location</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Ionicons name="search" size={20} color="#666" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search address..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
             <TouchableOpacity
              style={styles.searchButton}
              onPress={handleSearch}
              disabled={isSearching}
            >
              {isSearching ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.searchButtonText}>Search</Text>
              )}
            </TouchableOpacity>
          </View>
          {showResults && (
            <View style={styles.searchResults}>
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.searchResultItem}
                  onPress={() => selectSearchResult(item)}
                >
                  <Ionicons name="location-outline" size={18} color="#007AFF" />
                  <Text style={styles.searchResultText} numberOfLines={2}>
                    {item.description}
                  </Text>
                </TouchableOpacity>
              )}
            />
            </View>
          )}
        </View>

        <View style={styles.mapContainer}>
          <LeafletMap
            ref={mapRef}
            mode="picker"
            initialRegion={region}
            onRegionChange={onRegionChange}
            showCenterMarker={true}
          />
           {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text>Loading Map...</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.gpsButton}
          onPress={getMyLocation}
          disabled={isGettingLocation}
        >
          <Ionicons name="navigate" size={22} color="#fff" />
          <Text style={styles.gpsButtonText}>Use My Current Location</Text>
        </TouchableOpacity>


        <View style={styles.bottomPanel}>
          {selectedLocation ? (
            <View style={styles.locationInfo}>
              <View style={{ flex: 1 }}>
                <Text style={styles.locationCity} numberOfLines={1}>
                  {selectedLocation.city || "Selected Location"}
                </Text>
                <Text style={styles.locationAddress} numberOfLines={2}>
                  {selectedLocation.address}
                </Text>
              </View>
              {(isReverseGeocoding || isGettingLocation) && <ActivityIndicator size="small" />}
            </View>
          ) : (
             <View style={styles.locationPlaceholder}>
              <Text style={styles.locationPlaceholderText}>
                {isReverseGeocoding ? "Finding address..." : "Move map to choose location"}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.confirmButton,
              !selectedLocation && styles.confirmButtonDisabled,
            ]}
            onPress={handleConfirm}
            disabled={!selectedLocation || isReverseGeocoding}
          >
            <Ionicons name="checkmark-circle" size={22} color="#fff" />
            <Text style={styles.confirmButtonText}>Confirm Location</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
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
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  searchContainer: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    zIndex: 10,
  },
    searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    paddingLeft: 12,
    paddingRight: 4,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
  },
  searchButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 4,
  },
  searchButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  searchResults: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: "#fff",
    borderRadius: 10,
    maxHeight: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1000,
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    gap: 10,
  },
  searchResultText: {
    flex: 1,
    fontSize: 14,
    color: "#333",
  },
  mapContainer: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
  },
  gpsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#007AFF",
    marginHorizontal: 16,
    marginVertical: 10,
    paddingVertical: 14,
    borderRadius: 12,
    position: 'absolute',
    bottom: 160,
    right: 10,
     elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  gpsButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  bottomPanel: {
    backgroundColor: "#fff",
    paddingBottom: 24, // Extra padding for home bar
    paddingTop: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  locationInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  locationCity: {
    fontSize: 16,
    fontWeight: "bold",
  },
  locationAddress: {
    fontSize: 14,
    color: "gray",
  },
   locationPlaceholder: {
    paddingVertical: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  locationPlaceholderText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
  confirmButton: {
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  confirmButtonDisabled: {
    backgroundColor: "#a0c8f0",
  },
  confirmButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 18,
  },
});