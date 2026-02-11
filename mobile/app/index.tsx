import { useRouter } from "expo-router";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function LandingScreen() {
  const router = useRouter();

  const handleGetStarted = () => {
    console.log("Get Started clicked, navigating to register");
    router.push("/register");
  };

  const handleLogin = () => {
    console.log("Login clicked, navigating to login");
    router.push("/login");
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Airport Carpooling</Text>
        <Text style={styles.heroSubtitle}>
          Share rides to/from the airport. Save money. Make friends. 🚗✈️
        </Text>

        <View style={styles.buttonGroup}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
            ]}
            onPress={handleGetStarted}
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
            ]}
            onPress={handleLogin}
          >
            <Text style={styles.secondaryButtonText}>Login</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.features}>
        <Text style={styles.sectionTitle}>How It Works</Text>

        <View style={styles.featureCard}>
          <View style={styles.featureIcon}>
            <Text style={styles.featureIconText}>🔍</Text>
          </View>
          <Text style={styles.featureTitle}>Find Rides</Text>
          <Text style={styles.featureDescription}>
            Search for rides to/from airports near you
          </Text>
        </View>

        <View style={styles.featureCard}>
          <View style={styles.featureIcon}>
            <Text style={styles.featureIconText}>🚗</Text>
          </View>
          <Text style={styles.featureTitle}>Offer Rides</Text>
          <Text style={styles.featureDescription}>
            Share your trip and earn money
          </Text>
        </View>

        <View style={styles.featureCard}>
          <View style={styles.featureIcon}>
            <Text style={styles.featureIconText}>💰</Text>
          </View>
          <Text style={styles.featureTitle}>Save Money</Text>
          <Text style={styles.featureDescription}>
            Split costs and travel affordably
          </Text>
        </View>

        <View style={styles.featureCard}>
          <View style={styles.featureIcon}>
            <Text style={styles.featureIconText}>🌍</Text>
          </View>
          <Text style={styles.featureTitle}>Eco-Friendly</Text>
          <Text style={styles.featureDescription}>
            Reduce carbon footprint together
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Airport Carpooling © 2026</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  hero: {
    padding: 24,
    paddingTop: 80,
    paddingBottom: 48,
    backgroundColor: "#2563eb",
    alignItems: "center",
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 12,
    textAlign: "center",
  },
  heroSubtitle: {
    fontSize: 18,
    color: "#e0e7ff",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 26,
  },
  buttonGroup: {
    width: "100%",
    gap: 12,
  },
  primaryButton: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  primaryButtonPressed: {
    opacity: 0.8,
  },
  primaryButtonText: {
    color: "#2563eb",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  secondaryButtonPressed: {
    opacity: 0.8,
  },
  secondaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  features: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 24,
    textAlign: "center",
  },
  featureCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    alignItems: "center",
  },
  featureIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  featureIconText: {
    fontSize: 32,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
  footer: {
    padding: 24,
    alignItems: "center",
  },
  footerText: {
    fontSize: 14,
    color: "#9ca3af",
  },
});
