import api from "@/lib/api";
import { User } from "@/types";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  login: (email: string, password?: string) => Promise<void>;
  loginWithGoogle: (
    user: User,
    accessToken: string,
    refreshToken: string,
  ) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: "driver" | "passenger" | "both";
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setLoading: (loading) => set({ isLoading: loading }),

  login: async (email, password) => {
    try {
      if (!password) {
        // Google login fallback: just set user as authenticated (already handled by loginWithGoogle)
        set({ user: { email } as User, isAuthenticated: true });
        return;
      }
      const response = await api.post("/auth/login", { email, password });
      const { user, accessToken, refreshToken } = response.data.data;
      await SecureStore.setItemAsync("accessToken", accessToken);
      await SecureStore.setItemAsync("refreshToken", refreshToken);
      set({ user, isAuthenticated: true });
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Login failed");
    }
  },

  loginWithGoogle: async (user, accessToken, refreshToken) => {
    await SecureStore.setItemAsync("accessToken", accessToken);
    await SecureStore.setItemAsync("refreshToken", refreshToken);
    set({ user, isAuthenticated: true });
  },

  register: async (data) => {
    try {
      const response = await api.post("/auth/register", data);
      const { user, accessToken, refreshToken } = response.data.data;

      await SecureStore.setItemAsync("accessToken", accessToken);
      await SecureStore.setItemAsync("refreshToken", refreshToken);

      set({ user, isAuthenticated: true });
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Registration failed");
    }
  },

  logout: async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      await SecureStore.deleteItemAsync("accessToken");
      await SecureStore.deleteItemAsync("refreshToken");
      set({ user: null, isAuthenticated: false });
    }
  },

  loadUser: async () => {
    try {
      set({ isLoading: true });
      const token = await SecureStore.getItemAsync("accessToken");

      if (token) {
        try {
          const response = await api.get("/auth/me");
          console.log(
            "👤 Loaded User Data:",
            JSON.stringify(response.data.data, null, 2),
          );

          if (
            response.data.data &&
            (response.data.data._id || response.data.data.id)
          ) {
            set({ user: response.data.data, isAuthenticated: true });
          } else {
            console.warn("⚠️ User data invalid (no ID). Logging out.");
            await SecureStore.deleteItemAsync("accessToken");
            await SecureStore.deleteItemAsync("refreshToken");
            set({ user: null, isAuthenticated: false });
          }
        } catch (apiError: any) {
          console.error("Failed to fetch user data:", apiError);

          // Only clear tokens if it's an authentication error (401)
          // Keep tokens for network errors so user can retry when backend is available
          if (apiError.response?.status === 401) {
            await SecureStore.deleteItemAsync("accessToken");
            await SecureStore.deleteItemAsync("refreshToken");
            set({ user: null, isAuthenticated: false });
          } else {
            // Network error - keep the tokens but mark as not authenticated for now
            // User can retry or the app will try again
            console.log("Network error - keeping tokens for retry");
            set({ user: null, isAuthenticated: false });
          }
        }
      } else {
        set({ user: null, isAuthenticated: false });
      }
    } catch (error) {
      console.error("LoadUser error:", error);
      set({ user: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },

  refreshUser: async () => {
    try {
      const response = await api.get("/auth/me");
      set({ user: response.data.data });
    } catch (error) {
      console.error("Failed to refresh user:", error);
    }
  },
}));
