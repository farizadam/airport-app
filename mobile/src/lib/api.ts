import axios, { AxiosError } from "axios";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Determine API URL based on platform and environment
const getApiBaseUrl = (): string => {
  // Priority: expo config > env vars > platform-specific defaults
  if (Constants.expoConfig?.extra?.apiBaseUrl) {
    return Constants.expoConfig.extra.apiBaseUrl;
  }

  if (Platform.OS === "android") {
    return (
      process.env.EXPO_PUBLIC_ANDROID_API_URL || "http://10.0.2.2:3000/api/v1"
    );
  }

  if (Platform.OS === "ios") {
    return (
      process.env.EXPO_PUBLIC_IOS_API_URL || "http://100.88.64.200:3000/api/v1"
    );
  }

  // Fallback for web and physical devices
  return process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3000/api/v1";
};

const API_BASE_URL = getApiBaseUrl();

if (__DEV__) {
  // Log resolved base URL in dev to debug env issues on device/emulator
  console.log("API base URL:", API_BASE_URL);
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor - add token
api.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await SecureStore.getItemAsync("refreshToken");
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken, refreshToken: newRefreshToken } =
            response.data.data;

          await SecureStore.setItemAsync("accessToken", accessToken);
          await SecureStore.setItemAsync("refreshToken", newRefreshToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        await SecureStore.deleteItemAsync("accessToken");
        await SecureStore.deleteItemAsync("refreshToken");
        // Navigation will be handled by the auth store
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
