import { useAuthStore } from "@/store/authStore";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

export default function HomeScreen() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const insets = useSafeAreaInsets();

  const handleSearch = (direction: "to_airport" | "from_airport") => {
    router.push({
      pathname: "/(tabs)/rides/search",
      params: { direction },
    });
  };

  const handleCreateRide = () => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    router.push("/(tabs)/rides/create");
  };

  const handleCreateRequest = () => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    router.push("/(tabs)/requests/create");
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header with gradient */}
      <LinearGradient
        colors={["#1E3A8A", "#3B82F6", "#60A5FA"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 20 }]}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.appName}>CovoitAir</Text>
            <Text style={styles.tagline}>Airport Carpooling</Text>
          </View>
          {isAuthenticated ? (
            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => router.push("/(tabs)/profile")}
            >
              <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>
                  {user?.first_name?.[0]}
                  {user?.last_name?.[0]}
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => router.push("/login")}
            >
              <Text style={styles.loginButtonText}>Login</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Welcome message */}
        <Text style={styles.welcomeText}>
          {isAuthenticated
            ? `Hello, ${user?.first_name}!`
            : "Find your ride to the airport!"}
        </Text>
      </LinearGradient>

      {/* Search Section */}
      <View style={styles.searchSection}>
        <Text style={styles.sectionTitle}> Find a Ride</Text>
        <Text style={styles.sectionSubtitle}>Where are you heading?</Text>

        <View style={styles.searchButtons}>
          {/* TO Airport Button */}
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => handleSearch("to_airport")}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={["#3B82F6", "#2563EB"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.searchButtonGradient}
            >
              <View style={styles.searchButtonIcon}>
                <Ionicons name="airplane" size={32} color="#fff" />
              </View>
              <View style={styles.searchButtonTextContainer}>
                <Text style={styles.searchButtonTitle}>TO Airport</Text>
                <Text style={styles.searchButtonSubtitle}>
                  I need a ride to catch my flight
                </Text>
              </View>
              <View style={styles.searchButtonArrow}>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* FROM Airport Button */}
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => handleSearch("from_airport")}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={["#8B5CF6", "#7C3AED"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.searchButtonGradient}
            >
              <View style={styles.searchButtonIcon}>
                <Ionicons name="home" size={32} color="#fff" />
              </View>
              <View style={styles.searchButtonTextContainer}>
                <Text style={styles.searchButtonTitle}>FROM Airport</Text>
                <Text style={styles.searchButtonSubtitle}>
                  I just landed and need a ride home
                </Text>
              </View>
              <View style={styles.searchButtonArrow}>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* Create Section */}
      <View style={styles.createSection}>
        <Text style={styles.sectionTitle}> Create</Text>
        <Text style={styles.sectionSubtitle}>
          Share your ride or find a driver
        </Text>

        <View style={styles.createButtons}>
          {/* Offer a Ride */}
          <TouchableOpacity
            style={styles.createButton}
            onPress={handleCreateRide}
            activeOpacity={0.8}
          >
            <View
              style={[styles.createButtonInner, { backgroundColor: "#FEF3C7" }]}
            >
              <View
                style={[
                  styles.createButtonIconBg,
                  { backgroundColor: "#F59E0B" },
                ]}
              >
                <Ionicons name="car-sport" size={24} color="#fff" />
              </View>
              <Text style={styles.createButtonTitle}>Offer a Ride</Text>
              <Text style={styles.createButtonSubtitle}>
                I am driving and have empty seats
              </Text>
            </View>
          </TouchableOpacity>

          {/* Request a Ride */}
          <TouchableOpacity
            style={styles.createButton}
            onPress={handleCreateRequest}
            activeOpacity={0.8}
          >
            <View
              style={[styles.createButtonInner, { backgroundColor: "#DBEAFE" }]}
            >
              <View
                style={[
                  styles.createButtonIconBg,
                  { backgroundColor: "#3B82F6" },
                ]}
              >
                <Ionicons name="hand-right" size={24} color="#fff" />
              </View>
              <Text style={styles.createButtonTitle}>Request a Ride</Text>
              <Text style={styles.createButtonSubtitle}>
                I need someone to pick me up
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* How it works */}
      <View style={styles.howItWorks}>
        <Text style={styles.sectionTitle}> How it works</Text>

        <View style={styles.stepCard}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>1</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Search or Create</Text>
            <Text style={styles.stepDescription}>
              Find a ride matching your route or create your own offer/request
            </Text>
          </View>
        </View>

        <View style={styles.stepCard}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>2</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Connect</Text>
            <Text style={styles.stepDescription}>
              Book a ride or receive booking requests from travelers
            </Text>
          </View>
        </View>

        <View style={styles.stepCard}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>3</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Travel Together</Text>
            <Text style={styles.stepDescription}>
              Share the ride, split the cost, and reduce your carbon footprint
            </Text>
          </View>
        </View>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsSection}>
        <View style={styles.statItem}>
          <Text style={styles.statEmoji}></Text>
          <Text style={styles.statValue}>All Europe</Text>
          <Text style={styles.statLabel}>Airports covered</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statEmoji}></Text>
          <Text style={styles.statValue}>Save 60%</Text>
          <Text style={styles.statLabel}>vs. taxi</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statEmoji}></Text>
          <Text style={styles.statValue}>Eco-friendly</Text>
          <Text style={styles.statLabel}>Less CO2</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  appName: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
  },
  tagline: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  profileButton: {
    padding: 4,
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  loginButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  loginButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  welcomeText: {
    fontSize: 18,
    color: "#fff",
    marginTop: 20,
    fontWeight: "500",
  },
  searchSection: {
    padding: 20,
    marginTop: -15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 16,
  },
  searchButtons: {
    gap: 12,
  },
  searchButton: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  searchButtonGradient: {
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  searchButtonIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  searchButtonTextContainer: {
    flex: 1,
  },
  searchButtonTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  searchButtonSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    marginTop: 2,
  },
  searchButtonArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  createSection: {
    padding: 20,
    paddingTop: 10,
  },
  createButtons: {
    flexDirection: "row",
    gap: 12,
  },
  createButton: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  createButtonInner: {
    padding: 16,
    alignItems: "center",
    minHeight: 140,
  },
  createButtonIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  createButtonTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E293B",
    textAlign: "center",
  },
  createButtonSubtitle: {
    fontSize: 11,
    color: "#64748B",
    textAlign: "center",
    marginTop: 4,
  },
  howItWorks: {
    padding: 20,
    paddingTop: 10,
  },
  stepCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 2,
  },
  stepDescription: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
  },
  statsSection: {
    flexDirection: "row",
    padding: 20,
    paddingTop: 10,
    gap: 10,
  },
  statItem: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
  },
  statLabel: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
});
