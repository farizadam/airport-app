import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

export interface TripItem {
  id: string;
  rideId?: string; // Add rideId for bookings
  requestId?: string; // Add requestId for offers
  type: "ride" | "request" | "booking" | "offer";
  role: "driver" | "passenger";
  status: string;
  pickupLocation: string;
  dropoffLocation: string;
  departureTime: string;
  seats?: number;
  seats_left?: number;
  totalSeats?: number;
  price?: number;
  direction?: "to_airport" | "from_airport";
  driver?: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    rating?: number;
    car_model?: string;
    car_color?: string;
  };
  passenger?: {
    first_name?: string;
    last_name?: string;
    phone?: string;
  };
}

interface TripCardProps {
  item: TripItem;
  onCancel?: (item: TripItem) => void;
  showCancelButton?: boolean;
}

export const TripCard = ({ item, onCancel, showCancelButton = false }: TripCardProps) => {
  const router = useRouter();

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      time: date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "accepted":
      case "confirmed":
      case "completed":
      case "matched":
      case "offer_accepted":
      case "request_accepted":
        return { bg: "#DCFCE7", text: "#16A34A" };
      case "pending":
      case "open":
      case "booking_request":
        return { bg: "#FEF3C7", text: "#D97706" };
      case "cancelled":
        return { bg: "#FEE2E2", text: "#DC2626" };
      default:
        return { bg: "#F1F5F9", text: "#64748B" };
    }
  };

  const dateTime = formatDateTime(item.departureTime);
  const statusColors = getStatusColor(item.status);
  const isDriver = item.role === "driver";

  // Determine icons and colors
  const isToAirport = item.direction === "to_airport";
  
  // Start Node (Top)
  const startIcon = isToAirport ? "location-sharp" : "airplane";
  const startColor = isToAirport ? "#EF4444" : "#3B82F6";
  const startBg = isToAirport ? "#FEF2F2" : "#EFF6FF";

  // End Node (Bottom)
  const endIcon = isToAirport ? "airplane" : "location-sharp";
  const endColor = isToAirport ? "#3B82F6" : "#EF4444";
  const endBg = isToAirport ? "#EFF6FF" : "#FEF2F2";

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
             router.push("/(tabs)/bookings");
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
            <Text style={[styles.statusBadgeText, { color: statusColors.text }]}>
              {item.status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
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

      {/* Driver Details for Accepted Bookings */}
      {item.type === "booking" && item.status === "accepted" && item.driver && (
        <View style={styles.driverSection}>
          <Text style={styles.sectionHeader}>Driver Details</Text>
          <View style={styles.driverRow}>
            <View style={styles.driverInfo}>
              <Ionicons name="person-circle" size={36} color="#64748B" />
              <View>
                <Text style={styles.driverName}>
                  {item.driver.first_name || "Driver"} {item.driver.last_name || ""}
                </Text>
                <Text style={styles.driverSubtext}>
                  {item.driver.rating ? `★ ${item.driver.rating}` : "No rating"}
                </Text>
              </View>
            </View>
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
        <View style={styles.driverSection}>
          <Text style={styles.sectionHeader}>Passenger Request</Text>
          <View style={styles.driverRow}>
            <View style={styles.driverInfo}>
              <Ionicons name="person-circle" size={36} color="#64748B" />
              <View>
                <Text style={styles.driverName}>
                  {item.passenger.first_name || "Passenger"} {item.passenger.last_name || ""}
                </Text>
                <Text style={styles.driverSubtext}>
                  {item.seats ? `Requests ${item.seats} seat(s)` : ""}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Passenger Details for Offers (driver sees passenger info) */}
      {item.type === "offer" && item.passenger && (
        <View style={styles.driverSection}>
          <Text style={styles.sectionHeader}>Passenger</Text>
          <View style={styles.driverRow}>
            <View style={styles.driverInfo}>
              <Ionicons name="person-circle" size={36} color="#8B5CF6" />
              <View>
                <Text style={styles.driverName}>
                  {item.passenger.first_name || "Passenger"} {item.passenger.last_name || ""}
                </Text>
                <Text style={styles.driverSubtext}>
                  {item.seats ? `Needs ${item.seats} seat(s)` : ""}
                  {item.price ? ` • Your offer: ${item.price} MAD/seat` : ""}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      <View style={styles.tripFooter}>
        <View style={styles.tripInfoLeft}>
           <View style={styles.tripDateTime}>
             <Ionicons name="calendar-outline" size={14} color="#64748B" />
             <Text style={styles.tripDateTimeText}>{dateTime.date}</Text>
             <Ionicons name="time-outline" size={14} color="#64748B" style={{ marginLeft: 8 }} />
             <Text style={styles.tripDateTimeText}>{dateTime.time}</Text>
           </View>
           {/* Added more spacing here */}
           <View style={{ width: 16 }} />
           {(item.seats !== undefined || item.seats_left !== undefined || item.totalSeats !== undefined) && (
             <View style={styles.tripSeats}>
               <Ionicons name="people-outline" size={14} color="#64748B" />
               <Text style={styles.tripSeatsText}>
                 {item.totalSeats !== undefined && item.seats_left !== undefined 
                   ? `${item.totalSeats - item.seats_left}/${item.totalSeats} seats`
                   : `${item.seats ?? item.seats_left ?? 0} seats`
                 }
               </Text>
             </View>
           )}
        </View>

        {/* Cancel Button (Only if showCancelButton is true) */}
        {showCancelButton && onCancel && (
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
    flexWrap: 'wrap',
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
