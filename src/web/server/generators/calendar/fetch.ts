/**
 * ICS calendar feed fetcher + parser.
 */

import * as ical from "node-ical";

export interface CalendarEvent {
  summary: string;
  start: Date;
  end: Date;
  allDay: boolean;
}

export interface CalendarData {
  events: CalendarEvent[];
  calendarName: string;
}

export async function fetchCalendar(
  icsUrl: string,
  calendarName: string,
): Promise<CalendarData> {
  const res = await fetch(icsUrl);
  if (!res.ok) {
    throw new Error(`ICS feed returned ${res.status}: ${await res.text()}`);
  }

  const icsText = await res.text();
  const parsed = ical.sync.parseICS(icsText);

  const events: CalendarEvent[] = [];

  for (const key of Object.keys(parsed)) {
    const component = parsed[key];
    if (!component || component.type !== "VEVENT") continue;

    const evt = component as ical.VEvent;
    const start = evt.start instanceof Date ? evt.start : new Date(evt.start);
    const end = evt.end instanceof Date ? evt.end : new Date(evt.end ?? start);

    // Detect all-day events: datetype property or midnight-to-midnight
    const allDay =
      (evt as Record<string, unknown>).datetype === "date" ||
      (start.getHours() === 0 &&
        start.getMinutes() === 0 &&
        end.getHours() === 0 &&
        end.getMinutes() === 0 &&
        end.getTime() - start.getTime() >= 86400000);

    // Extract summary — may be string or ParameterValue
    const rawSummary = evt.summary;
    const summary =
      typeof rawSummary === "string"
        ? rawSummary
        : rawSummary
          ? (rawSummary as { val: string }).val
          : "(No title)";

    events.push({
      summary,
      start,
      end,
      allDay,
    });
  }

  // Sort by start time
  events.sort((a, b) => a.start.getTime() - b.start.getTime());

  return { events, calendarName };
}

/**
 * Bucket events into days relative to the given timezone.
 * Returns a map of YYYY-MM-DD → events for that day.
 */
export function bucketByDay(
  events: CalendarEvent[],
  timezone: string,
  days: number,
): Map<string, CalendarEvent[]> {
  const buckets = new Map<string, CalendarEvent[]>();

  // Generate date keys for the next N days
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() + i * 86400000);
    const key = d.toLocaleDateString("sv-SE", { timeZone: timezone }); // YYYY-MM-DD
    buckets.set(key, []);
  }

  for (const evt of events) {
    const key = evt.start.toLocaleDateString("sv-SE", { timeZone: timezone });
    if (buckets.has(key)) {
      buckets.get(key)!.push(evt);
    }
  }

  return buckets;
}
