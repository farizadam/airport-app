import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import LeafletMap from './LeafletMap';
import { openExternalMap } from '../utils/mapUtils';

const { width } = Dimensions.get('window');

interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
}

interface RideItem {
  _id: string;
  type: 'ride' | 'request' | 'airport';
  pickup_location: LocationData;
  dropoff_location: LocationData;
  price_per_seat?: number;
  available_seats?: number;
  seats_needed?: number;
  driver?: {
    first_name: string;
    last_name: string;
    rating?: number;
  };
  passenger?: {
    first_name: string;
    last_name: string;
    rating?: number;
  };
  departure_datetime?: string;
  preferred_datetime?: string;
}

interface RideMapProps {
  items?: RideItem[]; // Make optional
  routeCoordinates?: Array<{ latitude: number; longitude: number }>; // New prop
  initialRegion?: { latitude: number; longitude: number; zoom?: number };
  onMarkerPress?: (item: RideItem) => void;
  style?: any;
}

export default function RideMap({ items = [], routeCoordinates, initialRegion, onMarkerPress, style }: RideMapProps) {
  const router = useRouter();
  const [selectedItem, setSelectedItem] = useState<RideItem | null>(null);
  const [mapRegion, setMapRegion] = useState(initialRegion);

  // Initial Location Logic (Graceful Fallback)
  useEffect(() => {
    (async () => {
      // Only try if no items to center on AND no route
      if (items.length === 0 && (!routeCoordinates || routeCoordinates.length === 0)) {
        try {
           const { status } = await Location.requestForegroundPermissionsAsync();
           if (status !== 'granted') return;

           let location;
           try { location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }); }
           catch { 
             try { location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }); }
             catch { /* ignore */ }
           }

           if (location) {
             const { latitude, longitude } = location.coords;
             // Check if coordinates are valid (not 0, 0 which is null island)
             const isValidLocation = latitude !== 0 || longitude !== 0;
             
             if (isValidLocation && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
               setMapRegion({
                  latitude,
                  longitude,
                  zoom: 13
               });
             } else {
               console.log("GPS returned invalid coordinates (0, 0). Defaulting to Paris.");
               setMapRegion({
                 latitude: 48.8566,
                 longitude: 2.3522,
                 zoom: 6
               });
             }
           } else {
             throw new Error("Native location failed");
           }
        } catch (e) {
          console.log("Location access failed. Defaulting to Paris.");
          // Default to Paris
          setMapRegion({
            latitude: 48.8566,
            longitude: 2.3522,
            zoom: 6
          });
        }
      }
    })();
  }, [items.length]);

  const mapMarkers = items.map(item => ({
    id: item._id,
    latitude: item.pickup_location.latitude,
    longitude: item.pickup_location.longitude,
    type: item.type as 'ride' | 'request' | 'airport',
    title: item.pickup_location.city || 'Ride'
  }));

  const handleMarkerClick = (id: string) => {
    const item = items.find(i => i._id === id);
    if (item) {
      setSelectedItem(item);
      if (onMarkerPress) onMarkerPress(item);
    }
  };

  const handleMapClick = () => {
    setSelectedItem(null); // Deselect on map click
  };

  const handleOpenDetails = () => {
    if (!selectedItem) return;
    if (selectedItem.type === 'ride') {
      router.push({
        pathname: '/(tabs)/rides/[id]',
        params: { id: selectedItem._id }
      });
    } else {
      router.push({
        pathname: '/request-details/[id]',
        params: { id: selectedItem._id }
      });
    }
  };

  const handleOpenExternalMap = () => {
    if (!selectedItem) return;
    openExternalMap(
      selectedItem.pickup_location.latitude,
      selectedItem.pickup_location.longitude,
      `Pickup: ${selectedItem.pickup_location.city || 'Location'}`
    );
  };

  return (
    <View style={[styles.container, style]}>
      <LeafletMap
        mode="view"
        initialRegion={mapRegion}
        markers={mapMarkers}
        routeCoordinates={routeCoordinates} // Pass route
        onMarkerClick={handleMarkerClick}
        onMapClick={handleMapClick}
      />

      {/* Selected Item Card (replaces Callout) */}
      {selectedItem && (
        <View style={styles.cardContainer}>
          <TouchableOpacity 
            style={styles.card}
            activeOpacity={0.9}
            onPress={handleOpenDetails}
          >
            <View style={styles.cardHeader}>
                <View style={[
                    styles.typeBadge, 
                    selectedItem.type === 'ride' ? styles.rideBadge : styles.requestBadge
                ]}>
                    <Ionicons name={selectedItem.type === 'ride' ? "car" : "person"} size={16} color="white" />
                    <Text style={styles.typeText}>
                        {selectedItem.type === 'ride' ? 'Ride Offer' : 'Ride Request'}
                    </Text>
                </View>
                <Text style={styles.priceText}>
                     {selectedItem.type === 'ride' && selectedItem.price_per_seat 
                        ? `${selectedItem.price_per_seat} EUR` 
                        : 'Request'}
                </Text>
            </View>

            <View style={styles.routeContainer}>
                <View style={styles.routeRow}>
                    <Ionicons name="location" size={16} color="#007AFF" />
                    <Text style={styles.routeText} numberOfLines={1}>
                        {selectedItem.pickup_location.city || 'Origin'}
                    </Text>
                </View>
                <View style={styles.routeLine} />
                <View style={styles.routeRow}>
                    <Ionicons name="flag" size={16} color="#FF9500" />
                    <Text style={styles.routeText} numberOfLines={1}>
                        {selectedItem.dropoff_location.city || 'Destination'}
                    </Text>
                </View>
            </View>

            <View style={styles.cardFooter}>
                <TouchableOpacity onPress={handleOpenDetails}>
                    <Text style={styles.detailsLink}>View Details</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.mapBtn} onPress={handleOpenExternalMap}>
                    <Ionicons name="map-outline" size={20} color="#666" />
                </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  cardContainer: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  rideBadge: { backgroundColor: '#007AFF' },
  requestBadge: { backgroundColor: '#FF9500' },
  typeText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  priceText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  routeContainer: {
    marginBottom: 12,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
  },
  routeText: { fontSize: 14, color: '#333', flex: 1 },
  routeLine: {
    height: 12,
    borderLeftWidth: 1,
    borderLeftColor: '#ccc',
    marginLeft: 7, // align with icon center (16/2 - 1)
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  detailsLink: {
    color: '#007AFF',
    fontWeight: '600',
  },
  mapBtn: {
    padding: 4,
  }
});