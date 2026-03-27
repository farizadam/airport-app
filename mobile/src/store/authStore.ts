import api, { apiGet, clearAccessTokenCache, clearApiGetCache, setAccessTokenCache } from "@/lib/api";
import { User } from "@/types";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<{ profile_complete: boolean }>;
  loginWithFacebook: (accessToken: string) => Promise<{ profile_complete: boolean }>;
  completeProfile: (data: CompleteProfileData) => Promise<void>;
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

interface CompleteProfileData {
  phone?: string;
  firebase_token?: string;
  id_image_front?: string;
  id_image_back?: string;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setLoading: (loading) => set({ isLoading: loading }),

  login: async (email, password) => {
    try {
      const response = await api.post("/auth/login", { email, password });
      const { user, accessToken, refreshToken } = response.data.data;
      await SecureStore.setItemAsync("accessToken", accessToken);
      await SecureStore.setItemAsync("refreshToken", refreshToken);
      setAccessTokenCache(accessToken);
      clearApiGetCache();
      set({ user, isAuthenticated: true });
    } catch (error: any) {
      const apiMessage = error.response?.data?.message;
      if (apiMessage === "Application not found") {
        throw new Error(
          "Backend URL is invalid or offline. Update EXPO_PUBLIC_API_BASE_URL to a live API and restart Expo."
        );
      }
      throw new Error(apiMessage || "Login failed");
    }
  },

  loginWithGoogle: async (idToken) => {
    try {
      const response = await api.post("/auth/google", { id_token: idToken });
      const { user, accessToken, refreshToken, profile_complete } = response.data.data;
      await SecureStore.setItemAsync("accessToken", accessToken);
      await SecureStore.setItemAsync("refreshToken", refreshToken);
      setAccessTokenCache(accessToken);
      clearApiGetCache();
      set({ user, isAuthenticated: true });
      return { profile_complete };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Google login failed");
    }
  },

  loginWithFacebook: async (accessToken) => {
    try {
      const response = await api.post("/auth/facebook", { access_token: accessToken });
      const { user, accessToken: at, refreshToken, profile_complete } = response.data.data;
      await SecureStore.setItemAsync("accessToken", at);
      await SecureStore.setItemAsync("refreshToken", refreshToken);
      setAccessTokenCache(at);
      clearApiGetCache();
      set({ user, isAuthenticated: true });
      return { profile_complete };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Facebook login failed");
    }
  },

  completeProfile: async (data) => {
    try {
      const response = await api.post("/auth/complete-profile", data);
      const { user } = response.data.data;
      set({ user });
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Failed to complete profile");
    }
  },

  register: async (data) => {
    try {
      const response = await api.post("/auth/register", data);
      const { user, accessToken, refreshToken } = response.data.data;

      await SecureStore.setItemAsync("accessToken", accessToken);
      await SecureStore.setItemAsync("refreshToken", refreshToken);
      setAccessTokenCache(accessToken);
      clearApiGetCache();

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
      clearAccessTokenCache();
      clearApiGetCache();
      set({ user: null, isAuthenticated: false });
    }
  },

  loadUser: async () => {
    try {
      set({ isLoading: true });
      const token = await SecureStore.getItemAsync("accessToken");

      if (token) {
        try {
          const response = await apiGet("/users/me", undefined, { ttlMs: 5_000 });
          console.log("👤 Loaded User Data successfully.");

          if (
            response.data.data &&
            (response.data.data._id || response.data.data.id)
          ) {
            set({ user: response.data.data, isAuthenticated: true });
          } else {
            console.warn("⚠️ User data invalid (no ID). Logging out.");
            await SecureStore.deleteItemAsync("accessToken");
            await SecureStore.deleteItemAsync("refreshToken");
            clearAccessTokenCache();
            clearApiGetCache();
            set({ user: null, isAuthenticated: false });
          }
        } catch (apiError: any) {
          console.error("Failed to fetch user data:", apiError);

          if (apiError.response?.status === 401) {
            await SecureStore.deleteItemAsync("accessToken");
            await SecureStore.deleteItemAsync("refreshToken");
            clearAccessTokenCache();
            clearApiGetCache();
            set({ user: null, isAuthenticated: false });
          } else {
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
      const response = await apiGet("/users/me", undefined, { ttlMs: 5_000 });
      set({ user: response.data.data });
    } catch (error) {
      console.error("Failed to refresh user:", error);
    }
  },
}));
