import { clearApiDebugStats, clearApiGetCache, getApiDebugStats, ApiDebugEvent } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type DebugSnapshot = ReturnType<typeof getApiDebugStats>;

const formatTime = (ts: number) => {
  return new Date(ts).toLocaleTimeString();
};

const EventRow = ({ event }: { event: ApiDebugEvent }) => {
  const color = event.ok ? "#16A34A" : "#DC2626";
  const sourceColor =
    event.source === "cache" ? "#0EA5E9" : event.source === "dedupe" ? "#9333EA" : "#64748B";

  return (
    <View style={styles.eventRow}>
      <View style={styles.eventTopRow}>
        <Text style={[styles.eventMethod, { color }]}>{event.method}</Text>
        <Text style={styles.eventUrl} numberOfLines={1}>
          {event.url || "(unknown)"}
        </Text>
      </View>
      <View style={styles.eventMetaRow}>
        <Text style={styles.eventMeta}>{formatTime(event.at)}</Text>
        <Text style={[styles.eventMeta, { color: sourceColor }]}>{event.source}</Text>
        <Text style={styles.eventMeta}>{event.status ?? "-"}</Text>
        <Text style={styles.eventMeta}>{event.durationMs} ms</Text>
      </View>
    </View>
  );
};

export default function ApiDebugScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [snapshot, setSnapshot] = useState<DebugSnapshot>(() => getApiDebugStats());

  useEffect(() => {
    const tick = setInterval(() => {
      setSnapshot(getApiDebugStats());
    }, 1000);

    return () => clearInterval(tick);
  }, []);

  const hitRate = useMemo(() => {
    const denominator = snapshot.totalRequests || 1;
    return Math.round(((snapshot.cacheHits + snapshot.dedupeJoins) / denominator) * 100);
  }, [snapshot]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>API Debug</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Overview</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Total</Text>
              <Text style={styles.statValue}>{snapshot.totalRequests}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Network</Text>
              <Text style={styles.statValue}>{snapshot.networkRequests}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Cache Hits</Text>
              <Text style={styles.statValue}>{snapshot.cacheHits}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Dedupe</Text>
              <Text style={styles.statValue}>{snapshot.dedupeJoins}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Errors</Text>
              <Text style={styles.statValue}>{snapshot.errors}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Timeouts</Text>
              <Text style={styles.statValue}>{snapshot.timeoutErrors}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Avg Network</Text>
              <Text style={styles.statValue}>{Math.round(snapshot.avgNetworkMs)} ms</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Hit Rate</Text>
              <Text style={styles.statValue}>{hitRate}%</Text>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                clearApiDebugStats();
                setSnapshot(getApiDebugStats());
              }}
            >
              <Text style={styles.actionButtonText}>Clear Stats</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                clearApiGetCache();
                setSnapshot(getApiDebugStats());
              }}
            >
              <Text style={styles.actionButtonText}>Clear GET Cache</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent Calls</Text>
          {snapshot.recent.length === 0 ? (
            <Text style={styles.emptyText}>No API calls captured yet.</Text>
          ) : (
            snapshot.recent.map((event, idx) => <EventRow event={event} key={`${event.at}-${idx}`} />)
          )}
        </View>
      </ScrollView>
    </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
  },
  content: {
    padding: 14,
    gap: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 10,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statItem: {
    width: "48%",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  statLabel: {
    fontSize: 12,
    color: "#64748B",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 2,
  },
  actionsRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    flex: 1,
    backgroundColor: "#0F172A",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 13,
  },
  emptyText: {
    color: "#64748B",
    fontSize: 13,
  },
  eventRow: {
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 10,
    marginTop: 10,
  },
  eventTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  eventMethod: {
    fontSize: 12,
    fontWeight: "700",
    width: 44,
  },
  eventUrl: {
    flex: 1,
    fontSize: 12,
    color: "#334155",
  },
  eventMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  eventMeta: {
    fontSize: 11,
    color: "#64748B",
  },
});
