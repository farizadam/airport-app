import axios, { AxiosError } from "axios";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Determine API URL based on platform and environment
const getApiBaseUrl = (): string => {
  // 1. Manual: If specific env var is set, use it (Good for Production)
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    console.log("Using API URL from .env:", process.env.EXPO_PUBLIC_API_BASE_URL);
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }

  // 2. Special handling for Android Emulator
  // Use 10.0.2.2 which is the special IP for the host machine from the emulator
  // This avoids needing to run 'adb reverse' manually every time
  if (Platform.OS === "android" && !Constants.isDevice) {
    console.log("🤖 Android Emulator detected: Using 10.0.2.2");
    return "http://10.0.2.2:3000/api/v1";
  }

  // 3. Automatic: Use the computer's IP address detected by Expo
  if (Constants.expoConfig?.hostUri) {
    const host = Constants.expoConfig.hostUri.split(':')[0];
    console.log("Using auto-detected IP:", host);
    return `http://${host}:3000/api/v1`;
  }

  // 4. Fallback to localhost (Web, iOS Simulator)
  return "http://localhost:3000/api/v1";
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
    console.log(
      "API Request - URL:",
      config.url,
      "Full:",
      config.baseURL + config.url
    );
    const token = await SecureStore.getItemAsync("accessToken");
    if (token) {
      console.log("✅ Token found, adding to request");
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.warn("⚠️ No token found in SecureStore!");
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    // Log detailed error information for debugging
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as any;
      const message = data?.message || JSON.stringify(data);
      console.log(`❌ Backend Error [${status}]: ${message}`);

      if (status === 401 || status === 404) {
        console.log("👉 TIP: You are on a new database. Please REGISTER a new account first.");
      }
    } else if (error.request) {
      console.log("❌ Network Error: Server is unreachable.");
      console.log(`   Target: ${API_BASE_URL}`);

      if (Platform.OS === "android" && !Constants.isDevice) {
        console.log("💡 TIP: Android Emulator detected.");
        console.log("   👉 Ensure backend is running on port 3000.");
      }

      console.log("   1. Check if backend is running (npm run dev)");
      console.log("   2. Check if Phone and PC are on the SAME Wi-Fi");
      console.log("   3. Check Windows Firewall (Port 3000)");
    } else {
      console.log("❌ Error:", error.message);
    }

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
