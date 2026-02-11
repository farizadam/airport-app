import { useAuthStore } from "@/store/authStore";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const { width } = Dimensions.get("window");

export default function LandingScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <LinearGradient
        colors={["#3B82F6", "#1E40AF"]}
        style={styles.loadingContainer}
      >
        <View style={styles.loadingIcon}>
          <Ionicons name="airplane" size={48} color="#fff" />
        </View>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>CovoitAir</Text>
      </LinearGradient>
    );
  }

  const handleGetStarted = () => {
    router.push("/register");
  };

  const handleLogin = () => {
    router.push("/login");
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <LinearGradient
          colors={["#3B82F6", "#1E40AF", "#1E3A8A"]}
          style={styles.hero}
        >
          <View style={styles.heroContent}>
            {/* Logo */}
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Ionicons name="airplane" size={40} color="#3B82F6" />
              </View>
            </View>

            <Text style={styles.appName}>CovoitAir</Text>
            <Text style={styles.heroTitle}>Airport Carpooling</Text>
            <Text style={styles.heroSubtitle}>
              Share rides to and from the airport.{"\n"}Save money. Reduce emissions. Meet people.
            </Text>

            {/* Stats */}
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>10K+</Text>
                <Text style={styles.statLabel}>Riders</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>50+</Text>
                <Text style={styles.statLabel}>Airports</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>4.8★</Text>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
            </View>

            {/* CTA Buttons */}
            <View style={styles.buttonGroup}>
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleGetStarted}
              >
                <Text style={styles.primaryButtonText}>Get Started</Text>
                <Ionicons name="arrow-forward" size={20} color="#3B82F6" />
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleLogin}
              >
                <Text style={styles.secondaryButtonText}>
                  I have an account
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Wave decoration */}
          <View style={styles.waveContainer}>
            <View style={styles.wave} />
          </View>
        </LinearGradient>

        {/* Features Section */}
        <View style={styles.features}>
          <Text style={styles.sectionTitle}>How It Works</Text>
          <Text style={styles.sectionSubtitle}>
            Simple steps to share your airport ride
          </Text>

          <View style={styles.featureGrid}>
            <View style={styles.featureCard}>
              <LinearGradient
                colors={["#EFF6FF", "#DBEAFE"]}
                style={styles.featureIconContainer}
              >
                <Ionicons name="search" size={28} color="#3B82F6" />
              </LinearGradient>
              <Text style={styles.featureTitle}>Find a Ride</Text>
              <Text style={styles.featureDescription}>
                Search rides by airport, date, and location
              </Text>
            </View>

            <View style={styles.featureCard}>
              <LinearGradient
                colors={["#F0FDF4", "#DCFCE7"]}
                style={styles.featureIconContainer}
              >
                <Ionicons name="car" size={28} color="#22C55E" />
              </LinearGradient>
              <Text style={styles.featureTitle}>Offer a Ride</Text>
              <Text style={styles.featureDescription}>
                Share your trip and earn extra money
              </Text>
            </View>

            <View style={styles.featureCard}>
              <LinearGradient
                colors={["#FEF3C7", "#FDE68A"]}
                style={styles.featureIconContainer}
              >
                <Ionicons name="wallet" size={28} color="#F59E0B" />
              </LinearGradient>
              <Text style={styles.featureTitle}>Save Money</Text>
              <Text style={styles.featureDescription}>
                Split costs up to 75% compared to taxis
              </Text>
            </View>

            <View style={styles.featureCard}>
              <LinearGradient
                colors={["#F3E8FF", "#E9D5FF"]}
                style={styles.featureIconContainer}
              >
                <Ionicons name="leaf" size={28} color="#8B5CF6" />
              </LinearGradient>
              <Text style={styles.featureTitle}>Go Green</Text>
              <Text style={styles.featureDescription}>
                Reduce carbon footprint together
              </Text>
            </View>
          </View>
        </View>

        {/* Trust Section */}
        <View style={styles.trustSection}>
          <LinearGradient
            colors={["#F8FAFC", "#F1F5F9"]}
            style={styles.trustContent}
          >
            <Ionicons name="shield-checkmark" size={40} color="#3B82F6" />
            <Text style={styles.trustTitle}>Safe & Secure</Text>
            <Text style={styles.trustDescription}>
              Verified profiles, ratings, and secure payments.{"\n"}
              Your safety is our priority.
            </Text>
          </LinearGradient>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerLogo}>✈️ CovoitAir</Text>
          <Text style={styles.footerText}>© 2026 All rights reserved</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  hero: {
    paddingTop: 60,
    paddingBottom: 40,
    minHeight: 580,
  },
  heroContent: {
    paddingHorizontal: 24,
    alignItems: "center",
  },
  logoContainer: {
    marginBottom: 16,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  appName: {
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 16,
  },
  heroSubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
  },
  statsContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  statItem: {
    alignItems: "center",
    paddingHorizontal: 16,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  statLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  buttonGroup: {
    width: "100%",
    gap: 12,
  },
  primaryButton: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: "#3B82F6",
    fontSize: 18,
    fontWeight: "700",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
  },
  secondaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  waveContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    overflow: "hidden",
  },
  wave: {
    position: "absolute",
    bottom: -20,
    left: -10,
    right: -10,
    height: 60,
    backgroundColor: "#fff",
    borderTopLeftRadius: 100,
    borderTopRightRadius: 100,
  },
  features: {
    padding: 24,
    paddingTop: 32,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1E293B",
    textAlign: "center",
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 32,
  },
  featureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 16,
  },
  featureCard: {
    width: (width - 64) / 2,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  featureIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 6,
    textAlign: "center",
  },
  featureDescription: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
  },
  trustSection: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  trustContent: {
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
  },
  trustTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1E293B",
    marginTop: 16,
    marginBottom: 8,
  },
  trustDescription: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
  },
  footer: {
    padding: 32,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  footerLogo: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#3B82F6",
    marginBottom: 8,
  },
  footerText: {
    fontSize: 14,
    color: "#94A3B8",
  },
});
