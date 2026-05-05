/**
 * Wikipedia "On this day" API client.
 * https://api.wikimedia.org/wiki/Feed_API/Reference/On_this_day
 */

export interface OnThisDayEvent {
  year: number;
  text: string;
}

export interface OnThisDayData {
  month: number;
  day: number;
  events: OnThisDayEvent[];
}

interface WikiOnThisDayResponse {
  selected: Array<{ text: string; year: number; pages: unknown[] }>;
}

/**
 * Truncate text to a maximum character length, breaking at word boundaries.
 * Appends "…" if the text was shortened.
 */
function truncateEventText(text: string, max: number): string {
  if (text.length <= max) return text;
  const trimmed = text.slice(0, max);
  const lastSpace = trimmed.lastIndexOf(" ");
  const breakPoint = lastSpace > 0 ? lastSpace : max;
  return trimmed.slice(0, breakPoint) + "…";
}

/**
 * Pick up to `count` events spread across different centuries.
 * Sorts by year then picks evenly spaced indices.
 */
function pickSpread(
  events: Array<{ text: string; year: number }>,
  count: number,
): Array<{ text: string; year: number }> {
  if (events.length <= count) return events;

  const sorted = [...events].sort((a, b) => a.year - b.year);
  const step = (sorted.length - 1) / (count - 1);
  const picked: Array<{ text: string; year: number }> = [];

  for (let i = 0; i < count; i++) {
    const idx = Math.round(i * step);
    picked.push(sorted[idx]);
  }

  return picked;
}

export async function fetchOnThisDay(
  maxEvents: number,
  timezone: string,
): Promise<OnThisDayData> {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const month = Number(parts.find((p) => p.type === "month")!.value);
  const day = Number(parts.find((p) => p.type === "day")!.value);

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");

  const url = `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/selected/${mm}/${dd}`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
    headers: {
      "User-Agent": "home-display/1.0 (generator plugin)",
    },
  });

  if (!res.ok) {
    throw new Error(
      `Wikipedia On This Day API returned ${res.status}: ${await res.text()}`,
    );
  }

  const json = (await res.json()) as WikiOnThisDayResponse;
  const selected = json.selected ?? [];

  const picked = pickSpread(selected, maxEvents);

  const events: OnThisDayEvent[] = picked
    .sort((a, b) => a.year - b.year)
    .map((e) => ({
      year: e.year,
      text: truncateEventText(e.text, 120),
    }));

  return { month, day, events };
}
