/**
 * Economic Calendar - Static high-impact event dates
 *
 * Phase 1 of 4-phase regime detection system.
 * Dampens signal confidence during scheduled economic events.
 *
 * Zero API cost - all data is static.
 */

export type EconomicEvent = "FOMC" | "CPI" | "NFP" | "Fed_Speech" | "ECB" | "BOJ";

export interface EventConfig {
  name: string;
  windowHours: number; // Hours before/after event to dampen
  dampening: number; // Multiply signal confidence by this (0.0-1.0)
  description: string;
}

export const EVENT_CONFIG: Record<EconomicEvent, EventConfig> = {
  FOMC: {
    name: "FOMC Decision",
    windowHours: 24,
    dampening: 0.5,
    description: "Federal Reserve interest rate decision",
  },
  CPI: {
    name: "CPI Release",
    windowHours: 4,
    dampening: 0.6,
    description: "Consumer Price Index inflation data",
  },
  NFP: {
    name: "Non-Farm Payrolls",
    windowHours: 4,
    dampening: 0.6,
    description: "US employment report",
  },
  Fed_Speech: {
    name: "Fed Chair Speech",
    windowHours: 2,
    dampening: 0.8,
    description: "Federal Reserve Chair public remarks",
  },
  ECB: {
    name: "ECB Decision",
    windowHours: 12,
    dampening: 0.7,
    description: "European Central Bank rate decision",
  },
  BOJ: {
    name: "BOJ Decision",
    windowHours: 12,
    dampening: 0.7,
    description: "Bank of Japan policy decision",
  },
};

/**
 * 2026 Economic Calendar
 * Format: "YYYY-MM-DD" -> [events]
 *
 * Sources:
 * - FOMC: https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
 * - CPI: Bureau of Labor Statistics (typically 2nd Tuesday of month)
 * - NFP: First Friday of each month
 * - ECB: https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html
 */
const CALENDAR_2026: Record<string, EconomicEvent[]> = {
  // January 2026
  "2026-01-10": ["NFP"],
  "2026-01-14": ["CPI"],
  "2026-01-29": ["FOMC"],

  // February 2026
  "2026-02-06": ["NFP"],
  "2026-02-12": ["CPI"],

  // March 2026
  "2026-03-06": ["NFP"],
  "2026-03-11": ["CPI"],
  "2026-03-12": ["ECB"],
  "2026-03-18": ["FOMC", "BOJ"],

  // April 2026
  "2026-04-03": ["NFP"],
  "2026-04-10": ["CPI"],
  "2026-04-16": ["ECB"],

  // May 2026
  "2026-05-01": ["NFP"],
  "2026-05-06": ["FOMC"],
  "2026-05-13": ["CPI"],

  // June 2026
  "2026-06-05": ["NFP"],
  "2026-06-04": ["ECB"],
  "2026-06-10": ["CPI"],
  "2026-06-17": ["FOMC", "BOJ"],

  // July 2026
  "2026-07-02": ["NFP"],
  "2026-07-14": ["CPI"],
  "2026-07-16": ["ECB"],
  "2026-07-29": ["FOMC"],

  // August 2026
  "2026-08-07": ["NFP"],
  "2026-08-12": ["CPI"],

  // September 2026
  "2026-09-04": ["NFP"],
  "2026-09-10": ["ECB"],
  "2026-09-11": ["CPI"],
  "2026-09-16": ["FOMC", "BOJ"],

  // October 2026
  "2026-10-02": ["NFP"],
  "2026-10-13": ["CPI"],
  "2026-10-29": ["ECB", "BOJ"],

  // November 2026
  "2026-11-04": ["FOMC"],
  "2026-11-06": ["NFP"],
  "2026-11-12": ["CPI"],

  // December 2026
  "2026-12-04": ["NFP"],
  "2026-12-10": ["CPI", "ECB"],
  "2026-12-16": ["FOMC"],
  "2026-12-18": ["BOJ"],
};

/**
 * Get all events scheduled for a specific date
 */
export function getEventsForDate(date: string): EconomicEvent[] {
  return CALENDAR_2026[date] || [];
}

/**
 * Get events within a date range (for displaying upcoming events)
 */
export function getEventsInRange(
  startDate: string,
  days: number
): Array<{ date: string; events: EconomicEvent[] }> {
  const result: Array<{ date: string; events: EconomicEvent[] }> = [];
  const start = new Date(startDate);

  // Check days + 1 to include the full range (e.g., 7 days = check days 0-7)
  for (let i = 0; i <= days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const events = getEventsForDate(dateStr);
    if (events.length > 0) {
      result.push({ date: dateStr, events });
    }
  }

  return result;
}

/**
 * Parse time slot to hours (e.g., "14:00" -> 14)
 */
function parseTimeSlot(timeSlot: string): number {
  const [hours] = timeSlot.split(":").map(Number);
  return hours;
}

/**
 * Check if current time is within the event window
 *
 * Event windows are centered around market close (16:00 EST / 21:00 UTC)
 * For FOMC: 24h window means signals dampened for the whole day
 * For CPI/NFP: 4h window means morning of release
 */
export function isInEventWindow(
  date: string,
  timeSlot: string,
  event: EconomicEvent
): boolean {
  const events = getEventsForDate(date);
  if (!events.includes(event)) return false;

  const config = EVENT_CONFIG[event];
  const currentHour = parseTimeSlot(timeSlot);

  // For FOMC (24h window): all time slots are in window
  if (config.windowHours >= 24) {
    return true;
  }

  // For CPI/NFP (4h window): 8:30 AM EST release = 13:30 UTC
  // Window: 12:00-16:00 UTC (covers 08:00, 14:00, 16:00 time slots)
  if (event === "CPI" || event === "NFP") {
    return currentHour >= 8 && currentHour <= 17;
  }

  // For Fed_Speech (2h window): depends on scheduled time
  // Default: dampen afternoon slots
  if (event === "Fed_Speech") {
    return currentHour >= 14 && currentHour <= 21;
  }

  // For ECB/BOJ (12h window): morning through afternoon
  if (event === "ECB" || event === "BOJ") {
    return currentHour >= 6 && currentHour <= 18;
  }

  return false;
}

/**
 * Calculate the combined dampening factor for all active events
 * Returns the most restrictive (lowest) dampening factor
 */
export function getEventDampening(date: string, timeSlot: string): number {
  const events = getEventsForDate(date);
  if (events.length === 0) return 1.0; // No dampening

  let minDampening = 1.0;
  for (const event of events) {
    if (isInEventWindow(date, timeSlot, event)) {
      const config = EVENT_CONFIG[event];
      minDampening = Math.min(minDampening, config.dampening);
    }
  }

  return minDampening;
}

/**
 * Get active event window data for the current time
 */
export interface ActiveEventWindow {
  event: EconomicEvent;
  config: EventConfig;
  dampening: number;
}

export function getActiveEventWindows(
  date: string,
  timeSlot: string
): ActiveEventWindow[] {
  const events = getEventsForDate(date);
  const active: ActiveEventWindow[] = [];

  for (const event of events) {
    if (isInEventWindow(date, timeSlot, event)) {
      active.push({
        event,
        config: EVENT_CONFIG[event],
        dampening: EVENT_CONFIG[event].dampening,
      });
    }
  }

  return active;
}

/**
 * Format upcoming events for display
 */
export function formatUpcomingEvents(
  startDate: string,
  days: number = 7
): string[] {
  const upcoming = getEventsInRange(startDate, days);
  return upcoming.map(({ date, events }) => {
    const eventNames = events.map((e) => EVENT_CONFIG[e].name).join(", ");
    const daysDiff = Math.ceil(
      (new Date(date).getTime() - new Date(startDate).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    const dayLabel =
      daysDiff === 0 ? "Today" : daysDiff === 1 ? "Tomorrow" : `In ${daysDiff}d`;
    return `${dayLabel}: ${eventNames}`;
  });
}
