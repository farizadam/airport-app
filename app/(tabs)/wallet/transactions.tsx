import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useWalletStore, Transaction } from "@/store/walletStore";

const FILTER_OPTIONS = [
  { key: "all", label: "All" },
  { key: "ride_earning", label: "Earnings" },
  { key: "withdrawal", label: "Withdrawals" },
  { key: "refund", label: "Refunds" },
];

export default function TransactionsScreen() {
  const router = useRouter();
  const { transactions, isLoading, getTransactions } = useWalletStore();

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadTransactions = useCallback(
    async (pageNum: number, filterType?: string) => {
      try {
        await getTransactions(pageNum, filterType === "all" ? undefined : filterType);
      } catch (err) {
        console.error("Error loading transactions:", err);
      }
    },
    [getTransactions]
  );

  useEffect(() => {
    loadTransactions(1, filter);
    setPage(1);
  }, [filter]);

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    await loadTransactions(1, filter);
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (isLoading || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    await loadTransactions(nextPage, filter);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "ride_earning":
        return { name: "car", color: "#16A34A" };
      case "withdrawal":
        return { name: "arrow-up-circle", color: "#EF4444" };
      case "withdrawal_failed":
        return { name: "close-circle", color: "#EF4444" };
      case "refund":
        return { name: "arrow-down-circle", color: "#F59E0B" };
      case "bonus":
        return { name: "gift", color: "#8B5CF6" };
      case "platform_fee":
        return { name: "business", color: "#64748B" };
      default:
        return { name: "swap-horizontal", color: "#64748B" };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "#16A34A";
      case "pending":
        return "#F59E0B";
      case "failed":
        return "#EF4444";
      default:
        return "#64748B";
    }
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const icon = getTransactionIcon(item.type);
    const isCredit = item.amount > 0;

    return (
      <View style={styles.transactionCard}>
        <View style={styles.transactionHeader}>
          <View
            style={[
              styles.transactionIcon,
              { backgroundColor: `${icon.color}15` },
            ]}
          >
            <Ionicons name={icon.name as any} size={24} color={icon.color} />
          </View>

          <View style={styles.transactionMainInfo}>
            <Text style={styles.transactionType}>
              {item.type.replace(/_/g, " ")}
            </Text>
            <Text style={styles.transactionDate}>{formatDate(item.createdAt)}</Text>
          </View>

          <View style={styles.transactionAmountContainer}>
            <Text
              style={[
                styles.transactionAmount,
                { color: isCredit ? "#16A34A" : "#EF4444" },
              ]}
            >
              {isCredit ? "+" : ""}
              {item.net_amount_display} EUR
            </Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: `${getStatusColor(item.status)}15` },
              ]}
            >
              <Text
                style={[styles.statusText, { color: getStatusColor(item.status) }]}
              >
                {item.status}
              </Text>
            </View>
          </View>
        </View>

        {item.description && (
          <Text style={styles.transactionDescription}>{item.description}</Text>
        )}

        {item.ride_details && (
          <View style={styles.rideDetails}>
            <View style={styles.rideDetailRow}>
              <Ionicons name="navigate" size={14} color="#64748B" />
              <Text style={styles.rideDetailText}>{item.ride_details.route}</Text>
            </View>
            <View style={styles.rideDetailRow}>
              <Ionicons name="person" size={14} color="#64748B" />
              <Text style={styles.rideDetailText}>
                {item.ride_details.passenger_name}
              </Text>
            </View>
            <View style={styles.rideDetailRow}>
              <Ionicons name="people" size={14} color="#64748B" />
              <Text style={styles.rideDetailText}>
                {item.ride_details.seats} seat(s) × {item.ride_details.price_per_seat} EUR
              </Text>
            </View>
          </View>
        )}

        {item.fee_amount > 0 && (
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Platform fee ({item.fee_percentage}%)</Text>
            <Text style={styles.feeAmount}>-{item.fee_amount_display} EUR</Text>
          </View>
        )}

        {item.gross_amount && item.gross_amount !== item.net_amount && (
          <View style={styles.grossRow}>
            <Text style={styles.grossLabel}>Gross amount</Text>
            <Text style={styles.grossAmount}>{item.gross_amount_display} EUR</Text>
          </View>
        )}
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="receipt-outline" size={64} color="#CBD5E1" />
      <Text style={styles.emptyText}>No transactions found</Text>
      <Text style={styles.emptySubtext}>
        {filter !== "all"
          ? `You don't have any ${filter.replace(/_/g, " ")} transactions`
          : "Your transactions will appear here"}
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!isLoading) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transactions</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          data={FILTER_OPTIONS}
          keyExtractor={(item) => item.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterButton,
                filter === item.key && styles.filterButtonActive,
              ]}
              onPress={() => setFilter(item.key)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filter === item.key && styles.filterButtonTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Transactions List */}
      <FlatList
        data={transactions}
        keyExtractor={(item) => item._id}
        renderItem={renderTransaction}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={!isLoading ? renderEmpty : null}
        ListFooterComponent={renderFooter}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
      />
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
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "white",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1E293B",
  },
  filterContainer: {
    backgroundColor: "white",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  filterList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: "#007AFF",
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748B",
  },
  filterButtonTextActive: {
    color: "white",
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  transactionCard: {
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
  transactionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  transactionMainInfo: {
    flex: 1,
    marginLeft: 12,
  },
  transactionType: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
    textTransform: "capitalize",
  },
  transactionDate: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  transactionAmountContainer: {
    alignItems: "flex-end",
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: "bold",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  transactionDescription: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  rideDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  rideDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  rideDetailText: {
    fontSize: 14,
    color: "#64748B",
    marginLeft: 8,
  },
  feeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  feeLabel: {
    fontSize: 14,
    color: "#64748B",
  },
  feeAmount: {
    fontSize: 14,
    color: "#EF4444",
    fontWeight: "500",
  },
  grossRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  grossLabel: {
    fontSize: 14,
    color: "#64748B",
  },
  grossAmount: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#94A3B8",
    marginTop: 4,
    textAlign: "center",
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
  },
});
