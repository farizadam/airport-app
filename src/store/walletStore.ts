import api from "@/lib/api";
import { create } from "zustand";

export interface WalletBalance {
  balance: number;
  balance_display: string;
  pending_balance: number;
  pending_balance_display: string;
  total_earned: number;
  total_earned_display: string;
  total_withdrawn: number;
  total_withdrawn_display: string;
  currency: string;
  can_withdraw: boolean;
  minimum_withdrawal: number;
  minimum_withdrawal_display: string;
}

export interface Transaction {
  _id: string;
  id?: string;
  wallet_id: string;
  user_id: string;
  type: "ride_earning" | "ride_payment" | "platform_fee" | "withdrawal" | "withdrawal_failed" | "refund" | "bonus" | "adjustment";
  amount: number;
  amount_display: string;
  gross_amount: number | null;
  gross_amount_display: string | null;
  fee_amount: number;
  fee_amount_display: string;
  fee_percentage: number;
  net_amount: number;
  net_amount_display: string;
  currency: string;
  status: "pending" | "completed" | "failed" | "cancelled";
  reference_type: "booking" | "ride" | "payout" | "refund" | "manual" | null;
  reference_id: string | null;
  stripe_payment_intent_id: string | null;
  description: string | null;
  ride_details?: {
    ride_id: string;
    booking_id: string;
    passenger_id: string;
    passenger_name: string;
    seats: number;
    price_per_seat: number;
    route: string;
  };
  createdAt: string;
  processed_at: string | null;
}

export interface Payout {
  _id: string;
  id?: string;
  user_id: string;
  wallet_id: string;
  amount: number;
  amount_display: string;
  currency: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  bank_account?: {
    last4: string | null;
    bank_name: string | null;
  };
  requested_at: string;
  completed_at: string | null;
  estimated_arrival: string | null;
  failure_reason: string | null;
  createdAt: string;
}

export interface EarningsSummary {
  total_earned: number;
  total_earned_display: string;
  total_withdrawn: number;
  total_withdrawn_display: string;
  available_balance: number;
  available_balance_display: string;
  pending_balance: number;
  pending_balance_display: string;
  this_month: {
    earnings: number;
    earnings_display: string;
    rides: number;
    fees_paid: number;
    fees_paid_display: string;
  };
  last_month: {
    earnings: number;
    earnings_display: string;
    rides: number;
  };
  total_rides: number;
  platform_fee_percentage: number;
  driver_percentage: number;
}

export interface BankStatus {
  connected: boolean;
  verified: boolean;
  details_submitted?: boolean;
  payouts_enabled?: boolean;
  requirements?: string[];
  message: string;
}

export interface EarningsCalculation {
  gross_amount: number;
  gross_amount_display: string;
  platform_fee_percentage: number;
  platform_fee: number;
  platform_fee_display: string;
  your_earnings: number;
  your_earnings_display: string;
  your_percentage: number;
  currency: string;
}

interface WalletState {
  wallet: WalletBalance | null;
  transactions: Transaction[];
  payouts: Payout[];
  earningsSummary: EarningsSummary | null;
  bankStatus: BankStatus | null;
  isLoading: boolean;
  isWithdrawing: boolean;
  isPaying: boolean;
  error: string | null;

  // Actions
  getWallet: () => Promise<void>;
  getTransactions: (page?: number, type?: string) => Promise<void>;
  getPayouts: (page?: number) => Promise<void>;
  getEarningsSummary: () => Promise<void>;
  getBankStatus: () => Promise<void>;
  requestWithdrawal: (amount: number) => Promise<{ success: boolean; message: string }>;
  connectBankAccount: () => Promise<{ url: string } | null>;
  calculateEarnings: (pricePerSeat: number, seats: number) => Promise<EarningsCalculation | null>;
  payWithWallet: (rideId: string, seats: number, luggage_count?: number) => Promise<{ success: boolean; message: string; booking?: any; newBalance?: number }>;
  clearError: () => void;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  wallet: null,
  transactions: [],
  payouts: [],
  earningsSummary: null,
  bankStatus: null,
  isLoading: false,
  isWithdrawing: false,
  isPaying: false,
  error: null,

  getWallet: async () => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.get<{
        success: boolean;
        data: {
          wallet: WalletBalance;
          recent_transactions: Transaction[];
          pending_payouts: number;
        };
      }>("/wallet");

      set({
        wallet: response.data.data.wallet,
        transactions: response.data.data.recent_transactions,
      });
    } catch (error: any) {
      const message = error.response?.data?.message || "Failed to get wallet";
      set({ error: message });
      throw new Error(message);
    } finally {
      set({ isLoading: false });
    }
  },

  getTransactions: async (page = 1, type?: string) => {
    try {
      set({ isLoading: true, error: null });
      
      let url = `/wallet/transactions?page=${page}&limit=20`;
      if (type) {
        url += `&type=${type}`;
      }

      const response = await api.get<{
        success: boolean;
        data: Transaction[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
          hasMore: boolean;
        };
      }>(url);

      if (page === 1) {
        set({ transactions: response.data.data });
      } else {
        set((state) => ({
          transactions: [...state.transactions, ...response.data.data],
        }));
      }
    } catch (error: any) {
      const message = error.response?.data?.message || "Failed to get transactions";
      set({ error: message });
      throw new Error(message);
    } finally {
      set({ isLoading: false });
    }
  },

  getPayouts: async (page = 1) => {
    try {
      set({ isLoading: true, error: null });

      const response = await api.get<{
        success: boolean;
        data: Payout[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
          hasMore: boolean;
        };
      }>(`/wallet/payouts?page=${page}&limit=20`);

      if (page === 1) {
        set({ payouts: response.data.data });
      } else {
        set((state) => ({
          payouts: [...state.payouts, ...response.data.data],
        }));
      }
    } catch (error: any) {
      const message = error.response?.data?.message || "Failed to get payouts";
      set({ error: message });
      throw new Error(message);
    } finally {
      set({ isLoading: false });
    }
  },

  getEarningsSummary: async () => {
    try {
      set({ isLoading: true, error: null });

      const response = await api.get<{
        success: boolean;
        data: EarningsSummary;
      }>("/wallet/earnings-summary");

      set({ earningsSummary: response.data.data });
    } catch (error: any) {
      const message = error.response?.data?.message || "Failed to get earnings summary";
      set({ error: message });
      throw new Error(message);
    } finally {
      set({ isLoading: false });
    }
  },

  getBankStatus: async () => {
    try {
      set({ isLoading: true, error: null });

      const response = await api.get<{
        success: boolean;
        data: BankStatus;
      }>("/wallet/bank-status");

      set({ bankStatus: response.data.data });
    } catch (error: any) {
      const message = error.response?.data?.message || "Failed to get bank status";
      set({ error: message });
      throw new Error(message);
    } finally {
      set({ isLoading: false });
    }
  },

  requestWithdrawal: async (amount: number) => {
    try {
      set({ isWithdrawing: true, error: null });

      const response = await api.post<{
        success: boolean;
        message: string;
        data: {
          payout: Payout;
          new_balance: number;
          new_balance_display: string;
        };
      }>("/wallet/withdraw", { amount });

      // Update wallet balance
      const wallet = get().wallet;
      if (wallet) {
        set({
          wallet: {
            ...wallet,
            balance: response.data.data.new_balance,
            balance_display: response.data.data.new_balance_display,
          },
        });
      }

      // Refresh wallet data
      await get().getWallet();

      return {
        success: true,
        message: response.data.message || "Withdrawal initiated successfully",
      };
    } catch (error: any) {
      const message = error.response?.data?.message || "Failed to request withdrawal";
      set({ error: message });
      return { success: false, message };
    } finally {
      set({ isWithdrawing: false });
    }
  },

  connectBankAccount: async () => {
    try {
      set({ isLoading: true, error: null });

      const response = await api.post<{
        success: boolean;
        data: {
          url: string;
          expires_at: number;
        };
      }>("/wallet/connect-bank");

      return { url: response.data.data.url };
    } catch (error: any) {
      const message = error.response?.data?.message || "Failed to connect bank account";
      set({ error: message });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  calculateEarnings: async (pricePerSeat: number, seats: number) => {
    try {
      const response = await api.get<{
        success: boolean;
        data: EarningsCalculation;
      }>(`/wallet/calculate-earnings?price_per_seat=${pricePerSeat}&seats=${seats}`);

      return response.data.data;
    } catch (error: any) {
      console.error("Failed to calculate earnings:", error);
      return null;
    }
  },

  payWithWallet: async (rideId: string, seats: number, luggage_count?: number) => {
    try {
      set({ isPaying: true, error: null });

      const response = await api.post<{
        success: boolean;
        message: string;
        booking: any;
        payment: {
          amount: number;
          amount_display: string;
          method: string;
          new_balance: number;
          new_balance_display: string;
          fees_saved: string;
        };
      }>("/payments/wallet", { rideId, seats, luggage_count: luggage_count || 0 });

      // Update wallet balance in local state
      const wallet = get().wallet;
      if (wallet && response.data.payment) {
        set({
          wallet: {
            ...wallet,
            balance: response.data.payment.new_balance,
            balance_display: response.data.payment.new_balance_display,
          },
        });
      }

      // Refresh wallet data to get updated transactions
      await get().getWallet();

      return {
        success: true,
        message: response.data.message || "Payment successful!",
        booking: response.data.booking,
        newBalance: response.data.payment?.new_balance,
      };
    } catch (error: any) {
      const message = error.response?.data?.message || "Payment failed";
      set({ error: message });
      return { 
        success: false, 
        message,
        insufficientBalance: error.response?.data?.code === "INSUFFICIENT_BALANCE",
        required: error.response?.data?.required_display,
        available: error.response?.data?.available_display,
      };
    } finally {
      set({ isPaying: false });
    }
  },

  clearError: () => set({ error: null }),
}));
