import { apiGet } from "@/lib/api";
import { Airport } from "@/types";
import { create } from "zustand";

const AIRPORTS_CACHE_TTL_MS = 300_000;
const airportsCache = new Map<string, { timestamp: number; data: Airport[] }>();
const airportsInFlight = new Map<string, Promise<Airport[]>>();

const normalizeCoord = (value?: number) => {
  if (value === undefined || value === null || Number.isNaN(value)) return value;
  // Round to ~1.1km precision so small map pans reuse cache.
  return Number(value.toFixed(2));
};

const withSmartDefaults = (params?: FetchAirportsParams): FetchAirportsParams => {
  const normalized = { ...(params || {}) };
  const hasGeo =
    normalized.latitude !== undefined && normalized.longitude !== undefined;

  if (hasGeo && normalized.limit === undefined) {
    normalized.limit = 80;
  }
  if (!hasGeo && !normalized.q && normalized.limit === undefined) {
    normalized.limit = 2000;
  }

  if (normalized.latitude !== undefined) {
    normalized.latitude = normalizeCoord(normalized.latitude);
  }
  if (normalized.longitude !== undefined) {
    normalized.longitude = normalizeCoord(normalized.longitude);
  }

  return normalized;
};

const cacheKeyFromParams = (params?: FetchAirportsParams) => {
  const normalizedParams = withSmartDefaults(params);
  if (!normalizedParams || Object.keys(normalizedParams).length === 0) return "all";

  const entries = Object.entries(normalizedParams)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
};

interface FetchAirportsParams {
  q?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
  limit?: number;
}

interface AirportState {
  airports: Airport[];
  isLoading: boolean;
  fetchAirports: (params?: FetchAirportsParams) => Promise<void>;
}

export const useAirportStore = create<AirportState>((set) => ({
  airports: [],
  isLoading: false,

  fetchAirports: async (params?: FetchAirportsParams) => {
    const requestParams = withSmartDefaults(params);
    const cacheKey = cacheKeyFromParams(requestParams);
    const now = Date.now();

    const cached = airportsCache.get(cacheKey);
    if (cached && now - cached.timestamp < AIRPORTS_CACHE_TTL_MS) {
      set({ airports: cached.data });
      return;
    }

    const pending = airportsInFlight.get(cacheKey);
    if (pending) {
      const airports = await pending;
      set({ airports });
      return;
    }

    try {
      set({ isLoading: true });
      const request = apiGet<{ data: Airport[] }>("/airports", { params: requestParams }, { ttlMs: AIRPORTS_CACHE_TTL_MS, dedupe: true })
        .then((response) => {
          const airports = response.data.data || [];
          // Filter out airports with missing coordinates so map markers always render
          const validAirports = airports.filter(
            (a: Airport) =>
              a.latitude != null &&
              a.longitude != null &&
              !isNaN(a.latitude) &&
              !isNaN(a.longitude)
          );
          airportsCache.set(cacheKey, { timestamp: Date.now(), data: validAirports });
          return validAirports;
        });

      airportsInFlight.set(cacheKey, request);
      const validAirports = await request;
      set({ airports: validAirports });
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Failed to fetch airports"
      );
    } finally {
      airportsInFlight.delete(cacheKey);
      set({ isLoading: false });
    }
  },
}));
