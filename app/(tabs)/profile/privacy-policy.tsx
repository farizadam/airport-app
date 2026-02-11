import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  const sections = [
    {
      title: "1. Information We Collect",
      content:
        "We collect information you provide directly when creating your account, including your name, email address, phone number, date of birth, and profile photo. When you use our services, we also collect trip details, payment information, location data, and device information to facilitate airport ride-sharing.",
    },
    {
      title: "2. How We Use Your Information",
      content:
        "We use your information to:\n\n• Create and manage your account\n• Match drivers with passengers for airport transfers\n• Process payments and wallet transactions\n• Send notifications about bookings, ride updates, and offers\n• Improve our services and user experience\n• Ensure safety and prevent fraud\n• Communicate important updates about our service",
    },
    {
      title: "3. Information Sharing",
      content:
        "We share limited information with other users to facilitate rides:\n\n• Drivers see passenger names, pickup locations, and contact details for confirmed bookings\n• Passengers see driver names, vehicle information, and ratings\n• We do not sell your personal information to third parties\n• We may share data with payment processors (Stripe) to complete transactions",
    },
    {
      title: "4. Location Data",
      content:
        "We collect location data to:\n\n• Help you set pickup and drop-off points\n• Show nearby airports and available rides\n• Calculate distances and route previews\n\nLocation data is only collected when you actively use location features. You can disable location access in your device settings.",
    },
    {
      title: "5. Payment Information",
      content:
        "Payment processing is handled securely through Stripe. We do not store your full credit card details on our servers. Wallet balances and transaction history are maintained for your records and dispute resolution.",
    },
    {
      title: "6. Data Security",
      content:
        "We implement industry-standard security measures to protect your data, including encrypted connections (HTTPS), secure authentication tokens, and regular security audits. However, no method of transmission over the internet is 100% secure.",
    },
    {
      title: "7. Data Retention",
      content:
        "We retain your account data as long as your account is active. Trip history and transaction records are kept for legal and accounting purposes. You can request deletion of your account data by contacting our support team.",
    },
    {
      title: "8. Your Rights",
      content:
        "You have the right to:\n\n• Access your personal data\n• Correct inaccurate information\n• Request deletion of your data\n• Opt out of marketing communications\n• Export your data\n\nTo exercise these rights, please contact us through the app or via email.",
    },
    {
      title: "9. Cookies & Analytics",
      content:
        "We may use analytics tools to understand how our app is used and to improve performance. These tools collect anonymized usage data and do not identify individual users.",
    },
    {
      title: "10. Changes to This Policy",
      content:
        "We may update this Privacy Policy from time to time. We will notify you of significant changes through the app or via email. Continued use of the service after changes constitutes acceptance of the updated policy.",
    },
    {
      title: "11. Contact Us",
      content:
        "If you have questions about this Privacy Policy or your personal data, please contact us at:\n\n📧 support@covouturage.com",
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro */}
        <View style={styles.introCard}>
          <View style={styles.introIconContainer}>
            <Ionicons name="shield-checkmark" size={32} color="#007AFF" />
          </View>
          <Text style={styles.introTitle}>Your Privacy Matters</Text>
          <Text style={styles.introText}>
            This Privacy Policy explains how Covouturage collects, uses, and
            protects your personal information when you use our airport
            ride-sharing platform.
          </Text>
          <Text style={styles.lastUpdated}>Last updated: February 10, 2026</Text>
        </View>

        {/* Sections */}
        {sections.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionContent}>{section.content}</Text>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  introCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  introIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 8,
  },
  introText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
  },
  lastUpdated: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 12,
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 22,
  },
});
