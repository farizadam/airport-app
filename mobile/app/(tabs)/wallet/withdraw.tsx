import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useWalletStore } from "@/store/walletStore";
import { toast } from "../../../src/store/toastStore";

export default function WithdrawScreen() {
  const router = useRouter();
  const {
    wallet,
    bankStatus,
    isWithdrawing,
    requestWithdrawal,
    getWallet,
    getBankStatus,
  } = useWalletStore();

  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState("");

  useEffect(() => {
    getWallet();
    getBankStatus();
  }, []);

  const validateAmount = (value: string) => {
    const numValue = parseFloat(value);
    const balanceEur = (wallet?.balance || 0) / 100;
    const minWithdrawal = (wallet?.minimum_withdrawal || 500) / 100;

    if (!value || isNaN(numValue)) {
      setAmountError("Please enter a valid amount");
      return false;
    }

    if (numValue < minWithdrawal) {
      setAmountError(`Minimum withdrawal is ${minWithdrawal.toFixed(2)} EUR`);
      return false;
    }

    if (numValue > balanceEur) {
      setAmountError(`Insufficient balance. Available: ${balanceEur.toFixed(2)} EUR`);
      return false;
    }

    setAmountError("");
    return true;
  };

  const handleAmountChange = (value: string) => {
    // Only allow numbers and one decimal point
    const cleaned = value.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;

    setAmount(cleaned);
    if (cleaned) {
      validateAmount(cleaned);
    } else {
      setAmountError("");
    }
  };

  const handleWithdrawAll = () => {
    const balanceEur = ((wallet?.balance || 0) / 100).toFixed(2);
    setAmount(balanceEur);
    validateAmount(balanceEur);
  };

  const handleWithdraw = async () => {
    if (!validateAmount(amount)) return;

    if (!bankStatus?.connected || !bankStatus?.verified) {
      toast.warning("Bank Account Required", "Please connect and verify your bank account before withdrawing.");
      return;
    }

    Alert.alert(
      "Confirm Withdrawal",
      `Are you sure you want to withdraw ${parseFloat(amount).toFixed(2)} EUR to your bank account?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Withdraw",
          onPress: async () => {
            // Convert EUR to cents
            const amountInCents = Math.round(parseFloat(amount) * 100);
            const result = await requestWithdrawal(amountInCents);

            if (result.success) {
              toast.success("Withdrawal Initiated", "Your withdrawal has been initiated. It typically takes 2-3 business days to arrive in your bank account.");
              router.back();
            } else {
              toast.error("Withdrawal Failed", result.message);
            }
          },
        },
      ]
    );
  };

  const balanceEur = (wallet?.balance || 0) / 100;
  const minWithdrawal = (wallet?.minimum_withdrawal || 500) / 100;
  const canWithdraw =
    bankStatus?.connected &&
    bankStatus?.verified &&
    parseFloat(amount || "0") >= minWithdrawal &&
    parseFloat(amount || "0") <= balanceEur;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.keyboardView}
        keyboardVerticalOffset={100}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Withdraw Funds</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content}>
          {/* Available Balance */}
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <Text style={styles.balanceAmount}>
              {balanceEur.toFixed(2)} <Text style={styles.currency}>EUR</Text>
            </Text>
          </View>

          {/* Amount Input */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Withdrawal Amount</Text>
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencyPrefix}>EUR</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={handleAmountChange}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#94A3B8"
              />
              <TouchableOpacity
                style={styles.maxButton}
                onPress={handleWithdrawAll}
              >
                <Text style={styles.maxButtonText}>MAX</Text>
              </TouchableOpacity>
            </View>
            {amountError ? (
              <Text style={styles.errorText}>{amountError}</Text>
            ) : (
              <Text style={styles.helperText}>
                Minimum withdrawal: {minWithdrawal.toFixed(2)} EUR
              </Text>
            )}
          </View>

          {/* Bank Account Info */}
          <View style={styles.bankSection}>
            <Text style={styles.sectionTitle}>Withdraw To</Text>
            <View style={styles.bankCard}>
              <Ionicons
                name={bankStatus?.verified ? "checkmark-circle" : "alert-circle"}
                size={24}
                color={bankStatus?.verified ? "#16A34A" : "#F59E0B"}
              />
              <View style={styles.bankInfo}>
                <Text style={styles.bankName}>
                  {bankStatus?.connected
                    ? "Connected Bank Account"
                    : "No bank connected"}
                </Text>
                <Text style={styles.bankStatus}>
                  {bankStatus?.message || "Please connect a bank account"}
                </Text>
              </View>
            </View>
          </View>

          {/* Estimated Arrival */}
          <View style={styles.infoCard}>
            <Ionicons name="time-outline" size={20} color="#64748B" />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Estimated Arrival</Text>
              <Text style={styles.infoText}>2-3 business days</Text>
            </View>
          </View>

          {/* Fee Info */}
          <View style={styles.infoCard}>
            <Ionicons name="cash-outline" size={20} color="#64748B" />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Withdrawal Fee</Text>
              <Text style={styles.infoText}>Free</Text>
            </View>
          </View>

          {/* Summary */}
          {amount && parseFloat(amount) > 0 && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Withdrawal Amount</Text>
                <Text style={styles.summaryValue}>
                  {parseFloat(amount).toFixed(2)} EUR
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Fee</Text>
                <Text style={styles.summaryValue}>0.00 EUR</Text>
              </View>
              <View style={[styles.summaryRow, styles.summaryTotal]}>
                <Text style={styles.summaryTotalLabel}>You'll Receive</Text>
                <Text style={styles.summaryTotalValue}>
                  {parseFloat(amount).toFixed(2)} EUR
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Withdraw Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.withdrawButton,
              (!canWithdraw || isWithdrawing) && styles.withdrawButtonDisabled,
            ]}
            onPress={handleWithdraw}
            disabled={!canWithdraw || isWithdrawing}
          >
            {isWithdrawing ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="arrow-up-circle" size={20} color="white" />
                <Text style={styles.withdrawButtonText}>
                  Withdraw {amount ? `${parseFloat(amount).toFixed(2)} EUR` : ""}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  keyboardView: {
    flex: 1,
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
  content: {
    flex: 1,
    padding: 20,
  },
  balanceCard: {
    backgroundColor: "#007AFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  balanceLabel: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: "bold",
    color: "white",
  },
  currency: {
    fontSize: 20,
    fontWeight: "normal",
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 8,
  },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    paddingHorizontal: 16,
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: "600",
    color: "#64748B",
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: "bold",
    color: "#1E293B",
    paddingVertical: 16,
  },
  maxButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  maxButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "white",
  },
  errorText: {
    fontSize: 14,
    color: "#EF4444",
    marginTop: 8,
  },
  helperText: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 8,
  },
  bankSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 8,
  },
  bankCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  bankInfo: {
    marginLeft: 12,
    flex: 1,
  },
  bankName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
  },
  bankStatus: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
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
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
  },
  infoText: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 2,
  },
  summaryCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#64748B",
  },
  summaryValue: {
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "500",
  },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 12,
    marginTop: 8,
  },
  summaryTotalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
  },
  summaryTotalValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#16A34A",
  },
  footer: {
    padding: 20,
    paddingBottom: 30,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  withdrawButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007AFF",
    paddingVertical: 16,
    borderRadius: 12,
  },
  withdrawButtonDisabled: {
    backgroundColor: "#94A3B8",
  },
  withdrawButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
    marginLeft: 8,
  },
});
