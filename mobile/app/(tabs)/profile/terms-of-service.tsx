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

export default function TermsOfServiceScreen() {
  const router = useRouter();

  const sections = [
    {
      title: "1. Acceptance of Terms",
      content:
        "By creating an account and using Covouturage, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service. We reserve the right to modify these terms at any time, and continued use constitutes acceptance of any changes.",
    },
    {
      title: "2. Service Description",
      content:
        "Covouturage is a peer-to-peer ride-sharing platform that connects drivers and passengers traveling to or from airports. We act as an intermediary and do not provide transportation services directly. Drivers are independent users, not employees of Covouturage.",
    },
    {
      title: "3. User Accounts",
      content:
        "To use our service, you must:\n\n• Be at least 18 years old\n• Provide accurate and complete registration information\n• Maintain the security of your account credentials\n• Notify us immediately of any unauthorized access\n\nYou are responsible for all activity under your account. We reserve the right to suspend or terminate accounts that violate these terms.",
    },
    {
      title: "4. Driver Responsibilities",
      content:
        "If you offer rides as a driver, you must:\n\n• Hold a valid driver's license\n• Have proper vehicle insurance and registration\n• Maintain your vehicle in safe operating condition\n• Follow all applicable traffic laws and regulations\n• Arrive at the agreed pickup location on time\n• Treat passengers with respect and courtesy\n• Not be under the influence of alcohol or drugs while driving",
    },
    {
      title: "5. Passenger Responsibilities",
      content:
        "As a passenger, you must:\n\n• Be ready at the pickup location at the agreed time\n• Treat the driver and their vehicle with respect\n• Wear a seatbelt at all times\n• Not engage in disruptive or dangerous behavior\n• Pay the agreed fare through the platform\n• Cancel bookings in a timely manner if plans change",
    },
    {
      title: "6. Bookings & Cancellations",
      content:
        "When you book a ride or accept an offer:\n\n• The booking is confirmed once payment is processed\n• Cancellations should be made as early as possible\n• Refund policies apply based on cancellation timing\n• Repeated no-shows or late cancellations may result in account restrictions\n• Drivers may cancel rides due to unforeseen circumstances",
    },
    {
      title: "7. Payments & Fees",
      content:
        "All payments are processed through our secure payment system:\n\n• Prices are set by drivers and agreed upon before booking\n• Payment is processed at the time of booking\n• Wallet funds can be used for payments\n• Refunds are processed according to our cancellation policy\n• We may charge service fees for transactions\n• Drivers receive payment after the trip is completed",
    },
    {
      title: "8. Ratings & Reviews",
      content:
        "After each trip, both drivers and passengers can rate and review each other. Reviews must be honest and respectful. We reserve the right to remove reviews that contain:\n\n• Abusive or discriminatory language\n• False or misleading information\n• Personal information of other users\n• Spam or promotional content",
    },
    {
      title: "9. Prohibited Conduct",
      content:
        "Users may not:\n\n• Use the platform for illegal activities\n• Harass, threaten, or discriminate against other users\n• Create fake accounts or impersonate others\n• Manipulate ratings or reviews\n• Share other users' personal information\n• Use the service to transport illegal goods\n• Attempt to circumvent the payment system\n• Interfere with platform operations",
    },
    {
      title: "10. Liability Limitations",
      content:
        "Covouturage provides a platform to connect users and is not responsible for:\n\n• The actions or conduct of any user\n• Vehicle accidents, injuries, or property damage\n• Delays, cancellations, or route changes\n• Lost or stolen items during trips\n• Quality of the ride experience\n\nUsers agree to use the service at their own risk. We recommend verifying driver profiles and ratings before booking.",
    },
    {
      title: "11. Dispute Resolution",
      content:
        "In case of disputes between users:\n\n• First, attempt to resolve the issue directly between parties\n• If unresolved, contact our support team for mediation\n• We will review the case and may issue refunds or take action\n• Our decision on disputes is final\n• Repeated disputes may lead to account review",
    },
    {
      title: "12. Intellectual Property",
      content:
        "All content, logos, trademarks, and materials on the platform are owned by Covouturage or its licensors. Users may not copy, modify, distribute, or create derivative works without our express written permission.",
    },
    {
      title: "13. Termination",
      content:
        "We may suspend or terminate your account at our discretion for violations of these terms. Upon termination:\n\n• Access to the platform will be revoked\n• Pending transactions may be cancelled\n• Wallet balance will be refunded per our policy\n• You may not create a new account without permission",
    },
    {
      title: "14. Governing Law",
      content:
        "These Terms of Service are governed by the applicable laws of the jurisdiction in which our service operates. Any legal proceedings shall be conducted in the appropriate courts of that jurisdiction.",
    },
    {
      title: "15. Contact",
      content:
        "For questions about these Terms of Service, please reach out to:\n\n📧 support@covouturage.com",
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
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
            <Ionicons name="document-text" size={32} color="#6366F1" />
          </View>
          <Text style={styles.introTitle}>Terms of Service</Text>
          <Text style={styles.introText}>
            Please read these terms carefully before using the Covouturage
            airport ride-sharing platform. By using our service, you agree
            to these terms.
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
    backgroundColor: "#EEF2FF",
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
