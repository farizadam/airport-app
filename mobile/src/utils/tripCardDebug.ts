type TripTargetType = "ride" | "request";

interface TraceEntry {
  startMs: number;
  source: string;
}

const traces = new Map<string, TraceEntry>();
const MAX_AGE_MS = 2 * 60 * 1000;

const getKey = (type: TripTargetType, id: string) => `${type}:${id}`;

const cleanupStale = () => {
  const now = Date.now();
  for (const [key, value] of traces.entries()) {
    if (now - value.startMs > MAX_AGE_MS) {
      traces.delete(key);
    }
  }
};

export const startTripCardNavigationTrace = (
  type: TripTargetType,
  id: string,
  source = "TripCard"
) => {
  cleanupStale();
  traces.set(getKey(type, id), {
    startMs: Date.now(),
    source,
  });
  console.log(`[TripCardPerf] trace started type=${type} id=${id} source=${source}`);
};

export const logTripScreenOpened = (
  type: TripTargetType,
  id: string,
  screenName: string
) => {
  const trace = traces.get(getKey(type, id));
  if (!trace) return;

  const elapsedMs = Date.now() - trace.startMs;
  console.log(
    `[TripCardPerf] screen opened screen=${screenName} type=${type} id=${id} elapsedMs=${elapsedMs}`
  );
};

export const logTripScreenDisplayed = (
  type: TripTargetType,
  id: string,
  screenName: string
) => {
  const key = getKey(type, id);
  const trace = traces.get(key);
  if (!trace) return;

  const elapsedMs = Date.now() - trace.startMs;
  console.log(
    `[TripCardPerf] content displayed screen=${screenName} type=${type} id=${id} elapsedMs=${elapsedMs}`
  );
  traces.delete(key);
};
