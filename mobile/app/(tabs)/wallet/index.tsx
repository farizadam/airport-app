import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useWalletStore, Transaction } from "@/store/walletStore";
import { toast } from "../../../src/store/toastStore";

export default function WalletScreen() {
  const router = useRouter();
  const {
    wallet,
    transactions,
    earningsSummary,
    bankStatus,
    isLoading,
    error,
    getWallet,
    getEarningsSummary,
    getBankStatus,
    connectBankAccount,
    clearError,
  } = useWalletStore();

  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      await Promise.all([
        getWallet(),
        getEarningsSummary(),
        getBankStatus(),
      ]);
    } catch (err) {
      console.error("Error loading wallet data:", err);
    }
  }, [getWallet, getEarningsSummary, getBankStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleConnectBank = async () => {
    const result = await connectBankAccount();
    if (result?.url) {
      Linking.openURL(result.url);
    } else {
      toast.error("Error", "Failed to start bank connection process");
    }
  };

  const handleWithdraw = () => {
    if (!bankStatus?.connected || !bankStatus?.verified) {
      Alert.alert(
        'Bank Account Required',
        'Please connect and verify your bank account to withdraw funds.',
        [
          { text: 'Cancel', style: "cancel" },
          { text: 'Connect Bank', onPress: handleConnectBank },
        ]
      );
      return;
    }

    if (!wallet?.can_withdraw) {
      toast.info("Minimum Balance Required", `You need at least ${wallet?.minimum_withdrawal_display || "5.00"} EUR to withdraw.`);
      return;
    }

    router.push("/(tabs)/wallet/withdraw");
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "ride_earning":
        return { name: "car", color: "#16A34A" };
      case "withdrawal":
        return { name: "arrow-up-circle", color: "#EF4444" };
      case "refund":
        return { name: "arrow-down-circle", color: "#F59E0B" };
      case "bonus":
        return { name: "gift", color: "#8B5CF6" };
      default:
        return { name: "swap-horizontal", color: "#64748B" };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading && !wallet) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Wallet</Text>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>
            {wallet?.balance_display || "0.00"} <Text style={styles.currency}>EUR</Text>
          </Text>

          {wallet && wallet.pending_balance > 0 && (
            <View style={styles.pendingRow}>
              <Ionicons name="time-outline" size={16} color="#F59E0B" />
              <Text style={styles.pendingText}>
                {wallet.pending_balance_display} EUR pending
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.withdrawButton,
              !wallet?.can_withdraw && styles.withdrawButtonDisabled,
            ]}
            onPress={handleWithdraw}
            disabled={!wallet?.can_withdraw}
          >
            <Ionicons name="arrow-up-circle" size={20} color="white" />
            <Text style={styles.withdrawButtonText}>Withdraw to Bank</Text>
          </TouchableOpacity>
        </View>

        {/* Bank Account Status */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Bank Account</Text>
            {!bankStatus?.connected && (
              <TouchableOpacity onPress={handleConnectBank}>
                <Text style={styles.linkText}>Connect</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.bankStatusCard}>
            <View style={styles.bankStatusRow}>
              <Ionicons
                name={bankStatus?.verified ? "checkmark-circle" : "alert-circle"}
                size={24}
                color={bankStatus?.verified ? "#16A34A" : "#F59E0B"}
              />
              <View style={styles.bankStatusInfo}>
                <Text style={styles.bankStatusText}>
                  {bankStatus?.message || "Not connected"}
                </Text>
                {bankStatus?.connected && !bankStatus?.verified && (
                  <TouchableOpacity onPress={handleConnectBank}>
                    <Text style={styles.verifyLink}>Complete Verification</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Recent Transactions - Moved to top */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/wallet/transactions")}
            >
              <Text style={styles.linkText}>View All</Text>
            </TouchableOpacity>
          </View>

          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyStateText}>No transactions yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Your transactions will appear here
              </Text>
            </View>
          ) : (
            <View style={styles.transactionsList}>
              {transactions.slice(0, 5).map((transaction) => {
                const icon = getTransactionIcon(transaction.type);
                const isCredit = transaction.amount > 0;

                return (
                  <View key={transaction._id} style={styles.transactionItem}>
                    <View
                      style={[
                        styles.transactionIcon,
                        { backgroundColor: `${icon.color}15` },
                      ]}
                    >
                      <Ionicons
                        name={icon.name as any}
                        size={20}
                        color={icon.color}
                      />
                    </View>

                    <View style={styles.transactionInfo}>
                      <Text style={styles.transactionDescription}>
                        {transaction.description ||
                          transaction.type.replace(/_/g, " ")}
                      </Text>
                      <Text style={styles.transactionDate}>
                        {formatDate(transaction.createdAt)}
                      </Text>
                    </View>

                    <View style={styles.transactionAmount}>
                      <Text
                        style={[
                          styles.transactionAmountText,
                          { color: isCredit ? "#16A34A" : "#EF4444" },
                        ]}
                      >
                        {isCredit ? "+" : ""}
                        {transaction.net_amount_display} EUR
                      </Text>
                      {transaction.fee_amount > 0 && (
                        <Text style={styles.transactionFee}>
                          -{transaction.fee_amount_display} fee
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Earnings Summary - Moved to bottom with 2x2 grid */}
        {earningsSummary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Earnings Summary</Text>

            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>This Month</Text>
                <Text style={styles.statValue}>
                  {earningsSummary.this_month.earnings_display} EUR
                </Text>
                <Text style={styles.statSubtext}>
                  {earningsSummary.this_month.rides} rides
                </Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Last Month</Text>
                <Text style={styles.statValue}>
                  {earningsSummary.last_month.earnings_display} EUR
                </Text>
                <Text style={styles.statSubtext}>
                  {earningsSummary.last_month.rides} rides
                </Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Total Earned</Text>
                <Text style={styles.statValue}>
                  {earningsSummary.total_earned_display} EUR
                </Text>
                <Text style={styles.statSubtext}>
                  {earningsSummary.total_rides} total rides
                </Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Your Share</Text>
                <Text style={[styles.statValue, { color: "#16A34A" }]}>
                  {earningsSummary.driver_percentage}%
                </Text>
                <Text style={styles.statSubtext}>
                  {earningsSummary.platform_fee_percentage}% platform fee
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#007AFF" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>How earnings work</Text>
            <Text style={styles.infoText}>
              When a passenger pays for a ride, you receive{" "}
              {earningsSummary?.driver_percentage || 90}% of the fare. The
              platform keeps {earningsSummary?.platform_fee_percentage || 10}%
              as a service fee.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#64748B",
  },
  header: {
    padding: 20,
    paddingBottom: 0,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1E293B",
  },
  balanceCard: {
    margin: 20,
    padding: 24,
    backgroundColor: "#007AFF",
    borderRadius: 20,
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  balanceLabel: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 42,
    fontWeight: "bold",
    color: "white",
  },
  currency: {
    fontSize: 24,
    fontWeight: "normal",
  },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  pendingText: {
    fontSize: 14,
    color: "white",
    marginLeft: 6,
  },
  withdrawButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 20,
  },
  withdrawButtonDisabled: {
    opacity: 0.5,
  },
  withdrawButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
    marginLeft: 8,
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1E293B",
  },
  linkText: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "500",
  },
  bankStatusCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  bankStatusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  bankStatusInfo: {
    marginLeft: 12,
    flex: 1,
  },
  bankStatusText: {
    fontSize: 15,
    color: "#1E293B",
  },
  verifyLink: {
    fontSize: 14,
    color: "#007AFF",
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  statCard: {
    width: "48%",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statLabel: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1E293B",
  },
  statSubtext: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  transactionsList: {
    backgroundColor: "white",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  transactionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  transactionDescription: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1E293B",
    textTransform: "capitalize",
  },
  transactionDate: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  transactionAmount: {
    alignItems: "flex-end",
  },
  transactionAmountText: {
    fontSize: 16,
    fontWeight: "600",
  },
  transactionFee: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  emptyState: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 40,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#64748B",
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#94A3B8",
    marginTop: 4,
    textAlign: "center",
  },
  infoCard: {
    flexDirection: "row",
    backgroundColor: "#EFF6FF",
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E40AF",
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: "#3B82F6",
    lineHeight: 20,
  },
});
