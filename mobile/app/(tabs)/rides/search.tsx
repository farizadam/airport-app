import LeafletMap from "@/components/LeafletMap";
import ProfileAvatar from "@/components/ProfileAvatar";
import { useAirportStore } from "@/store/airportStore";
import { useRideStore } from "@/store/rideStore";
import { useRequestStore } from "@/store/requestStore";
import { Airport } from "@/types";
import api from "@/lib/api";
import MapLocationPicker, { MapLocationData } from "@/components/MapLocationPicker";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "../../../src/store/toastStore";

type SearchStep = "airport" | "location" | "datetime" | "results";

interface SearchResult {
  id: string;
  type: "ride" | "request";
  driverName?: string;
  passengerName?: string;
  pickupLocation: string;
  dropoffLocation: string;
  departureTime: string;
  availableSeats?: number;
  luggageCapacity?: number;
  luggage_left?: number;
  luggageCount?: number;
  passengers?: number;
  pricePerSeat?: number;
  // Driver/passenger details for profile avatar
  driver?: {
    id?: string;
    _id?: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
    rating?: number;
  };
  passenger?: {
    id?: string;
    _id?: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
    rating?: number;
  };
  // For multi-stop route display (A → B → C)
  driverStartLocation?: string;  // Driver's actual start (A)
  driverEndLocation?: string;    // Driver's actual end (C)
  userStopLocation?: string;     // User's pickup/dropoff point (B)
  isIntermediateStop?: boolean;  // True if user's location is not the driver's start/end
  // Coordinates for map display
  startCoords?: { lat: number; lng: number };  // A coordinates
  stopCoords?: { lat: number; lng: number };   // B coordinates (intermediate)
  endCoords?: { lat: number; lng: number };    // C coordinates
  // Direction info for icon display
  direction?: "to_airport" | "from_airport";
}

const INITIAL_AIRPORT_REGION = { latitude: 48.8566, longitude: 2.3522, zoom: 5 };

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ 
    direction?: "to_airport" | "from_airport";
    prefillAirportId?: string;
    prefillDirection?: string;
    prefillDate?: string;
    prefillLocationAddress?: string;
    prefillLocationLat?: string;
    prefillLocationLng?: string;
    autoSearch?: string; // If "true", auto-trigger search and show results
  }>();
  
  const { airports, fetchAirports, isLoading: airportsLoading } = useAirportStore();
  const { rides, searchRides, isLoading: ridesLoading } = useRideStore();
  const { availableRequests, getAvailableRequests, loading: requestsLoading } = useRequestStore();
  
  // Search state
  const [step, setStep] = useState<SearchStep>("airport");
  const [selectedAirport, setSelectedAirport] = useState<Airport | null>(null);
  const [airportSearch, setAirportSearch] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [includeTime, setIncludeTime] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapInitialLocation, setMapInitialLocation] = useState<{ latitude: number; longitude: number } | undefined>(undefined);
  const [searchDirection, setSearchDirection] = useState<"to_airport" | "from_airport">(
    (params.direction || params.prefillDirection || "to_airport") as "to_airport" | "from_airport"
  );
  const [resultFilter, setResultFilter] = useState<"all" | "rides" | "requests">("all");

  // Filter state
  const [filterMinSeats, setFilterMinSeats] = useState("");
  const [filterMinLuggage, setFilterMinLuggage] = useState("");
  const [filterMaxPrice, setFilterMaxPrice] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const hasActiveFilters = filterMinSeats !== "" || filterMinLuggage !== "" || filterMaxPrice !== "";
  const clearFilters = () => { setFilterMinSeats(""); setFilterMinLuggage(""); setFilterMaxPrice(""); };
  
  // Airport Map State
  const [showAirportMap, setShowAirportMap] = useState(false);
  const mapSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Location autocomplete state
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [isLocationInputFocused, setIsLocationInputFocused] = useState(false);
  const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationScrollRef = useRef<ScrollView>(null);

  // Update searchDirection when params change (e.g., navigating from home screen)
  useEffect(() => {
    const newDirection = params.direction || params.prefillDirection;
    if (newDirection && (newDirection === "to_airport" || newDirection === "from_airport")) {
      console.log("[SearchScreen] Direction param changed to:", newDirection);
      setSearchDirection(newDirection);
      // Reset search state when direction changes
      setStep("airport");
      setSelectedAirport(null);
      setAirportSearch("");
      setLocationAddress("");
      setLocationCoords(null);
      setSearchResults([]);
      setResultFilter("all");
    }
  }, [params.direction, params.prefillDirection]);

  // Load airports on mount and handle prefill
  useEffect(() => {
    fetchAirports();
    
    // Cleanup: Clear search results when component unmounts
    return () => {
      setSearchResults([]);
    };
  }, []);

  // Handle Airport Map Region Change
  const handleAirportMapRegionChange = (region: { latitude: number; longitude: number }) => {
    if (mapSearchTimeoutRef.current) {
      clearTimeout(mapSearchTimeoutRef.current);
    }
    
    // Debounce fetch
    mapSearchTimeoutRef.current = setTimeout(() => {
      fetchAirports({
        latitude: region.latitude,
        longitude: region.longitude,
        radius: 200000, // 200km radius search
      });
    }, 500);
  };

  const handleAirportMarkerClick = (id: string) => {
    const airport = airports.find(a => (a._id || a.id) === id);
    if (airport) {
      handleSelectAirport(airport);
      setShowAirportMap(false);
    }
  };

  // Handle prefill parameters when airports are loaded
  useEffect(() => {
    if (airports.length === 0) return;
    
    let shouldAutoSearch = params.autoSearch === "true";
    
    // Prefill airport
    if (params.prefillAirportId) {
      const prefillAirport = airports.find(
        (a: Airport) => (a._id || a.id) === params.prefillAirportId
      );
      if (prefillAirport) {
        setSelectedAirport(prefillAirport);
        setAirportSearch(prefillAirport.name);
      }
    }
    
    // Handle prefill date
    if (params.prefillDate) {
      setSelectedDate(new Date(params.prefillDate));
    }
    
    // Handle prefill direction
    if (params.prefillDirection) {
      setSearchDirection(params.prefillDirection as "to_airport" | "from_airport");
    }
    
    // Handle prefill location
    if (params.prefillLocationAddress) {
      setLocationAddress(params.prefillLocationAddress);
    }
    if (params.prefillLocationLat && params.prefillLocationLng) {
      setLocationCoords({
        lat: parseFloat(params.prefillLocationLat),
        lng: parseFloat(params.prefillLocationLng),
      });
    }
    
    // Auto-search if all required params are provided
    if (shouldAutoSearch && params.prefillAirportId) {
      // Trigger search directly - go to results step
      const runAutoSearch = async () => {
        const prefillAirport = airports.find(
          (a: Airport) => (a._id || a.id) === params.prefillAirportId
        );
        if (!prefillAirport) return;
        
        setSelectedAirport(prefillAirport);
        setIsSearching(true);
        setStep("results");
        
        try {
          const airportId = prefillAirport._id || prefillAirport.id;
          const direction = (params.prefillDirection || "to_airport") as "to_airport" | "from_airport";
          const isToAirportSearch = direction === "to_airport";
          
          // Build query params
          const rideParams = new URLSearchParams();
          rideParams.append("airport_id", airportId);
          rideParams.append("direction", direction);
          
          const requestParams = new URLSearchParams();
          requestParams.append("airport_id", airportId);
          requestParams.append("direction", direction);
          
          // Call APIs directly
          const [ridesResponse, requestsResponse] = await Promise.all([
            api.get(`/rides/search?${rideParams}`),
            api.get(`/ride-requests/available?${requestParams}`),
          ]);
          
          const ridesData = ridesResponse.data.data || ridesResponse.data || [];
          const requestsData = requestsResponse.data.requests || requestsResponse.data.data || [];
          
          console.log("[AutoSearch] Rides found:", ridesData.length);
          console.log("[AutoSearch] Requests found:", requestsData.length);
          
          const results: SearchResult[] = [];
          
          // Process rides
          if (Array.isArray(ridesData)) {
            ridesData.forEach((ride: any) => {
              if (ride.driver) {
                console.log("[API] Mapping ride driver:", {
                  driver: ride.driver,
                  driver_id: ride.driver_id,
                  userId: ride.driver.id || ride.driver._id,
                });
              }
              const homeLocation = ride.home_address || ride.home_city || "Home location";
              const airportLocation = prefillAirport.name;
              
              results.push({
                id: ride._id || ride.id,
                type: "ride",
                driverName: ride.driver?.first_name || "Driver",
                driver: ride.driver ? {
                  id: ride.driver.id || ride.driver._id || ride.driver_id || ride.user_id || ride.driver?.user_id || (ride as any).driver_id,
                  _id: ride.driver._id || ride.driver.id || ride.driver_id || ride.user_id || ride.driver?.user_id || (ride as any).driver_id,
                  first_name: ride.driver.first_name,
                  last_name: ride.driver.last_name,
                  avatar_url: ride.driver.avatar_url,
                  rating: ride.driver.rating,
                } : undefined,
                pickupLocation: isToAirportSearch ? homeLocation : airportLocation,
                dropoffLocation: isToAirportSearch ? airportLocation : homeLocation,
                departureTime: ride.departure_datetime || ride.datetime_start,
                availableSeats: ride.available_seats || ride.seats_left || ride.total_seats,
                luggageCapacity: ride.luggage_capacity || 0,
                luggage_left: ride.luggage_left,
                pricePerSeat: ride.price_per_seat,
                direction: direction,
              });
            });
          }
          
          // Process requests
          if (Array.isArray(requestsData)) {
            requestsData.forEach((request: any) => {
              if (request.passenger) {
                console.log("[API] Mapping request passenger:", {
                  passenger: request.passenger,
                  passenger_id: request.passenger_id,
                  userId: request.passenger.id || request.passenger._id,
                });
              }
              const passengerLocation = request.location_address || request.location_city || "Passenger location";
              const airportLocation = prefillAirport.name;
              
              results.push({
                id: request._id,
                type: "request",
                passengerName: request.passenger?.first_name || "Passenger",
                passenger: request.passenger ? {
                  id: request.passenger.id || request.passenger._id || request.passenger_id || request.user_id || request.passenger?.user_id || (request as any).passenger_id,
                  _id: request.passenger._id || request.passenger.id || request.passenger_id || request.user_id || request.passenger?.user_id || (request as any).passenger_id,
                  first_name: request.passenger.first_name,
                  last_name: request.passenger.last_name,
                  avatar_url: request.passenger.avatar_url,
                  rating: request.passenger.rating,
                } : undefined,
                pickupLocation: isToAirportSearch ? passengerLocation : airportLocation,
                dropoffLocation: isToAirportSearch ? airportLocation : passengerLocation,
                departureTime: request.preferred_datetime,
                passengers: request.seats_needed,
                luggageCount: request.luggage_count ?? 0,
                direction: direction,
              });
            });
          }
          
          console.log("[AutoSearch] Total results:", results.length);
          setSearchResults(results);
        } catch (error: any) {
          console.error("Auto-search error:", error.response?.data || error.message);
        }
        setIsSearching(false);
      };
      
      runAutoSearch();
    } else if (params.prefillAirportId && !shouldAutoSearch) {
      // Just prefill but don't auto-search - move to location step
      setStep("location");
    }
  }, [airports, params.prefillAirportId, params.prefillDate, params.prefillDirection, params.prefillLocationAddress, params.autoSearch]);

  const isHuaweiDevice = () => {
    try {
      // @ts-ignore
      return Platform.OS === 'android' && typeof HMSLocation !== 'undefined';
    } catch (e) {
      return false;
    }
  };

  const getHuaweiLocation = async () => {
    return new Promise<Location.LocationObject>((resolve, reject) => {
      try {
        // @ts-ignore
        if (typeof HMSLocation !== 'undefined') {
          // @ts-ignore
          HMSLocation.FusedLocation.getLastLocation()
            .then((location: any) => {
              if (location) {
                resolve({
                  coords: {
                    latitude: location.latitude,
                    longitude: location.longitude,
                    altitude: location.altitude,
                    accuracy: location.accuracy,
                    altitudeAccuracy: location.altitudeAccuracy,
                    heading: location.bearing,
                    speed: location.speed,
                  },
                  timestamp: Date.now(),
                });
              } else {
                reject(new Error("Huawei Location not available"));
              }
            })
            .catch(reject);
        } else {
          reject(new Error("HMS not available"));
        }
      } catch (e) {
        reject(e);
      }
    });
  };

  const handleGetMyLocation = async () => {
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        toast.warning("Permission Denied", "Permission to access location was denied");
        setGettingLocation(false);
        return;
      }

      let location;
      try {
        // Try High accuracy first
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
      } catch (err) {
        console.log("High accuracy failed, retrying with Balanced...", err);
        // Fallback to Balanced for non-GMS devices
        try {
          location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
        } catch (balancedErr) {
           console.log("Balanced location failed");
        }
      }

      if (location) {
          const { latitude, longitude } = location.coords;
          
          // Check if coordinates are valid (not 0, 0 which is null island)
          const isValidLocation = latitude !== 0 || longitude !== 0;
          
          if (isValidLocation && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
            setLocationCoords({ lat: latitude, lng: longitude });
            
            // Reverse geocode
            try {
               const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
                { headers: { "User-Agent": "CovoitAirApp/1.0" } }
              );
              const data = await response.json();
              if (data && data.display_name) {
                 const shortName = data.display_name.split(",").slice(0, 3).join(",");
                 setLocationAddress(shortName);
              } else {
                 setLocationAddress(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
              }
            } catch (geoError) {
               console.log("Reverse geocode failed", geoError);
               setLocationAddress(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
            }
          } else {
            console.log("GPS returned invalid coordinates (0, 0)");
            toast.info("Location Unavailable", "GPS signal not found. Please use the map to select your location or search for an address.");
          }
      } else {
         toast.error("Error", "Could not retrieve location. Please search manually.");
      }

    } catch (error) {
      toast.error("Error", "Could not fetch location");
      console.error(error);
    } finally {
      setGettingLocation(false);
    }
  };


  // Handle location selected from map
  const handleMapLocationSelect = (location: MapLocationData) => {
    setLocationAddress(location.address);
    setLocationCoords({
      lat: location.latitude,
      lng: location.longitude,
    });
    setShowLocationSuggestions(false);
  };

  // Search for location suggestions using Nominatim
  const searchLocationSuggestions = async (query: string) => {
    if (query.length < 2) {
      setLocationSuggestions([]);
      setShowLocationSuggestions(false);
      return;
    }

    setIsSearchingLocation(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`,
        { headers: { "User-Agent": "CovoitAirApp/1.0" } }
      );
      const data = await response.json();
      setLocationSuggestions(data);
      setShowLocationSuggestions(data.length > 0);
      // Keep keyboard open so user can continue typing or see results
    } catch (error) {
      console.error("Location search error:", error);
      setLocationSuggestions([]);
    } finally {
      setIsSearchingLocation(false);
    }
  };

  // Handle location input change with debouncing
  const handleLocationInputChange = (text: string) => {
    setLocationAddress(text);
    setLocationCoords(null); // Clear coords until user selects a suggestion
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Debounce the search
    searchTimeoutRef.current = global.setTimeout(() => {
      searchLocationSuggestions(text);
    }, 500);
  };

  // Handle selecting a location suggestion
  const handleSelectLocationSuggestion = (suggestion: any, openMap: boolean = false) => {
    const displayName = suggestion.display_name;
    const shortName = displayName.split(",").slice(0, 3).join(",");
    
    const lat = parseFloat(suggestion.lat);
    const lng = parseFloat(suggestion.lon);
    
    setLocationAddress(shortName);
    setLocationCoords({ lat, lng });
    setShowLocationSuggestions(false);
    setLocationSuggestions([]);
    Keyboard.dismiss();
    
    // Open map to show/confirm the location
    if (openMap) {
      // Set map location BEFORE opening to ensure it uses correct coords
      setMapInitialLocation({ latitude: lat, longitude: lng });
      // Small delay to let state update
      global.setTimeout(() => {
        setShowMapPicker(true);
      }, 150);
    }
  };

  // Filter airports based on search
  const filteredAirports = airports.filter((airport: Airport) => {
    const searchLower = airportSearch.toLowerCase();
    return (
      airport.name.toLowerCase().includes(searchLower) ||
      airport.iata_code.toLowerCase().includes(searchLower) ||
      airport.city.toLowerCase().includes(searchLower) ||
      airport.country.toLowerCase().includes(searchLower)
    );
  });

  const handleSelectAirport = (airport: Airport) => {
    setSelectedAirport(airport);
    Keyboard.dismiss();
    setStep("location");
  };

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleTimeChange = (event: any, date?: Date) => {
    setShowTimePicker(false);
    if (date) {
      setSelectedDate(date);
      setIncludeTime(true);
    }
  };

  // Calculate distance between two coordinates in kilometers (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleSearch = async () => {
    if (!selectedAirport) return;
    
    setIsSearching(true);
    setStep("results");
    setResultFilter("all"); // Reset filter when new search
    
    try {
      const airportId = selectedAirport._id || selectedAirport.id;
      const isToAirportSearch = searchDirection === "to_airport";
      
      console.log("========================================");
      console.log("[Search] DIRECTION:", searchDirection);
      console.log("[Search] Airport ID:", airportId);
      console.log("========================================");
      
      // Build query params for rides
      const rideParams = new URLSearchParams();
      rideParams.append("airport_id", airportId);
      rideParams.append("direction", searchDirection);
      rideParams.append("date", selectedDate.toISOString().split("T")[0]);
      if (locationCoords) {
        rideParams.append("latitude", locationCoords.lat.toString());
        rideParams.append("longitude", locationCoords.lng.toString());
      }
      
      // Build query params for requests
      const requestParams = new URLSearchParams();
      requestParams.append("airport_id", airportId);
      requestParams.append("direction", searchDirection);
      requestParams.append("date", selectedDate.toISOString().split("T")[0]);
      
      console.log("[Search] Rides API URL:", `/rides/search?${rideParams.toString()}`);
      console.log("[Search] Requests API URL:", `/ride-requests/available?${requestParams.toString()}`);
      
      // Call both APIs separately for better error handling
      let ridesData: any[] = [];
      let requestsData: any[] = [];
      
      // Fetch rides
      try {
        console.log("[Search] Fetching rides...");
        const ridesResponse = await api.get(`/rides/search?${rideParams}`);
        console.log("[Search] Rides response:", JSON.stringify(ridesResponse.data, null, 2));
        ridesData = ridesResponse.data.data || ridesResponse.data || [];
        console.log("[Search] Rides found:", ridesData.length);
      } catch (rideError: any) {
        console.error("[Search] Rides API error:", rideError.response?.data || rideError.message);
      }
      
      // Fetch requests (requires auth - skip silently if not authenticated)
      try {
        const SecureStore = require('expo-secure-store');
        const token = await SecureStore.getItemAsync('accessToken');
        if (token) {
          console.log("[Search] Fetching requests...");
          const requestsResponse = await api.get(`/ride-requests/available?${requestParams}`);
          requestsData = requestsResponse.data.requests || requestsResponse.data.data || [];
          console.log("[Search] Requests found:", requestsData.length);
        } else {
          console.log("[Search] Skipping requests (not authenticated)");
        }
      } catch (requestError: any) {
        console.log("[Search] Requests unavailable:", requestError.response?.status || requestError.message);
      }
      
      // Log the direction of each ride received
      if (ridesData.length > 0) {
        console.log("[Search] Ride directions received:", ridesData.map((r: any) => ({ id: r._id || r.id, direction: r.direction })));
      }
      if (requestsData.length > 0) {
        console.log("[Search] Request directions received:", requestsData.map((r: any) => ({ id: r._id, direction: r.direction })));
      }
      
      // Process results
      const results: SearchResult[] = [];
      const searchDate = new Date(selectedDate);
      
      // Process rides (driver offers)
      if (Array.isArray(ridesData)) {
        ridesData.forEach((ride: any) => {
          const rideDate = new Date(ride.departure_datetime || ride.datetime_start);
          const dayMatch = rideDate.toDateString() === searchDate.toDateString();
          
          // Always filter by date, only add time filter if includeTime is true
          if (dayMatch) {
            const homeLocation = ride.home_address || ride.home_city || "Home location";
            const airportLocation = selectedAirport.name;
            
            // Determine driver's full route (A → C)
            const driverStart = isToAirportSearch ? homeLocation : airportLocation;
            const driverEnd = isToAirportSearch ? airportLocation : homeLocation;
            
            // User's search location (B) - where they want to be picked up/dropped off
            const userSearchLocation = locationAddress || null;
            
            // Get coordinates for distance calculation
            const userLat = locationCoords?.lat;
            const userLng = locationCoords?.lng;
            const driverHomeLat = ride.home_latitude;
            const driverHomeLng = ride.home_longitude;
            const airportLat = selectedAirport.latitude;
            const airportLng = selectedAirport.longitude;
            
            // Calculate distance to determine if it's an intermediate stop
            // For "to_airport": compare user location (B) with driver's home (A)
            // For "from_airport": compare user location (B) with driver's home (C)
            let isIntermediate = false;
            const MIN_DISTANCE_KM = 20; // Only show as intermediate if > 20km away
            
            if (userSearchLocation && userLat && userLng) {
              if (isToAirportSearch && driverHomeLat && driverHomeLng) {
                // To airport: check distance from user (B) to driver's home (A)
                const distanceFromStart = calculateDistance(userLat, userLng, driverHomeLat, driverHomeLng);
                isIntermediate = distanceFromStart > MIN_DISTANCE_KM;
                console.log(`[Distance] User to Driver Home: ${distanceFromStart.toFixed(1)}km, isIntermediate: ${isIntermediate}`);
              } else if (!isToAirportSearch && driverHomeLat && driverHomeLng) {
                // From airport: check distance from user (B) to driver's home (C)
                const distanceFromEnd = calculateDistance(userLat, userLng, driverHomeLat, driverHomeLng);
                isIntermediate = distanceFromEnd > MIN_DISTANCE_KM;
                console.log(`[Distance] User to Driver Home: ${distanceFromEnd.toFixed(1)}km, isIntermediate: ${isIntermediate}`);
              }
            }
            
            results.push({
              id: ride._id || ride.id,
              type: "ride",
              driverName: ride.driver?.first_name || "Driver",
              driver: ride.driver ? {
                id: ride.driver.id || ride.driver._id || ride.driver_id || ride.user_id || ride.driver?.user_id || (ride as any).driver_id,
                _id: ride.driver._id || ride.driver.id || ride.driver_id || ride.user_id || ride.driver?.user_id || (ride as any).driver_id,
                first_name: ride.driver.first_name,
                last_name: ride.driver.last_name,
                avatar_url: ride.driver.avatar_url,
                rating: ride.driver.rating,
              } : undefined,
              // Simple pickup/dropoff for basic display
              pickupLocation: isToAirportSearch ? (userSearchLocation || homeLocation) : airportLocation,
              dropoffLocation: isToAirportSearch ? airportLocation : (userSearchLocation || homeLocation),
              departureTime: ride.departure_datetime || ride.datetime_start,
              availableSeats: ride.available_seats || ride.seats_left || ride.total_seats,
              luggageCapacity: ride.luggage_capacity || 0,
              luggage_left: ride.luggage_left,
              pricePerSeat: ride.price_per_seat,
              // Multi-stop route info - only show if distance > 20km
              driverStartLocation: driverStart,
              driverEndLocation: driverEnd,
              userStopLocation: isIntermediate ? userSearchLocation : undefined,
              isIntermediateStop: isIntermediate,
              direction: searchDirection,
              // Coordinates for map
              startCoords: isToAirportSearch 
                ? (driverHomeLat && driverHomeLng ? { lat: driverHomeLat, lng: driverHomeLng } : undefined)
                : (airportLat && airportLng ? { lat: airportLat, lng: airportLng } : undefined),
              stopCoords: isIntermediate && userLat && userLng ? { lat: userLat, lng: userLng } : undefined,
              endCoords: isToAirportSearch
                ? (airportLat && airportLng ? { lat: airportLat, lng: airportLng } : undefined)
                : (driverHomeLat && driverHomeLng ? { lat: driverHomeLat, lng: driverHomeLng } : undefined),
            });
          }
        });
      }
      
      // Process requests (passenger requests)
      if (Array.isArray(requestsData)) {
        requestsData.forEach((request: any) => {
          const requestDate = new Date(request.preferred_datetime);
          const dayMatch = requestDate.toDateString() === searchDate.toDateString();
          
          // Always filter by date, only add time filter if includeTime is true
          if (dayMatch) {
            const passengerLocation = request.location_address || request.location_city || "Passenger location";
            const airportLocation = selectedAirport.name;
            
            // User's search location - where the driver (you) is searching from
            const userSearchLocation = locationAddress || null;
            
            // Get coordinates for distance calculation
            const userLat = locationCoords?.lat;
            const userLng = locationCoords?.lng;
            const passengerLat = request.location_latitude;
            const passengerLng = request.location_longitude;
            const airportLat = selectedAirport.latitude;
            const airportLng = selectedAirport.longitude;
            
            // Determine the request's route (passenger's start → end)
            const requestStart = isToAirportSearch ? passengerLocation : airportLocation;
            const requestEnd = isToAirportSearch ? airportLocation : passengerLocation;
            
            // Calculate distance to determine if user's location is an intermediate stop
            // For "to_airport": compare user location with passenger's location (start)
            // For "from_airport": compare user location with passenger's location (end)
            let isIntermediate = false;
            const MIN_DISTANCE_KM = 20; // Only show as intermediate if > 20km away
            
            if (userSearchLocation && userLat && userLng && passengerLat && passengerLng) {
              const distanceFromPassenger = calculateDistance(userLat, userLng, passengerLat, passengerLng);
              isIntermediate = distanceFromPassenger > MIN_DISTANCE_KM;
              console.log(`[Distance] User to Passenger: ${distanceFromPassenger.toFixed(1)}km, isIntermediate: ${isIntermediate}`);
            }
            
            results.push({
              id: request._id,
              type: "request",
              passengerName: request.passenger?.first_name || "Passenger",
              passenger: request.passenger ? {
                id: request.passenger.id || request.passenger._id || request.passenger_id || request.user_id || request.passenger?.user_id || (request as any).passenger_id,
                _id: request.passenger._id || request.passenger.id || request.passenger_id || request.user_id || request.passenger?.user_id || (request as any).passenger_id,
                first_name: request.passenger.first_name,
                last_name: request.passenger.last_name,
                avatar_url: request.passenger.avatar_url,
                rating: request.passenger.rating,
              } : undefined,
              pickupLocation: isToAirportSearch ? passengerLocation : airportLocation,
              dropoffLocation: isToAirportSearch ? airportLocation : passengerLocation,
              departureTime: request.preferred_datetime,
              passengers: request.seats_needed,
              luggageCount: request.luggage_count ?? 0,
              direction: searchDirection,
              // Multi-stop route info - only show if distance > 20km
              driverStartLocation: isIntermediate ? userSearchLocation : undefined,
              driverEndLocation: requestEnd,
              userStopLocation: isIntermediate ? requestStart : undefined,
              isIntermediateStop: isIntermediate,
              // Coordinates for map
              startCoords: isToAirportSearch
                ? (passengerLat && passengerLng ? { lat: passengerLat, lng: passengerLng } : undefined)
                : (airportLat && airportLng ? { lat: airportLat, lng: airportLng } : undefined),
              stopCoords: isIntermediate && userLat && userLng ? { lat: userLat, lng: userLng } : undefined,
              endCoords: isToAirportSearch
                ? (airportLat && airportLng ? { lat: airportLat, lng: airportLng } : undefined)
                : (passengerLat && passengerLng ? { lat: passengerLat, lng: passengerLng } : undefined),
            });
          }
        });
      }
      
      console.log("[Search] Total results:", results.length);
      setSearchResults(results);
    } catch (error: any) {
      console.error("Search error:", error.response?.data || error.message);
      toast.error("Error", "Failed to search. Please try again.");
    }
    
    setIsSearching(false);
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      time: date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }),
    };
  };

  const isToAirport = searchDirection === "to_airport";
  const themeColor = isToAirport ? "#3B82F6" : "#8B5CF6";
  const themeGradient: [string, string] = isToAirport 
    ? ["#3B82F6", "#2563EB"] 
    : ["#8B5CF6", "#7C3AED"];

  const renderStepIndicator = () => {
    if (step === "results") return null;
    return (
      <View style={styles.stepIndicator}>
        <View style={[styles.stepDot, step === "airport" && { backgroundColor: themeColor }]} />
        <View style={[styles.stepLine, (step === "location" || step === "datetime") && { backgroundColor: themeColor }]} />
        <View style={[styles.stepDot, (step === "location" || step === "datetime") && { backgroundColor: themeColor }]} />
        <View style={[styles.stepLine, step === "datetime" && { backgroundColor: themeColor }]} />
        <View style={[styles.stepDot, step === "datetime" && { backgroundColor: themeColor }]} />
      </View>
    );
  };

  const renderAirportStep = () => (
    <FlatList
      data={airportsLoading ? [] : filteredAirports}
      keyExtractor={(item) => item._id || item.id || String(Math.random())}
      style={styles.stepContent}
      contentContainerStyle={{ paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={20}
      maxToRenderPerBatch={30}
      windowSize={10}
      ListHeaderComponent={
        <>
          <Text style={styles.stepTitle}>
            {isToAirport ? "Which airport are you flying from?" : "Which airport did you land at?"}
          </Text>
          <View style={{flexDirection: 'row', gap: 10, marginBottom: 16}}>
            <View style={[styles.searchInputContainer, {flex: 1, marginBottom: 0}]}>
              <Ionicons name="search" size={20} color="#64748B" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search airports..."
                value={airportSearch}
                onChangeText={setAirportSearch}
                placeholderTextColor="#94A3B8"
              />
              {airportSearch.length > 0 && (
                <TouchableOpacity onPress={() => setAirportSearch("")}>
                  <Ionicons name="close-circle" size={20} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity 
              style={{
                backgroundColor: '#fff', 
                width: 50, 
                borderRadius: 12, 
                justifyContent: 'center', 
                alignItems: 'center',
                borderWidth: 1,
                borderColor: '#E2E8F0'
              }}
              onPress={() => setShowAirportMap(true)}
            >
              <Ionicons name="map-outline" size={24} color={themeColor} />
            </TouchableOpacity>
          </View>
          {airportsLoading && <ActivityIndicator size="large" color={themeColor} style={styles.loader} />}
        </>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.airportItem}
          onPress={() => handleSelectAirport(item)}
        >
          <View style={[styles.airportCodeBadge, { backgroundColor: themeColor + "20" }]}>
            <Text style={[styles.airportCode, { color: themeColor }]}>{item.iata_code}</Text>
          </View>
          <View style={styles.airportInfo}>
            <Text style={styles.airportName}>{item.name}</Text>
            <Text style={styles.airportCity}>{item.city}, {item.country}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
        </TouchableOpacity>
      )}
      ListEmptyComponent={
        !airportsLoading ? (
            <View style={styles.emptyList}>
              <Ionicons name="airplane-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyText}>No airports found</Text>
            </View>
        ) : null
      }
    />
  );

  const renderLocationStep = () => (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 120 : 0}
    >
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>
          {isToAirport ? "Where should the driver pick you up?" : "Where do you need to go?"}
        </Text>

        <View style={[styles.selectedAirportBadge, { backgroundColor: themeColor + "15" }]}>
          <Ionicons name="airplane" size={16} color={themeColor} />
          <Text style={styles.selectedAirportText}>
            {selectedAirport?.iata_code} - {selectedAirport?.name}
          </Text>
        </View>

        {/* Search input at TOP - so results are visible above keyboard */}
        <Text style={styles.inputLabel}>ðŸ” Search for your location:</Text>
        <View style={styles.locationSearchContainer}>
          <View style={[styles.manualAddressContainer, showLocationSuggestions && styles.manualAddressContainerActive]}>
            <Ionicons name="search" size={20} color={themeColor} />
            <TextInput
              style={styles.manualAddressInput}
              placeholder="Type city, neighborhood, or address..."
              value={locationAddress}
              onChangeText={handleLocationInputChange}
              onFocus={() => {
                setIsLocationInputFocused(true);
                if (locationSuggestions.length > 0) {
                  setShowLocationSuggestions(true);
                }
              }}
              onBlur={() => setIsLocationInputFocused(false)}
              placeholderTextColor="#94A3B8"
              returnKeyType="search"
            />
            {isSearchingLocation && (
              <ActivityIndicator size="small" color={themeColor} />
            )}
            {!isSearchingLocation && locationAddress.length > 0 && (
              <TouchableOpacity onPress={() => {
                setLocationAddress("");
                setLocationCoords(null);
                setLocationSuggestions([]);
                setShowLocationSuggestions(false);
              }}>
                <Ionicons name="close-circle" size={20} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Location Suggestions Dropdown - positioned for visibility */}
          {showLocationSuggestions && locationSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              {locationSuggestions.map((suggestion, index) => {
                const mainText = suggestion.display_name.split(",")[0];
                const secondaryText = suggestion.display_name.split(",").slice(1, 3).join(",");
                
                return (
                  <View
                    key={suggestion.place_id || index}
                    style={[
                      styles.suggestionItem,
                      index === locationSuggestions.length - 1 && styles.suggestionItemLast
                    ]}
                  >
                    <TouchableOpacity 
                      style={styles.suggestionMainContent}
                      onPress={() => handleSelectLocationSuggestion(suggestion, false)}
                    >
                      <View style={styles.suggestionIcon}>
                        <Ionicons name="location" size={18} color={themeColor} />
                      </View>
                      <View style={styles.suggestionTextContainer}>
                        <Text style={styles.suggestionMainText} numberOfLines={1}>{mainText}</Text>
                        <Text style={styles.suggestionSecondaryText} numberOfLines={1}>{secondaryText}</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.viewOnMapButton}
                      onPress={() => handleSelectLocationSuggestion(suggestion, true)}
                    >
                      <Ionicons name="map-outline" size={18} color={themeColor} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Show selected location with coordinates */}
        {locationCoords && locationCoords.lat !== 0 && (
          <View style={styles.selectedLocationBadge}>
            <Ionicons name="checkmark-circle" size={18} color="#3B82F6" />
            <Text style={styles.selectedLocationText}>Location confirmed</Text>
            <TouchableOpacity 
              style={styles.viewOnMapLink}
              onPress={() => {
                setMapInitialLocation({ latitude: locationCoords.lat, longitude: locationCoords.lng });
                global.setTimeout(() => setShowMapPicker(true), 100);
              }}
            >
              <Text style={[styles.viewOnMapLinkText, { color: themeColor }]}>View on map</Text>
              <Ionicons name="open-outline" size={14} color={themeColor} />
            </TouchableOpacity>
          </View>
        )}

        {/* Other options - shown below when not typing */}
        {!showLocationSuggestions && (
          <>
            <View style={[styles.orDivider, { marginTop: 20 }]}>
              <View style={styles.dividerLine} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.locationPickerContainer}>
              {/* Use My Location Button */}
              <TouchableOpacity
                style={[styles.useLocationButton, { borderColor: themeColor }]}
                onPress={handleGetMyLocation}
                disabled={gettingLocation}
              >
                {gettingLocation ? (
                  <ActivityIndicator size="small" color={themeColor} />
                ) : (
                  <Ionicons name="navigate" size={20} color={themeColor} />
                )}
                <Text style={[styles.useLocationButtonText, { color: themeColor }]}>
                  {gettingLocation ? "Getting location..." : "Use My Current Location"}
                </Text>
              </TouchableOpacity>

              {/* Pick on Map Button */}
              <TouchableOpacity
                style={styles.mapPickerButton}
                onPress={() => setShowMapPicker(true)}
              >
                <Ionicons name="map" size={20} color="#64748B" />
                <Text style={styles.mapPickerButtonText}>Pick Location on Map</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.locationHint}>
              ðŸ’¡ Select a suggestion or use the buttons above
            </Text>
          </>
        )}

        <View style={[styles.stepNavigation, showLocationSuggestions && { marginTop: 16 }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              setShowLocationSuggestions(false);
              Keyboard.dismiss();
              setStep("airport");
            }}
          >
            <Ionicons name="arrow-back" size={20} color="#64748B" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.nextButton, { backgroundColor: themeColor }]}
            onPress={() => {
              setShowLocationSuggestions(false);
              Keyboard.dismiss();
              setStep("datetime");
            }}
          >
            <Text style={styles.nextButtonText}>Next</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );

  const renderDateTimeStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>When do you need the ride?</Text>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Ionicons name="airplane" size={18} color={themeColor} />
          <Text style={styles.summaryText}>{selectedAirport?.name}</Text>
        </View>
        {locationAddress ? (
          <View style={styles.summaryRow}>
            <Ionicons name="location" size={18} color={themeColor} />
            <Text style={styles.summaryText} numberOfLines={1}>{locationAddress}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.dateTimeSection}>
        {/* Date Picker */}
        <TouchableOpacity
          style={styles.dateTimeButton}
          onPress={() => setShowDatePicker(true)}
        >
          <View style={[styles.dateTimeIconContainer, { backgroundColor: themeColor + "15" }]}>
            <Ionicons name="calendar" size={24} color={themeColor} />
          </View>
          <View style={styles.dateTimeTextContainer}>
            <Text style={styles.dateTimeLabel}>Date *</Text>
            <Text style={styles.dateTimeValue}>
              {selectedDate.toLocaleDateString("en-US", { 
                weekday: "short", 
                month: "short", 
                day: "numeric" 
              })}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
        </TouchableOpacity>

        {/* Time Picker (Optional) */}
        <TouchableOpacity
          style={styles.dateTimeButton}
          onPress={() => setShowTimePicker(true)}
        >
          <View style={[styles.dateTimeIconContainer, { backgroundColor: includeTime ? themeColor + "15" : "#F1F5F9" }]}>
            <Ionicons name="time" size={24} color={includeTime ? themeColor : "#94A3B8"} />
          </View>
          <View style={styles.dateTimeTextContainer}>
            <Text style={styles.dateTimeLabel}>Time (optional)</Text>
            <Text style={[styles.dateTimeValue, !includeTime && styles.dateTimeOptional]}>
              {includeTime 
                ? selectedDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })
                : "Any time (±4h flexibility)"}
            </Text>
          </View>
          {includeTime && (
            <TouchableOpacity onPress={() => setIncludeTime(false)}>
              <Ionicons name="close-circle" size={20} color="#94A3B8" />
            </TouchableOpacity>
          )}
          {!includeTime && <Ionicons name="chevron-forward" size={20} color="#94A3B8" />}
        </TouchableOpacity>

        <Text style={styles.timeNote}>
          ðŸ’¡ Leaving time optional will show rides within Â±4 hours of the entire day
        </Text>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleTimeChange}
        />
      )}

      <View style={styles.stepNavigation}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setStep("location")}
        >
          <Ionicons name="arrow-back" size={20} color="#64748B" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.searchButton, { backgroundColor: themeColor }]}
          onPress={handleSearch}
        >
          <Ionicons name="search" size={20} color="#fff" />
          <Text style={styles.searchButtonText}>Search Rides</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderResultsStep = () => {
    if (isSearching) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColor} />
          <Text style={styles.loadingText}>Searching for rides...</Text>
        </View>
      );
    }

    return (
      <View style={styles.stepContent}>
        {/* Search Summary */}
        <View style={styles.resultsSummary}>
          <View style={styles.summaryRow}>
            <Ionicons name="airplane" size={16} color={themeColor} />
            <Text style={styles.summaryText}>{selectedAirport?.name}</Text>
          </View>
          {locationAddress ? (
            <View style={styles.summaryRow}>
              <Ionicons name="location" size={16} color={themeColor} />
              <Text style={styles.summaryText}>{locationAddress}</Text>
            </View>
          ) : null}
          <View style={styles.summaryRow}>
            <Ionicons name="calendar" size={16} color={themeColor} />
            <Text style={styles.summaryText}>
              {selectedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              {includeTime && ` at ${selectedDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}`}
            </Text>
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterTabs}>
          <TouchableOpacity
            style={[
              styles.filterTab,
              resultFilter === "all" && styles.filterTabActive,
              resultFilter === "all" && { borderColor: themeColor }
            ]}
            onPress={() => setResultFilter("all")}
          >
            <Ionicons name="apps" size={16} color={resultFilter === "all" ? themeColor : "#64748B"} />
            <Text style={[styles.filterTabText, resultFilter === "all" && { color: themeColor }]}>
              All ({searchResults.length})
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filterTab,
              resultFilter === "rides" && styles.filterTabActive,
              resultFilter === "rides" && { borderColor: "#3B82F6" }
            ]}
            onPress={() => setResultFilter("rides")}
          >
            <Ionicons name="car" size={16} color={resultFilter === "rides" ? "#3B82F6" : "#64748B"} />
            <Text style={[styles.filterTabText, resultFilter === "rides" && { color: "#3B82F6" }]}>
              Offers ({searchResults.filter(r => r.type === "ride").length})
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filterTab,
              resultFilter === "requests" && styles.filterTabActive,
              resultFilter === "requests" && { borderColor: "#8B5CF6" }
            ]}
            onPress={() => setResultFilter("requests")}
          >
            <Ionicons name="hand-right" size={16} color={resultFilter === "requests" ? "#8B5CF6" : "#64748B"} />
            <Text style={[styles.filterTabText, resultFilter === "requests" && { color: "#8B5CF6" }]}>
              Requests ({searchResults.filter(r => r.type === "request").length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Filter Bar */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setShowFilters(!showFilters)}
          style={{ backgroundColor: '#F8FAFC', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: hasActiveFilters ? themeColor : '#E2E8F0' }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="options-outline" size={16} color={hasActiveFilters ? themeColor : '#64748B'} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: hasActiveFilters ? themeColor : '#334155' }}>
                {hasActiveFilters ? 'Filters active' : 'Filter results'}
              </Text>
              {hasActiveFilters && (
                <View style={{ backgroundColor: themeColor, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, marginLeft: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>
                    {[filterMinSeats, filterMinLuggage, filterMaxPrice].filter(Boolean).length}
                  </Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {hasActiveFilters && (
                <TouchableOpacity onPress={(e) => { e.stopPropagation(); clearFilters(); }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: themeColor }}>Clear</Text>
                </TouchableOpacity>
              )}
              <Ionicons name={showFilters ? 'chevron-up' : 'chevron-down'} size={16} color='#94A3B8' />
            </View>
          </View>
        </TouchableOpacity>
        {showFilters && (
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '600', marginBottom: 3 }}>Min Seats</Text>
              <TextInput
                style={{ backgroundColor: '#fff', borderWidth: 1.5, borderColor: filterMinSeats ? themeColor : '#E2E8F0', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontSize: 14, color: '#1E293B', textAlign: 'center', fontWeight: '600' }}
                value={filterMinSeats}
                onChangeText={setFilterMinSeats}
                keyboardType="number-pad"
                placeholder="Any"
                placeholderTextColor="#9CA3AF"
                maxLength={2}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '600', marginBottom: 3 }}>Min Luggage</Text>
              <TextInput
                style={{ backgroundColor: '#fff', borderWidth: 1.5, borderColor: filterMinLuggage ? themeColor : '#E2E8F0', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontSize: 14, color: '#1E293B', textAlign: 'center', fontWeight: '600' }}
                value={filterMinLuggage}
                onChangeText={setFilterMinLuggage}
                keyboardType="number-pad"
                placeholder="Any"
                placeholderTextColor="#9CA3AF"
                maxLength={2}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '600', marginBottom: 3 }}>Max Price €</Text>
              <TextInput
                style={{ backgroundColor: '#fff', borderWidth: 1.5, borderColor: filterMaxPrice ? themeColor : '#E2E8F0', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontSize: 14, color: '#1E293B', textAlign: 'center', fontWeight: '600' }}
                value={filterMaxPrice}
                onChangeText={setFilterMaxPrice}
                keyboardType="number-pad"
                placeholder="Any"
                placeholderTextColor="#9CA3AF"
                maxLength={4}
              />
            </View>
          </View>
        )}

        {/* Results Count */}
        <Text style={styles.resultsCount}>
          {(() => {
            let filtered = resultFilter === "all" ? searchResults : searchResults.filter(r => resultFilter === "rides" ? r.type === "ride" : r.type === "request");
            if (filterMinSeats) filtered = filtered.filter(r => (r.availableSeats || 0) >= parseInt(filterMinSeats));
            if (filterMinLuggage) filtered = filtered.filter(r => (r.luggageCapacity || 0) >= parseInt(filterMinLuggage));
            if (filterMaxPrice) filtered = filtered.filter(r => (r.pricePerSeat || 0) <= parseFloat(filterMaxPrice));
            return filtered.length;
          })()} {searchResults.length === 1 ? "result" : "results"} found{hasActiveFilters ? ` (of ${searchResults.length})` : ''}
        </Text>

        {/* Results List */}
        {(() => {
          let filteredResults = resultFilter === "all" 
            ? searchResults 
            : searchResults.filter(r => resultFilter === "rides" ? r.type === "ride" : r.type === "request");
          
          // Apply filters
          if (filterMinSeats) {
            const minSeats = parseInt(filterMinSeats);
            if (!isNaN(minSeats)) filteredResults = filteredResults.filter(r => (r.availableSeats || 0) >= minSeats);
          }
          if (filterMinLuggage) {
            const minLuggage = parseInt(filterMinLuggage);
            if (!isNaN(minLuggage)) filteredResults = filteredResults.filter(r => (r.luggageCapacity || 0) >= minLuggage);
          }
          if (filterMaxPrice) {
            const maxPrice = parseFloat(filterMaxPrice);
            if (!isNaN(maxPrice)) filteredResults = filteredResults.filter(r => (r.pricePerSeat || 0) <= maxPrice);
          }
          
          if (filteredResults.length === 0) {
            return (
              <View style={styles.noResults}>
                <Ionicons 
                  name={resultFilter === "rides" ? "car-outline" : resultFilter === "requests" ? "hand-right-outline" : "search-outline"} 
                  size={64} 
                  color="#CBD5E1" 
                />
                <Text style={styles.noResultsTitle}>
                  {resultFilter === "rides" ? "No offers found" : resultFilter === "requests" ? "No requests found" : "No rides found"}
                </Text>
                <Text style={styles.noResultsSubtitle}>
                  {resultFilter !== "all" 
                    ? `Try selecting "All" to see other results`
                    : params.autoSearch === "true"
                      ? "No drivers are available for your route right now. Check back later or try adjusting your search."
                      : "Try adjusting your search criteria or create a request with your search info"}
                </Text>
                {resultFilter === "all" && params.autoSearch !== "true" && (
                  <TouchableOpacity
                    style={[styles.createRequestButton, { backgroundColor: themeColor }]}
                    onPress={() => router.push({
                      pathname: "/(tabs)/requests/create",
                      params: {
                        prefillAirportId: selectedAirport?._id || selectedAirport?.id || "",
                        prefillDirection: searchDirection,
                        prefillDate: selectedDate.toISOString().split("T")[0],
                        prefillLocationAddress: locationAddress || "",
                        prefillLocationLat: locationCoords?.lat ? String(locationCoords.lat) : "",
                        prefillLocationLng: locationCoords?.lng ? String(locationCoords.lng) : "",
                      }
                    })}
                  >
                    <Ionicons name="add" size={20} color="#fff" />
                    <Text style={styles.createRequestButtonText}>Create a Request</Text>
                  </TouchableOpacity>
                )}
                {resultFilter === "all" && params.autoSearch === "true" && (
                  <TouchableOpacity
                    style={[styles.createRequestButton, { backgroundColor: themeColor }]}
                    onPress={() => {
                      // Reset to airport step for new search
                      setStep("airport");
                      setSearchResults([]);
                      setSelectedAirport(null);
                      setLocationAddress("");
                      setLocationCoords(null);
                    }}
                  >
                    <Ionicons name="search" size={20} color="#fff" />
                    <Text style={styles.createRequestButtonText}>Search Again</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }
          
          return (
            <View style={styles.resultsList}>
              {filteredResults.map((result) => {
                const dateTime = formatDateTime(result.departureTime);
                const isRide = result.type === "ride";
                
                // Prepare map markers for this result
                const mapMarkers: Array<{id: string; latitude: number; longitude: number; title?: string; type?: 'ride' | 'request' | 'airport'}> = [];
                const routeCoords: Array<{latitude: number; longitude: number}> = [];
                
                if (result.startCoords) {
                  mapMarkers.push({
                    id: 'start',
                    latitude: result.startCoords.lat,
                    longitude: result.startCoords.lng,
                    title: 'Start',
                    type: 'ride'
                  });
                  routeCoords.push({ latitude: result.startCoords.lat, longitude: result.startCoords.lng });
                }
                if (result.stopCoords && result.isIntermediateStop) {
                  mapMarkers.push({
                    id: 'stop',
                    latitude: result.stopCoords.lat,
                    longitude: result.stopCoords.lng,
                    title: 'Your Stop',
                    type: 'request'
                  });
                  routeCoords.push({ latitude: result.stopCoords.lat, longitude: result.stopCoords.lng });
                }
                if (result.endCoords) {
                  mapMarkers.push({
                    id: 'end',
                    latitude: result.endCoords.lat,
                    longitude: result.endCoords.lng,
                    title: 'End',
                    type: 'airport'
                  });
                  routeCoords.push({ latitude: result.endCoords.lat, longitude: result.endCoords.lng });
                }
                
                // Calculate center for map
                const centerLat = mapMarkers.length > 0 
                  ? mapMarkers.reduce((sum, m) => sum + m.latitude, 0) / mapMarkers.length 
                  : 48.8566;
                const centerLng = mapMarkers.length > 0 
                  ? mapMarkers.reduce((sum, m) => sum + m.longitude, 0) / mapMarkers.length 
                  : 2.3522;
                
                return (
                  <View
                    key={`${result.type}-${result.id}`}
                    style={[
                      styles.resultCard,
                      { 
                        borderLeftWidth: 4,
                        borderLeftColor: isRide ? "#3B82F6" : "#8B5CF6",
                      }
                    ]}
                  >
                  <View style={styles.resultCardHeader}>
                    <View style={[
                      styles.typeBadge, 
                      { 
                        backgroundColor: isRide ? "#DBEAFE" : "#F3E8FF",
                        borderWidth: 1,
                        borderColor: isRide ? "#93C5FD" : "#D8B4FE",
                      }
                    ]}>
                      <Ionicons 
                        name={isRide ? "car" : "hand-right"} 
                        size={14} 
                        color={isRide ? "#3B82F6" : "#8B5CF6"} 
                      />
                      <Text style={[styles.typeBadgeText, { color: isRide ? "#2563EB" : "#7C3AED" }]}>
                        {isRide ? "OFFER" : "REQUEST"}
                      </Text>
                    </View>
                    {isRide && result.pricePerSeat && (
                      <View style={styles.priceTag}>
                        <Text style={styles.priceText}>€{result.pricePerSeat}/seat</Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity 
                    style={styles.resultUserInfo}
                    onPress={() => {
                      let userId;
                      let driverObj, passengerObj;
                      
                      if (isRide && result.driver) {
                        driverObj = result.driver;
                        console.log("[Profile] Driver object:", JSON.stringify(driverObj, null, 2));
                        // Try multiple ways to extract the ID
                        userId = driverObj.id || driverObj._id;
                        // If still not a string, try stringifying just the ID part
                        if (userId && typeof userId === 'object') {
                          userId = userId._id || userId.id || String(userId);
                        }
                        if (userId) {
                          userId = String(userId).trim();
                        }
                      } else if (!isRide && result.passenger) {
                        passengerObj = result.passenger;
                        console.log("[Profile] Passenger object:", JSON.stringify(passengerObj, null, 2));
                        userId = passengerObj.id || passengerObj._id;
                        if (userId && typeof userId === 'object') {
                          userId = userId._id || userId.id || String(userId);
                        }
                        if (userId) {
                          userId = String(userId).trim();
                        }
                      }
                      
                      console.log("[Profile] Final userId:", userId, "Type:", typeof userId);
                      
                      if (userId && userId !== "[object Object]") {
                        console.log("[Profile] Navigating to user profile with ID:", userId);
                        router.push({ pathname: "/user-profile/[id]", params: { id: userId } });
                      } else {
                        console.log("[Profile] ❌ Cannot extract valid userId");
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    {isRide && result.driver ? (
                      <ProfileAvatar
                        userId={result.driver.id || result.driver._id}
                        firstName={result.driver.first_name}
                        lastName={result.driver.last_name}
                        avatarUrl={result.driver.avatar_url}
                        rating={result.driver.rating}
                        size="small"
                        showRating
                        disabled
                      />
                    ) : !isRide && result.passenger ? (
                      <ProfileAvatar
                        userId={result.passenger.id || result.passenger._id}
                        firstName={result.passenger.first_name}
                        lastName={result.passenger.last_name}
                        avatarUrl={result.passenger.avatar_url}
                        rating={result.passenger.rating}
                        size="small"
                        showRating
                        disabled
                      />
                    ) : (
                      <View style={[
                        styles.resultAvatar,
                        { backgroundColor: isRide ? "#DBEAFE" : "#F3E8FF" }
                      ]}>
                        <Ionicons 
                          name={isRide ? "person" : "person-outline"} 
                          size={18} 
                          color={isRide ? "#3B82F6" : "#8B5CF6"} 
                        />
                      </View>
                    )}
                    <View style={{ marginLeft: 10 }}>
                      <Text style={styles.resultUserLabel}>
                        {isRide ? "Driver" : "Passenger"}
                      </Text>
                      <Text style={styles.resultUserName}>
                        {isRide ? result.driverName : result.passengerName}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Route and Details - Touchable for navigation */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      if (isRide) {
                        const navParams: any = { id: result.id };
                        if (locationCoords && locationAddress) {
                          navParams.pickupLat = locationCoords.lat;
                          navParams.pickupLng = locationCoords.lng;
                          navParams.pickupAddress = locationAddress;
                        }
                        router.push({
                          pathname: '/(tabs)/rides/[id]',
                          params: navParams
                        });
                      } else {
                        router.push({
                          pathname: '/request-details/[id]',
                          params: { id: result.id }
                        });
                      }
                    }}
                  >
                    {/* Route Display with TripCard Style */}
                    <View style={styles.resultRoute}>
                    {/* Show multi-stop route A → B → C if location is intermediate (>20km) */}
                    {result.isIntermediateStop && result.userStopLocation ? (
                      <>
                        {/* A - Start location */}
                        <View style={styles.routePointSimple}>
                          <View style={[styles.iconContainerSmall, { 
                            backgroundColor: (result.direction || "to_airport") === "to_airport" ? "#D1FAE5" : "#DBEAFE" 
                          }]}>
                            <Ionicons 
                              name={(result.direction || "to_airport") === "to_airport" ? "location-sharp" : "airplane"} 
                              size={14} 
                              color={(result.direction || "to_airport") === "to_airport" ? "#10B981" : "#3B82F6"} 
                            />
                          </View>
                          <Text style={styles.routeTextSmall} numberOfLines={1}>
                            {result.driverStartLocation}
                          </Text>
                        </View>
                        
                        {/* Connector */}
                        <View style={styles.routeLineContainerSmall}>
                          <View style={{ width: 2, height: 12, backgroundColor: '#CBD5E1' }} />
                          <Ionicons name="chevron-down" size={12} color="#CBD5E1" style={{ marginTop: -2 }} />
                        </View>
                        
                        {/* B - Intermediate stop (highlighted) */}
                        <View style={[styles.routePointSimple, { backgroundColor: '#FEF3C7', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, marginHorizontal: -8 }]}>
                          <View style={[styles.iconContainerSmall, { backgroundColor: "#FCD34D", borderWidth: 2, borderColor: "#F59E0B" }]}>
                            <Text style={{ fontSize: 9, fontWeight: "700", color: "#92400E" }}>●</Text>
                          </View>
                          <Text style={[styles.routeTextSmall, { fontWeight: "600", color: "#92400E" }]} numberOfLines={1}>
                            📍 {result.userStopLocation}
                          </Text>
                        </View>
                        
                        {/* Connector */}
                        <View style={styles.routeLineContainerSmall}>
                          <View style={{ width: 2, height: 12, backgroundColor: '#CBD5E1' }} />
                          <Ionicons name="chevron-down" size={12} color="#CBD5E1" style={{ marginTop: -2 }} />
                        </View>
                        
                        {/* C - End location */}
                        <View style={styles.routePointSimple}>
                          <View style={[styles.iconContainerSmall, { 
                            backgroundColor: (result.direction || "to_airport") === "to_airport" ? "#DBEAFE" : "#D1FAE5" 
                          }]}>
                            <Ionicons 
                              name={(result.direction || "to_airport") === "to_airport" ? "airplane" : "location-sharp"} 
                              size={14} 
                              color={(result.direction || "to_airport") === "to_airport" ? "#3B82F6" : "#10B981"} 
                            />
                          </View>
                          <Text style={styles.routeTextSmall} numberOfLines={1}>
                            {result.driverEndLocation}
                          </Text>
                        </View>
                      </>
                    ) : (
                      <>
                        {/* Simple A → B route */}
                        <View style={styles.routePointSimple}>
                          <View style={[styles.iconContainerSmall, { 
                            backgroundColor: (result.direction || "to_airport") === "to_airport" ? "#D1FAE5" : "#DBEAFE" 
                          }]}>
                            <Ionicons 
                              name={(result.direction || "to_airport") === "to_airport" ? "location-sharp" : "airplane"} 
                              size={14} 
                              color={(result.direction || "to_airport") === "to_airport" ? "#10B981" : "#3B82F6"} 
                            />
                          </View>
                          <Text style={styles.routeTextSmall} numberOfLines={1}>{result.pickupLocation}</Text>
                        </View>
                        
                        {/* Connector */}
                        <View style={styles.routeLineContainerSmall}>
                          <View style={{ width: 2, height: 12, backgroundColor: '#CBD5E1' }} />
                          <Ionicons name="chevron-down" size={12} color="#CBD5E1" style={{ marginTop: -2 }} />
                        </View>
                        
                        <View style={styles.routePointSimple}>
                          <View style={[styles.iconContainerSmall, { 
                            backgroundColor: (result.direction || "to_airport") === "to_airport" ? "#DBEAFE" : "#D1FAE5" 
                          }]}>
                            <Ionicons 
                              name={(result.direction || "to_airport") === "to_airport" ? "airplane" : "location-sharp"} 
                              size={14} 
                              color={(result.direction || "to_airport") === "to_airport" ? "#3B82F6" : "#10B981"} 
                            />
                          </View>
                          <Text style={styles.routeTextSmall} numberOfLines={1}>{result.dropoffLocation}</Text>
                        </View>
                      </>
                    )}
                  </View>

                  <View style={styles.resultFooter}>
                    <View style={styles.resultDateTime}>
                      <Ionicons name="calendar-outline" size={14} color="#64748B" />
                      <Text style={styles.resultDateTimeText}>{dateTime.date}</Text>
                      <Ionicons name="time-outline" size={14} color="#64748B" style={{ marginLeft: 8 }} />
                      <Text style={styles.resultDateTimeText}>{dateTime.time}</Text>
                    </View>
                    <View style={styles.resultSeats}>
                      <Ionicons name="people-outline" size={14} color="#64748B" />
                      <Text style={styles.resultSeatsText}>
                        {isRide ? `${result.availableSeats} seats` : `${result.passengers} pax`}
                      </Text>
                    </View>
                    <View style={styles.resultSeats}>
                      <Ionicons name="briefcase-outline" size={14} color="#64748B" />
                      <Text style={styles.resultSeatsText}>
                        {isRide
                          ? `${(result.luggageCapacity ?? 0) - (result.luggage_left ?? result.luggageCapacity ?? 0)}/${result.luggageCapacity ?? 0} bags`
                          : `${result.luggageCount ?? 0} bag(s)`}
                      </Text>
                    </View>
                  </View>
                  </TouchableOpacity>

                  {/* Action Button */}
                  <TouchableOpacity
                    style={[
                      styles.resultActionButton,
                      { backgroundColor: isRide ? "#3B82F6" : "#8B5CF6" }
                    ]}
                    onPress={() => {
                      if (isRide) {
                        const navParams: any = { id: result.id };
                        if (locationCoords && locationAddress) {
                          navParams.pickupLat = locationCoords.lat;
                          navParams.pickupLng = locationCoords.lng;
                          navParams.pickupAddress = locationAddress;
                        }
                        router.push({
                          pathname: '/(tabs)/rides/[id]',
                          params: navParams
                        });
                      } else {
                        router.push({
                          pathname: '/request-details/[id]',
                          params: { id: result.id }
                        });
                      }
                    }}
                  >
                    <Ionicons 
                      name={isRide ? "checkmark-circle" : "car"} 
                      size={18} 
                      color="#fff" 
                    />
                    <Text style={styles.resultActionButtonText}>
                      {isRide ? "Book This Ride" : "Offer a Ride"}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
          );
        })()}

        {/* New Search Button */}
        <TouchableOpacity
          style={styles.newSearchButton}
          onPress={() => {
            setStep("airport");
            setSelectedAirport(null);
            setLocationAddress("");
            setSearchResults([]);
          }}
        >
          <Ionicons name="refresh" size={18} color={themeColor} />
          <Text style={[styles.newSearchButtonText, { color: themeColor }]}>New Search</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient
        colors={themeGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => {
            if (step === "results") {
              setStep("datetime");
            } else if (step === "datetime") {
              setStep("location");
            } else if (step === "location") {
              setStep("airport");
            } else {
              // On airport step - go back to previous screen
              router.back();
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Ionicons 
            name={isToAirport ? "airplane" : "home"} 
            size={24} 
            color="#fff" 
          />
          <Text style={styles.headerTitle}>
            {step === "results" 
              ? `Results for ${selectedAirport?.iata_code}`
              : isToAirport ? "Find ride TO Airport" : "Find ride FROM Airport"}
          </Text>
        </View>
      </LinearGradient>

      {/* Step Indicator */}
      {step !== "results" && (
        <View style={styles.stepIndicatorContainer}>
          {renderStepIndicator()}
          <View style={styles.stepLabels}>
            <Text style={[styles.stepLabel, step === "airport" && { color: themeColor, fontWeight: "700" }]}>Airport</Text>
            <Text style={[styles.stepLabel, step === "location" && { color: themeColor, fontWeight: "700" }]}>Location</Text>
            <Text style={[styles.stepLabel, step === "datetime" && { color: themeColor, fontWeight: "700" }]}>When</Text>
          </View>
        </View>
      )}

      {/* Content */}
      {step === 'airport' ? (
        renderAirportStep()
      ) : (
        <ScrollView 
          style={styles.content}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 8 }}
        >
          {step === "location" && renderLocationStep()}
          {step === "datetime" && renderDateTimeStep()}
          {step === "results" && renderResultsStep()}
        </ScrollView>
      )}

      {/* Map Location Picker Modal */}
      <MapLocationPicker
        visible={showMapPicker}
        onClose={() => {
          setShowMapPicker(false);
          setMapInitialLocation(undefined);
        }}
        onSelectLocation={handleMapLocationSelect}
        initialLocation={mapInitialLocation || (locationCoords ? { latitude: locationCoords.lat, longitude: locationCoords.lng } : undefined)}
      />

      {/* Airport Map Modal */}
      <Modal
        visible={showAirportMap}
        animationType="slide"
        onRequestClose={() => setShowAirportMap(false)}
      >
        <View style={{ flex: 1 }}>
          <View style={{ 
            height: 60, 
            backgroundColor: '#fff', 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#E2E8F0',
            paddingTop: Platform.OS === 'ios' ? 10 : 0
          }}>
            <Text style={{ fontSize: 18, fontWeight: '700' }}>Explore Airports</Text>
            <TouchableOpacity onPress={() => setShowAirportMap(false)}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>
          <LeafletMap
            mode="view"
            initialRegion={INITIAL_AIRPORT_REGION} // Default to Europe center
            markers={airports.filter(a => a.latitude != null && a.longitude != null).map(a => ({
              id: a._id || a.id,
              latitude: a.latitude!,
              longitude: a.longitude!,
              title: `${a.iata_code} - ${a.name}`,
              type: 'airport' as const
            }))}
            onMarkerClick={handleAirportMarkerClick}
          />
          {airportsLoading && (
            <View style={{
              position: 'absolute',
              top: 70,
              alignSelf: 'center',
              backgroundColor: 'rgba(255,255,255,0.9)',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
              flexDirection: 'row',
              alignItems: 'center',
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
            }}>
              <ActivityIndicator size="small" color={themeColor} />
              <Text style={{ marginLeft: 8, fontWeight: '500' }}>Updating airports...</Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginLeft: 10,
  },
  stepIndicatorContainer: {
    paddingHorizontal: 40,
    paddingVertical: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#CBD5E1",
  },
  stepLine: {
    flex: 1,
    height: 3,
    backgroundColor: "#CBD5E1",
    marginHorizontal: 4,
  },
  stepLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  stepLabel: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  stepContent: {
    padding: 20,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 20,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#1E293B",
  },
  loader: {
    marginTop: 40,
  },
  airportList: {
    maxHeight: 400,
  },
  airportItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  airportCodeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 12,
  },
  airportCode: {
    fontSize: 14,
    fontWeight: "700",
  },
  airportInfo: {
    flex: 1,
  },
  airportName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
  },
  airportCity: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  emptyList: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: "#94A3B8",
    marginTop: 12,
  },
  selectedAirportBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 20,
  },
  selectedAirportText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
    marginLeft: 8,
  },
  locationPickerContainer: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 10,
    fontWeight: "500",
  },
  manualAddressContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  manualAddressInput: {
    flex: 1,
    fontSize: 15,
    color: "#1E293B",
    marginLeft: 10,
  },
  manualAddressContainerActive: {
    borderColor: "#3B82F6",
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  locationSearchContainer: {
    position: "relative",
    zIndex: 100,
  },
  suggestionsContainer: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "#3B82F6",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginTop: -1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  suggestionMainContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  suggestionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionMainText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
  },
  suggestionSecondaryText: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  viewOnMapButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  selectedLocationBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  selectedLocationText: {
    fontSize: 13,
    color: "#3B82F6",
    fontWeight: "500",
    marginLeft: 6,
    flex: 1,
  },
  viewOnMapLink: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewOnMapLinkText: {
    fontSize: 13,
    fontWeight: "600",
    marginRight: 4,
  },
  locationHint: {
    fontSize: 13,
    color: "#64748B",
    fontStyle: "italic",
    marginTop: 12,
  },
  mapPickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  mapPickerButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#64748B",
    marginLeft: 10,
  },
  stepNavigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 30,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButtonText: {
    fontSize: 15,
    color: "#64748B",
    marginLeft: 6,
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  nextButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    marginRight: 8,
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 13,
    color: "#1E293B",
    marginLeft: 8,
    flex: 1,
  },
  dateTimeSection: {
    marginBottom: 20,
  },
  dateTimeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  dateTimeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  dateTimeTextContainer: {
    flex: 1,
  },
  dateTimeLabel: {
    fontSize: 13,
    color: "#64748B",
  },
  dateTimeValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
    marginTop: 2,
  },
  dateTimeOptional: {
    color: "#94A3B8",
    fontWeight: "400",
  },
  timeNote: {
    fontSize: 13,
    color: "#64748B",
    fontStyle: "italic",
    marginTop: 8,
  },
  searchButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  searchButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    marginLeft: 8,
  },
  // Use My Location Button Styles
  useLocationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#CBD5E1",
    marginBottom: 16,
  },
  useLocationButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#64748B",
    marginLeft: 10,
  },
  orDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  orText: {
    fontSize: 14,
    color: "#94A3B8",
    fontWeight: "600",
    paddingHorizontal: 16,
  },
  // Results Step Styles
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#64748B",
  },
  resultsSummary: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterTabs: {
    flexDirection: "row",
    marginBottom: 10,
    gap: 6,
  },
  filterTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    gap: 3,
  },
  filterTabActive: {
    backgroundColor: "#F8FAFC",
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  resultsCount: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 10,
  },
  noResults: {
    alignItems: "center",
    paddingVertical: 40,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
  },
  noResultsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
    marginTop: 16,
  },
  noResultsSubtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  createRequestButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  createRequestButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    marginLeft: 8,
  },
  resultsList: {
    gap: 12,
  },
  resultCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  resultCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  miniMapContainer: {
    height: 120,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
    backgroundColor: "#F1F5F9",
    position: "relative",
  },
  miniMapOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  mapLegend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "500",
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 5,
  },
  priceTag: {
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  priceText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#3B82F6",
  },
  resultUserInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  resultAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  resultUserName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
  },
  resultUserLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  resultRoute: {
    marginBottom: 14,
    paddingLeft: 4,
  },
  routeSummarySection: {
    marginBottom: 8,
  },
  routeSummaryTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  routePointEnhanced: {
    flexDirection: "row",
    marginBottom: 4,
  },
  routePointLeft: {
    width: 32,
    alignItems: "center",
  },
  routeDotLarge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  routeDotText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  routeConnector: {
    width: 2,
    flex: 1,
    backgroundColor: "#CBD5E1",
    marginVertical: 2,
    minHeight: 20,
  },
  routePointContent: {
    flex: 1,
    paddingLeft: 10,
    paddingBottom: 8,
  },
  routePointHighlight: {
    backgroundColor: "#FEF3C7",
    marginLeft: 8,
    marginRight: -4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  routePointLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  routePointAddress: {
    fontSize: 13,
    color: "#1E293B",
    lineHeight: 18,
  },
  routePoint: {
    flexDirection: "row",
    alignItems: "center",
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  routeText: {
    flex: 1,
    fontSize: 14,
    color: "#1E293B",
  },
  routeLabel: {
    fontSize: 10,
    color: "#94A3B8",
    marginLeft: 8,
    fontWeight: "500",
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: "#CBD5E1",
    marginLeft: 4,
    marginVertical: 4,
  },
  resultFooter: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  resultDateTime: {
    flexDirection: "row",
    alignItems: "center",
  },
  resultDateTimeText: {
    fontSize: 13,
    color: "#64748B",
    marginLeft: 4,
  },
  resultSeats: {
    flexDirection: "row",
    alignItems: "center",
  },
  resultSeatsText: {
    fontSize: 12,
    color: "#64748B",
    marginLeft: 4,
  },
  // TripCard-style route display
  routePointSimple: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainerSmall: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  routeLineContainerSmall: {
    width: 20,
    alignItems: 'center',
    marginRight: 8,
    marginLeft: 0,
  },
  routeTextSmall: {
    fontSize: 13,
    color: "#475569",
    flex: 1,
  },
  resultActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  resultActionButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  newSearchButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    marginTop: 20,
  },
  newSearchButtonText: {
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 8,
  },
});
