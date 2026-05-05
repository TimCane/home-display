/**
 * Garmin Connect client.
 * Fetches daily health stats, sleep detail, weight, hydration,
 * weekly steps, and recent activities using the garmin-connect package.
 */

import { GarminConnect } from "garmin-connect";

/* ── Exported data types ───────────────────────────────────────── */

export interface GarminDailyStats {
  steps: number;
  heartRate: {
    resting: number | null;
    max: number | null;
    min: number | null;
  };
  sleep: {
    hours: number;
    minutes: number;
  } | null;
}

export interface GarminSleepDetail {
  totalSeconds: number;
  deepSeconds: number;
  lightSeconds: number;
  remSeconds: number;
  awakeSeconds: number;
  sleepScore: number | null;
  avgStress: number | null;
  bodyBatteryChange: number | null;
  restingHeartRate: number | null;
  avgOvernightHrv: number | null;
}

export interface GarminWeightData {
  weightGrams: number | null;
  bmi: number | null;
  bodyFatPct: number | null;
  bodyWaterPct: number | null;
  muscleMassGrams: number | null;
  boneMassGrams: number | null;
}

export interface GarminActivity {
  name: string;
  type: string;
  distance: number;       // metres
  duration: number;       // seconds
  averageHR: number | null;
  maxHR: number | null;
  calories: number;
  elevationGain: number;
  averageSpeed: number;   // m/s
  startTime: string;
  steps: number;
}

export interface DailySteps {
  date: string;   // "Mon", "Tue", etc.
  steps: number;
}

export interface GarminData {
  displayName: string;
  daily: GarminDailyStats;
  sleepDetail: GarminSleepDetail | null;
  weight: GarminWeightData | null;
  hydrationMl: number | null;
  weeklySteps: DailySteps[];
  recentActivities: GarminActivity[];
}

interface GarminConfig {
  username: string;
  password: string;
}

/* ── Date helpers ──────────────────────────────────────────────── */

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "short" });
}

/* ── Fetch ─────────────────────────────────────────────────────── */

export async function fetchGarmin(config: GarminConfig): Promise<GarminData> {
  const client = new GarminConnect({
    username: config.username,
    password: config.password,
  });

  await client.login();

  const today = new Date();

  // ── Parallel batch 1: core daily data ──
  const [steps, heartRate, sleepDuration, sleepData, activities, profile] =
    await Promise.all([
      client.getSteps(today).catch(() => 0),
      client.getHeartRate(today).catch(() => null),
      client.getSleepDuration(today).catch(() => null),
      client.getSleepData(today).catch(() => null),
      client.getActivities(0, 10).catch(() => []),
      client.getUserProfile().catch(() => null),
    ]);

  // ── Parallel batch 2: weight, hydration, weekly steps ──
  const weeklyStepsPromises = Array.from({ length: 7 }, (_, i) => {
    const d = daysAgo(6 - i); // oldest first
    return client.getSteps(d).catch(() => 0).then((s) => ({
      date: dayLabel(d),
      steps: typeof s === "number" ? s : 0,
    }));
  });

  const [weightData, hydration, ...weeklyStepsResults] = await Promise.all([
    client.getDailyWeightData(today).catch(() => null),
    client.getDailyHydration(today).catch(() => null),
    ...weeklyStepsPromises,
  ]);

  // ── Assemble daily stats ──
  const daily: GarminDailyStats = {
    steps: typeof steps === "number" ? steps : 0,
    heartRate: {
      resting: (heartRate as Record<string, unknown>)?.restingHeartRate as number ?? null,
      max: (heartRate as Record<string, unknown>)?.maxHeartRate as number ?? null,
      min: (heartRate as Record<string, unknown>)?.minHeartRate as number ?? null,
    },
    sleep: sleepDuration
      ? { hours: sleepDuration.hours, minutes: sleepDuration.minutes }
      : null,
  };

  // ── Assemble sleep detail ──
  let sleepDetail: GarminSleepDetail | null = null;
  if (sleepData) {
    const sd = sleepData as Record<string, unknown>;
    const dto = sd.dailySleepDTO as Record<string, unknown> | undefined;
    const scores = dto?.sleepScores as Record<string, Record<string, unknown>> | undefined;

    sleepDetail = {
      totalSeconds: (dto?.sleepTimeSeconds as number) ?? 0,
      deepSeconds: (dto?.deepSleepSeconds as number) ?? 0,
      lightSeconds: (dto?.lightSleepSeconds as number) ?? 0,
      remSeconds: (dto?.remSleepSeconds as number) ?? 0,
      awakeSeconds: (dto?.awakeSleepSeconds as number) ?? 0,
      sleepScore: (scores?.overall?.value as number) ?? null,
      avgStress: (dto?.avgSleepStress as number) ?? null,
      bodyBatteryChange: (sd.bodyBatteryChange as number) ?? null,
      restingHeartRate: (sd.restingHeartRate as number) ?? null,
      avgOvernightHrv: (sd.avgOvernightHrv as number) ?? null,
    };
  }

  // ── Assemble weight ──
  let weight: GarminWeightData | null = null;
  if (weightData) {
    const wd = weightData as Record<string, unknown>;
    const avg = wd.totalAverage as Record<string, unknown> | undefined;
    const list = wd.dateWeightList as Record<string, unknown>[] | undefined;
    const latest = list?.[list.length - 1] ?? avg;

    if (latest) {
      weight = {
        weightGrams: (latest.weight as number) ?? null,
        bmi: (latest.bmi as number) ?? null,
        bodyFatPct: (latest.bodyFat as number) ?? null,
        bodyWaterPct: (latest.bodyWater as number) ?? null,
        muscleMassGrams: (latest.muscleMass as number) ?? null,
        boneMassGrams: (latest.boneMass as number) ?? null,
      };
    }
  }

  // ── Assemble hydration (API returns ounces, convert to ml) ──
  const hydrationMl =
    typeof hydration === "number" ? Math.round(hydration * 29.5735) : null;

  // ── Assemble activities ──
  const recentActivities: GarminActivity[] = (activities as Record<string, unknown>[]).map(
    (a) => ({
      name: (a.activityName as string) ?? "Activity",
      type: ((a.activityType as Record<string, unknown>)?.typeKey as string) ?? "other",
      distance: (a.distance as number) ?? 0,
      duration: (a.duration as number) ?? 0,
      averageHR: (a.averageHR as number) ?? null,
      maxHR: (a.maxHR as number) ?? null,
      calories: (a.calories as number) ?? 0,
      elevationGain: (a.elevationGain as number) ?? 0,
      averageSpeed: (a.averageSpeed as number) ?? 0,
      startTime: (a.startTimeLocal as string) ?? "",
      steps: (a.steps as number) ?? 0,
    }),
  );

  // ── Display name ──
  // Garmin sometimes returns a GUID-like string — just leave it blank.
  const isGuid = (s: unknown): boolean =>
    typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s);

  const raw = (profile as Record<string, unknown>)?.displayName as string | undefined;
  const displayName = raw && !isGuid(raw) ? raw : "";

  return {
    displayName,
    daily,
    sleepDetail,
    weight,
    hydrationMl,
    weeklySteps: weeklyStepsResults,
    recentActivities,
  };
}
