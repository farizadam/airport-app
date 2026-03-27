import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const API_TIMEOUT_MS = 12000;
const DEBUG_EVENT_LIMIT = 120;

export type ApiDebugEvent = {
  at: number;
  method: string;
  url: string;
  durationMs: number;
  status: number | null;
  source: "network" | "cache" | "dedupe";
  ok: boolean;
};

type ApiDebugStats = {
  totalRequests: number;
  networkRequests: number;
  cacheHits: number;
  dedupeJoins: number;
  errors: number;
  timeoutErrors: number;
  avgNetworkMs: number;
  recent: ApiDebugEvent[];
};

const apiDebugStats: ApiDebugStats = {
  totalRequests: 0,
  networkRequests: 0,
  cacheHits: 0,
  dedupeJoins: 0,
  errors: 0,
  timeoutErrors: 0,
  avgNetworkMs: 0,
  recent: [],
};

const recordApiEvent = (event: ApiDebugEvent) => {
  apiDebugStats.totalRequests += 1;
  if (event.source === "network") {
    apiDebugStats.networkRequests += 1;
    const n = apiDebugStats.networkRequests;
    apiDebugStats.avgNetworkMs =
      (apiDebugStats.avgNetworkMs * (n - 1) + event.durationMs) / n;
  }
  if (event.source === "cache") apiDebugStats.cacheHits += 1;
  if (event.source === "dedupe") apiDebugStats.dedupeJoins += 1;
  if (!event.ok) apiDebugStats.errors += 1;

  apiDebugStats.recent.unshift(event);
  if (apiDebugStats.recent.length > DEBUG_EVENT_LIMIT) {
    apiDebugStats.recent.length = DEBUG_EVENT_LIMIT;
  }
};

export const getApiDebugStats = (): ApiDebugStats => ({
  ...apiDebugStats,
  recent: [...apiDebugStats.recent],
});

export const clearApiDebugStats = () => {
  apiDebugStats.totalRequests = 0;
  apiDebugStats.networkRequests = 0;
  apiDebugStats.cacheHits = 0;
  apiDebugStats.dedupeJoins = 0;
  apiDebugStats.errors = 0;
  apiDebugStats.timeoutErrors = 0;
  apiDebugStats.avgNetworkMs = 0;
  apiDebugStats.recent = [];
};

let cachedAccessToken: string | null = null;
let tokenLoadedFromStorage = false;

type GetCacheEntry = {
  timestamp: number;
  response: AxiosResponse<any>;
};

const getRequestCache = new Map<string, GetCacheEntry>();
const inFlightGetRequests = new Map<string, Promise<AxiosResponse<any>>>();

const stableStringify = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${stableStringify(v)}`);
  return `{${entries.join(",")}}`;
};

const buildGetCacheKey = (url: string, config?: AxiosRequestConfig) => {
  const base = config?.baseURL || API_BASE_URL;
  const paramsKey = stableStringify(config?.params || {});
  return `${base}${url}?${paramsKey}`;
};

export const clearApiGetCache = (prefix?: string) => {
  if (!prefix) {
    getRequestCache.clear();
    inFlightGetRequests.clear();
    return;
  }

  for (const key of getRequestCache.keys()) {
    if (key.includes(prefix)) getRequestCache.delete(key);
  }
  for (const key of inFlightGetRequests.keys()) {
    if (key.includes(prefix)) inFlightGetRequests.delete(key);
  }
};

export const apiGet = async <T = any>(
  url: string,
  config?: AxiosRequestConfig,
  options?: { ttlMs?: number; dedupe?: boolean; force?: boolean }
): Promise<AxiosResponse<T>> => {
  const ttlMs = options?.ttlMs ?? 15_000;
  const dedupe = options?.dedupe ?? true;
  const force = options?.force ?? false;

  if (ttlMs <= 0 && !dedupe) {
    return api.get<T>(url, config);
  }

  const key = buildGetCacheKey(url, config);
  const now = Date.now();

  if (!force && ttlMs > 0) {
    const cached = getRequestCache.get(key);
    if (cached && now - cached.timestamp < ttlMs) {
      recordApiEvent({
        at: Date.now(),
        method: "GET",
        url,
        durationMs: 0,
        status: cached.response.status,
        source: "cache",
        ok: true,
      });
      return cached.response as AxiosResponse<T>;
    }
  }

  if (!force && dedupe) {
    const pending = inFlightGetRequests.get(key);
    if (pending) {
      recordApiEvent({
        at: Date.now(),
        method: "GET",
        url,
        durationMs: 0,
        status: null,
        source: "dedupe",
        ok: true,
      });
      return pending as Promise<AxiosResponse<T>>;
    }
  }

  const request = api.get<T>(url, config).then((response) => {
    if (ttlMs > 0) {
      getRequestCache.set(key, { timestamp: Date.now(), response });
    }
    return response;
  }).finally(() => {
    inFlightGetRequests.delete(key);
  });

  if (dedupe) {
    inFlightGetRequests.set(key, request as Promise<AxiosResponse<any>>);
  }

  return request;
};

export const setAccessTokenCache = (token: string | null) => {
  cachedAccessToken = token;
  tokenLoadedFromStorage = true;
};

export const clearAccessTokenCache = () => {
  cachedAccessToken = null;
  tokenLoadedFromStorage = true;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getAccessToken = async (): Promise<string | null> => {
  if (tokenLoadedFromStorage) return cachedAccessToken;
  cachedAccessToken = await SecureStore.getItemAsync("accessToken");
  tokenLoadedFromStorage = true;
  return cachedAccessToken;
};

// Determine API URL based on platform and environment
const getApiBaseUrl = (): string => {
  // PRODUCTION URL - Always use this for builds distributed to clients
  const PRODUCTION_URL = "https://backendairportapp-production.up.railway.app/api/v1";
  
  // 1. Manual: If specific env var is set, use it (Good for Production)
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    console.log("Using API URL from .env:", process.env.EXPO_PUBLIC_API_BASE_URL);
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }

  // 2. For development builds, always use production URL (works on any WiFi)
  if (!__DEV__) {
    console.log("Production build: Using production URL");
    return PRODUCTION_URL;
  }

  // 3. Special handling for Android Emulator (Dev only)
  // Use 10.0.2.2 which is the special IP for the host machine from the emulator
  // This avoids needing to run 'adb reverse' manually every time
  if (Platform.OS === "android" && !Constants.isDevice) {
    console.log("🤖 Android Emulator detected: Using 10.0.2.2");
    return "http://10.0.2.2:3000/api/v1";
  }

  // 4. Automatic: Use the computer's IP address detected by Expo (Dev only)
  if (Constants.expoConfig?.hostUri) {
    const host = Constants.expoConfig.hostUri.split(':')[0];
    console.log("Using auto-detected IP:", host);
    return `http://${host}:3000/api/v1`;
  }

  // 5. Fallback to production for any other case
  console.log("Fallback: Using production URL");
  return PRODUCTION_URL;
};

const API_BASE_URL = getApiBaseUrl();

if (__DEV__) {
  // Log resolved base URL in dev to debug env issues on device/emulator
  console.log("API base URL:", API_BASE_URL);
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor - add token
api.interceptors.request.use(
  async (config) => {
    const token = await getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (__DEV__) {
      (config as any).metadata = { startTime: Date.now() };
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      const started = (response.config as any)?.metadata?.startTime;
      if (started) {
        const elapsed = Date.now() - started;
        console.log(`API ${response.config.method?.toUpperCase()} ${response.config.url} ${elapsed}ms`);
        recordApiEvent({
          at: Date.now(),
          method: (response.config.method || "GET").toUpperCase(),
          url: response.config.url || "",
          durationMs: elapsed,
          status: response.status,
          source: "network",
          ok: true,
        });
      }
    } else {
      recordApiEvent({
        at: Date.now(),
        method: (response.config.method || "GET").toUpperCase(),
        url: response.config.url || "",
        durationMs: 0,
        status: response.status,
        source: "network",
        ok: true,
      });
    }
    return response;
  },
  async (error: AxiosError) => {
    const started = (error.config as any)?.metadata?.startTime;
    const elapsed = started ? Date.now() - started : 0;
    recordApiEvent({
      at: Date.now(),
      method: (error.config?.method || "GET").toUpperCase(),
      url: error.config?.url || "",
      durationMs: elapsed,
      status: error.response?.status ?? null,
      source: "network",
      ok: false,
    });

    // Log error
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as any;
      const message = data?.message || JSON.stringify(data);
      console.log(`❌ Backend Error [${status}]: ${message}`);
    } else if (error.code === "ECONNABORTED") {
      console.log(`❌ Request timed out after ${API_TIMEOUT_MS}ms`);
    } else if (error.request) {
      console.log("❌ Network Error: Server is unreachable.");
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
           refresh_token: refreshToken,
        }, {
            timeout: API_TIMEOUT_MS,
          });

          const { accessToken, refreshToken: newRefreshToken } =
            response.data.data;

          await SecureStore.setItemAsync("accessToken", accessToken);
          await SecureStore.setItemAsync("refreshToken", newRefreshToken);
          setAccessTokenCache(accessToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        await SecureStore.deleteItemAsync("accessToken");
        await SecureStore.deleteItemAsync("refreshToken");
        clearAccessTokenCache();
        // Navigation will be handled by the auth store
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
