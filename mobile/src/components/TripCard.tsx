import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { 
  LOCATION_COLORS, 
  formatTripDateTime, 
  formatSeats,
  TripDirection 
} from "../utils/tripDisplayUtils";
import ProfileAvatar from "./ProfileAvatar";

export interface TripItem {
  id: string;
  rideId?: string; // Add rideId for bookings
  requestId?: string; // Add requestId for offers
  type: "ride" | "request" | "booking" | "offer";
  role: "driver" | "passenger";
  status: string;
  actionType?: "booking_requests" | "offers_received" | "awaiting_response"; // New field for action needed tab
  pendingCount?: number; // Number of pending bookings/offers
  acceptedCount?: number; // Number of accepted bookings
  pickupLocation: string;
  dropoffLocation: string;
  departureTime: string;
  seats?: number;
  seats_left?: number;
  totalSeats?: number;
  luggage_capacity?: number;
  luggage_left?: number;
  luggage_count?: number;
  price?: number;
  direction?: TripDirection;
  driver?: {
    id?: string;
    _id?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    rating?: number;
    avatar_url?: string;
    car_model?: string;
    car_color?: string;
  };
  passenger?: {
    id?: string;
    _id?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    rating?: number;
    avatar_url?: string;
  };
}

interface TripCardProps {
  item: TripItem;
  onCancel?: (item: TripItem) => void;
  showCancelButton?: boolean;
}

export const TripCard = ({ item, onCancel, showCancelButton = false }: TripCardProps) => {
  const router = useRouter();

  // Use shared utility for date/time formatting
  const dateTime = formatTripDateTime(item.departureTime);

  const getStatusColor = (status: string, actionType?: string) => {
    // Handle action types first
    if (actionType === "booking_requests" || actionType === "offers_received") {
      return { bg: "#FEF3C7", text: "#D97706", icon: "alert-circle" as const };
    }
    if (actionType === "awaiting_response") {
      return { bg: "#E0E7FF", text: "#4F46E5", icon: "hourglass" as const };
    }
    
    switch (status) {
      case "accepted":
      case "confirmed":
      case "completed":
      case "matched":
      case "offer_accepted":
      case "request_accepted":
        return { bg: "#DCFCE7", text: "#16A34A", icon: "checkmark-circle" as const };
      case "pending":
      case "open":
      case "booking_request":
      case "pending_action":
        return { bg: "#FEF3C7", text: "#D97706", icon: "time" as const };
      case "cancelled":
        return { bg: "#FEE2E2", text: "#DC2626", icon: "close-circle" as const };
      case "active":
        return { bg: "#DBEAFE", text: "#3B82F6", icon: "radio-button-on" as const };
      default:
        return { bg: "#F1F5F9", text: "#64748B", icon: "ellipse" as const };
    }
  };

  // Get display status text
  const getStatusText = (status: string, actionType?: string, pendingCount?: number) => {
    if (actionType === "booking_requests") {
      return `${pendingCount || 0} booking request${pendingCount !== 1 ? 's' : ''}`;
    }
    if (actionType === "offers_received") {
      return `${pendingCount || 0} offer${pendingCount !== 1 ? 's' : ''} received`;
    }
    if (actionType === "awaiting_response") {
      return "Awaiting response";
    }
    
    // Default status formatting
    return status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  const statusColors = getStatusColor(item.status, item.actionType);
  const statusText = getStatusText(item.status, item.actionType, item.pendingCount);
  const isDriver = item.role === "driver";

  // Direction-based display using shared color constants
  // RULE: to_airport = City(top) → Airport(bottom), from_airport = Airport(top) → City(bottom)
  const isToAirport = item.direction === "to_airport";
  
  // Start Node (Top) - pickupLocation already set correctly by parent
  const startIcon = isToAirport ? "location-sharp" : "airplane";
  const startColor = isToAirport ? LOCATION_COLORS.city : LOCATION_COLORS.airport;
  const startBg = isToAirport ? LOCATION_COLORS.cityBg : LOCATION_COLORS.airportBg;

  // End Node (Bottom) - dropoffLocation already set correctly by parent
  const endIcon = isToAirport ? "airplane" : "location-sharp";
  const endColor = isToAirport ? LOCATION_COLORS.airport : LOCATION_COLORS.city;
  const endBg = isToAirport ? LOCATION_COLORS.airportBg : LOCATION_COLORS.cityBg;

  // Format seats display using shared utility
  const seatsDisplay = formatSeats(item.seats, item.totalSeats, item.seats_left);

  return (
    <TouchableOpacity
      style={styles.tripCard}
      onPress={() => {
        console.log("👉 Tapping Trip Card:", item.type, item.id);
        if (item.type === "ride") {
          router.push({ pathname: "/ride-details/[id]", params: { id: item.id } });
        } else if (item.type === "request") {
          router.push({ pathname: "/request-details/[id]", params: { id: item.id } });
        } else if (item.type === "booking") {
           if (item.rideId) {
             router.push({ pathname: "/ride-details/[id]", params: { id: item.rideId } }); 
           } else {
             router.push("/(tabs)/explore");
           }
        } else if (item.type === "offer") {
          // Navigate to the request details for offers
          if (item.requestId) {
            router.push({ pathname: "/request-details/[id]", params: { id: item.requestId } });
          }
        }
      }}
    >
      <View style={styles.tripHeader}>
        <View style={[styles.roleBadge, { backgroundColor: isDriver ? "#DBEAFE" : "#F3E8FF" }]}>
          <Ionicons 
            name={isDriver ? "car" : "person"} 
            size={14} 
            color={isDriver ? "#3B82F6" : "#8B5CF6"} 
          />
          <Text style={[styles.roleBadgeText, { color: isDriver ? "#3B82F6" : "#8B5CF6" }]}>
            {isDriver ? "As Driver" : "As Passenger"}
          </Text>
        </View>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            {statusColors.icon && (
              <Ionicons name={statusColors.icon} size={12} color={statusColors.text} style={{ marginRight: 4 }} />
            )}
            <Text style={[styles.statusBadgeText, { color: statusColors.text }]}>
              {statusText}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.tripRoute}>
        <View style={styles.routePoint}>
          <View style={[styles.iconContainer, { backgroundColor: startBg }]}>
             <Ionicons name={startIcon} size={16} color={startColor} />
          </View>
          <Text style={styles.routeText} numberOfLines={1}>{item.pickupLocation}</Text>
        </View>
        <View style={styles.routeLineContainer}>
           <View style={{ width: 2, height: 16, backgroundColor: '#CBD5E1' }} />
           <Ionicons name="chevron-down" size={16} color="#CBD5E1" style={{ marginTop: -4 }} />
        </View>
        <View style={styles.routePoint}>
          <View style={[styles.iconContainer, { backgroundColor: endBg }]}>
             <Ionicons name={endIcon} size={16} color={endColor} />
          </View>
          <Text style={styles.routeText} numberOfLines={1}>{item.dropoffLocation}</Text>
        </View>
      </View>

      {/* Confirmed Ride Info - Show passenger count for drivers */}
      {item.type === "ride" && item.status === "confirmed" && item.acceptedCount && (
        <View style={styles.confirmedSection}>
          <View style={styles.confirmedBadge}>
            <Ionicons name="people" size={16} color="#10B981" />
            <Text style={styles.confirmedText}>
              {item.acceptedCount} passenger{item.acceptedCount !== 1 ? 's' : ''} confirmed
            </Text>
          </View>
        </View>
      )}

      {/* Action Needed Banner */}
      {item.actionType === "booking_requests" && (
        <View style={styles.actionBanner}>
          <Ionicons name="notifications" size={16} color="#D97706" />
          <Text style={styles.actionBannerText}>
            Tap to review booking requests
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#D97706" />
        </View>
      )}

      {item.actionType === "offers_received" && (
        <View style={styles.actionBanner}>
          <Ionicons name="notifications" size={16} color="#D97706" />
          <Text style={styles.actionBannerText}>
            Tap to review driver offers
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#D97706" />
        </View>
      )}

      {item.actionType === "awaiting_response" && (
        <View style={[styles.actionBanner, { backgroundColor: "#EEF2FF" }]}>
          <Ionicons name="hourglass-outline" size={16} color="#4F46E5" />
          <Text style={[styles.actionBannerText, { color: "#4F46E5" }]}>
            Waiting for {item.role === "driver" ? "passenger" : "driver"} to respond
          </Text>
        </View>
      )}

      {/* Driver Details for Accepted Bookings */}
      {item.type === "booking" && item.status === "accepted" && item.driver && (
        <View style={styles.driverSection} onStartShouldSetResponder={() => true}>
          <Text style={styles.sectionHeader}>Driver Details</Text>
          <View style={styles.driverRow}>
            <TouchableOpacity 
              style={styles.driverInfo}
              onPress={() => {
                const driverId = item.driver?.id || item.driver?._id;
                console.log("👤 Navigating to driver profile:", driverId, "Driver data:", JSON.stringify(item.driver));
                if (driverId) {
                  router.push({ pathname: "/user-profile/[id]", params: { id: driverId } });
                } else {
                  console.log("⚠️ No driver ID found in item.driver");
                }
              }}
              activeOpacity={0.7}
            >
              <ProfileAvatar
                userId={item.driver.id || item.driver._id}
                firstName={item.driver.first_name}
                lastName={item.driver.last_name}
                avatarUrl={item.driver.avatar_url}
                rating={item.driver.rating}
                size="medium"
                showRating
                disabled
              />
              <View>
                <Text style={styles.driverName}>
                  {item.driver.first_name || "Driver"} {item.driver.last_name || ""}
                </Text>
                <Text style={styles.driverSubtext}>
                  {item.driver.rating ? `★ ${item.driver.rating.toFixed(1)}` : "No rating"}
                </Text>
              </View>
            </TouchableOpacity>
            {item.driver.phone && (
              <TouchableOpacity style={styles.phoneButton}>
                <Ionicons name="call" size={18} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
          {item.driver.car_model && (
            <View style={styles.carInfo}>
              <Ionicons name="car-sport-outline" size={14} color="#64748B" />
              <Text style={styles.carText}>
                {item.driver.car_model} • {item.driver.car_color || "Unknown color"}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Passenger Details for Booking Requests */}
      {item.type === "booking" && item.status === "booking_request" && item.passenger && (
        <View style={styles.driverSection} onStartShouldSetResponder={() => true}>
          <Text style={styles.sectionHeader}>Passenger Request</Text>
          <View style={styles.driverRow}>
            <TouchableOpacity 
              style={styles.driverInfo}
              onPress={() => {
                const passengerId = item.passenger?.id || item.passenger?._id;
                console.log("👤 Navigating to passenger profile:", passengerId);
                if (passengerId) router.push({ pathname: "/user-profile/[id]", params: { id: passengerId } });
              }}
              activeOpacity={0.7}
            >
              <ProfileAvatar
                userId={item.passenger.id || item.passenger._id}
                firstName={item.passenger.first_name}
                lastName={item.passenger.last_name}
                avatarUrl={item.passenger.avatar_url}
                rating={item.passenger.rating}
                size="medium"
                showRating
                disabled
              />
              <View>
                <Text style={styles.driverName}>
                  {item.passenger.first_name || "Passenger"} {item.passenger.last_name || ""}
                </Text>
                <Text style={styles.driverSubtext}>
                  {item.seats ? `Requests ${item.seats} seat(s)` : ""}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Passenger Details for Offers (driver sees passenger info) */}
      {item.type === "offer" && item.passenger && (
        <View style={styles.driverSection} onStartShouldSetResponder={() => true}>
          <Text style={styles.sectionHeader}>Passenger</Text>
          <View style={styles.driverRow}>
            <TouchableOpacity 
              style={styles.driverInfo}
              onPress={() => {
                const passengerId = item.passenger?.id || item.passenger?._id;
                console.log("👤 Navigating to passenger profile:", passengerId);
                if (passengerId) router.push({ pathname: "/user-profile/[id]", params: { id: passengerId } });
              }}
              activeOpacity={0.7}
            >
              <ProfileAvatar
                userId={item.passenger.id || item.passenger._id}
                firstName={item.passenger.first_name}
                lastName={item.passenger.last_name}
                avatarUrl={item.passenger.avatar_url}
                rating={item.passenger.rating}
                size="medium"
                showRating
                disabled
              />
              <View>
                <Text style={styles.driverName}>
                  {item.passenger.first_name || "Passenger"} {item.passenger.last_name || ""}
                </Text>
                <Text style={styles.driverSubtext}>
                  {item.seats ? `Needs ${item.seats} seat(s)` : ""}
                  {item.price ? ` • Your offer: ${item.price} EUR/seat` : ""}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.tripFooter}>
        <View style={styles.tripInfoLeft}>
           <View style={styles.tripDateTime}>
             <Ionicons name="calendar-outline" size={14} color="#64748B" />
             <Text style={styles.tripDateTimeText}>{dateTime.date}</Text>
             <Ionicons name="time-outline" size={14} color="#64748B" style={{ marginLeft: 6 }} />
             <Text style={styles.tripDateTimeText}>{dateTime.time}</Text>
           </View>
           {(item.seats !== undefined || item.seats_left !== undefined || item.totalSeats !== undefined) && (
             <View style={[styles.tripSeats, { marginLeft: 12 }]}>
               <Ionicons name="people-outline" size={14} color="#64748B" />
               <Text style={styles.tripSeatsText}>{seatsDisplay}</Text>
             </View>
           )}
           <View style={[styles.tripSeats, { marginLeft: 10 }]}>
             <Ionicons name="briefcase-outline" size={14} color="#64748B" />
             <Text style={styles.tripSeatsText}>
               {item.luggage_capacity !== undefined
                 ? (item.luggage_left !== undefined 
                   ? `${item.luggage_capacity - item.luggage_left}/${item.luggage_capacity} bags` 
                   : `${item.luggage_capacity} bags`)
                 : item.luggage_count !== undefined
                   ? `${item.luggage_count} bag(s)`
                   : '0 bags'}
             </Text>
           </View>
        </View>

        {/* Cancel Button (Only for drivers — passengers cannot cancel from card) */}
        {showCancelButton && onCancel && item.role !== "passenger" && !(item.type === "offer" && item.status === "accepted") && (
          <TouchableOpacity 
            style={styles.cardCancelButton}
            onPress={() => onCancel(item)}
          >
            <Text style={styles.cardCancelText}>
              {item.type === "offer" ? "Withdraw" : "Cancel"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  tripCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 12,
  },
  tripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  tripRoute: {
    marginBottom: 14,
    paddingLeft: 4,
  },
  routePoint: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  routeLineContainer: {
    width: 24,
    alignItems: 'center',
    marginRight: 10,
  },
  routeLine: {
    width: 2,
    height: 14,
    backgroundColor: "#E2E8F0",
    marginVertical: 2,
  },
  routeText: {
    fontSize: 14,
    color: "#475569",
    flex: 1,
  },
  tripFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  tripInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'nowrap',
  },
  tripDateTime: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16, 
  },
  tripDateTimeText: {
    fontSize: 12,
    color: "#64748B",
    marginLeft: 4,
  },
  tripSeats: {
    flexDirection: "row",
    alignItems: "center",
  },
  tripSeatsText: {
    fontSize: 12,
    color: "#64748B",
    marginLeft: 4,
  },
  cardCancelButton: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 12,
  },
  cardCancelText: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "600",
  },
  confirmedSection: {
    marginBottom: 12,
  },
  confirmedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  confirmedText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#10B981",
  },
  actionBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  actionBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    color: "#D97706",
  },
  driverSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  sectionHeader: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 8,
    fontWeight: "600",
  },
  driverRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  driverName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
  },
  driverSubtext: {
    fontSize: 12,
    color: "#64748B",
  },
  phoneButton: {
    backgroundColor: "#22C55E",
    padding: 8,
    borderRadius: 20,
  },
  carInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
    backgroundColor: "#F8FAFC",
    padding: 6,
    borderRadius: 6,
  },
  carText: {
    fontSize: 12,
    color: "#475569",
  },
});
