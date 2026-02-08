// Market schedule data - fixed version

export interface Market {
  id: string;
  name: string;
  city: string;
  timezone: string;
  openHour: number;
  openMinute: number;
  closeHour: number;
  closeMinute: number;
  tradingDays: number[]; // 0=Sun, 6=Sat
  latitude: number;
  longitude: number;
  isOvernight?: boolean; // For futures that trade overnight
}

export const MARKETS: Market[] = [
  {
    id: 'nyse',
    name: 'New York',
    city: 'New York',
    timezone: 'America/New_York',
    openHour: 9,
    openMinute: 30,
    closeHour: 16,
    closeMinute: 0,
    tradingDays: [1, 2, 3, 4, 5],
    latitude: 40.7128,
    longitude: -74.0060,
  },
  {
    id: 'lse',
    name: 'London',
    city: 'London',
    timezone: 'Europe/London',
    openHour: 8,
    openMinute: 0,
    closeHour: 16,
    closeMinute: 30,
    tradingDays: [1, 2, 3, 4, 5],
    latitude: 51.5074,
    longitude: -0.1278,
  },
  {
    id: 'tse',
    name: 'Tokyo',
    city: 'Tokyo',
    timezone: 'Asia/Tokyo',
    openHour: 9,
    openMinute: 0,
    closeHour: 15,
    closeMinute: 0,
    tradingDays: [1, 2, 3, 4, 5],
    latitude: 35.6762,
    longitude: 139.6503,
  },
  {
    id: 'cme',
    name: 'CME Futures',
    city: 'Chicago',
    timezone: 'America/Chicago',
    openHour: 17,
    openMinute: 0,
    closeHour: 16,
    closeMinute: 0,
    tradingDays: [0, 1, 2, 3, 4, 5],
    latitude: 41.8781,
    longitude: -87.6298,
    isOvernight: true,
  },
  {
    id: 'comex',
    name: 'COMEX Gold',
    city: 'New York',
    timezone: 'America/New_York',
    openHour: 18,
    openMinute: 0,
    closeHour: 17,
    closeMinute: 0,
    tradingDays: [0, 1, 2, 3, 4, 5],
    latitude: 40.7128,
    longitude: -74.0060,
    isOvernight: true,
  },
];

// Get time in specific timezone
function getTimeInZone(timezone: string): { day: number; hours: number; minutes: number; seconds: number } {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  };

  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(now);

  const weekdayMap: { [key: string]: number } = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
  };

  let day = 0, hours = 0, minutes = 0, seconds = 0;

  for (const part of parts) {
    if (part.type === 'weekday') day = weekdayMap[part.value] ?? 0;
    if (part.type === 'hour') hours = parseInt(part.value);
    if (part.type === 'minute') minutes = parseInt(part.value);
    if (part.type === 'second') seconds = parseInt(part.value);
  }

  return { day, hours, minutes, seconds };
}

// Check if market is open
export function isMarketOpen(market: Market): boolean {
  const time = getTimeInZone(market.timezone);
  const currentMins = time.hours * 60 + time.minutes;
  const openMins = market.openHour * 60 + market.openMinute;
  const closeMins = market.closeHour * 60 + market.closeMinute;

  // Saturday - everything closed
  if (time.day === 6) return false;

  // Check if it's a trading day
  if (!market.tradingDays.includes(time.day)) return false;

  // Overnight session (futures)
  if (market.isOvernight) {
    // Friday after close time = closed for weekend
    if (time.day === 5 && currentMins >= closeMins) return false;

    // Opens Sunday evening, closes Friday afternoon
    // Open if: after open time OR before close time (next day)
    return currentMins >= openMins || currentMins < closeMins;
  }

  // Regular session
  return currentMins >= openMins && currentMins < closeMins;
}

// Calculate ms until a specific time in a timezone
function getMsUntil(timezone: string, targetDay: number, targetHour: number, targetMinute: number): number {
  const time = getTimeInZone(timezone);
  const now = new Date();

  let daysToAdd = targetDay - time.day;
  if (daysToAdd < 0) daysToAdd += 7;
  if (daysToAdd === 0) {
    const currentMins = time.hours * 60 + time.minutes;
    const targetMins = targetHour * 60 + targetMinute;
    if (currentMins >= targetMins) {
      daysToAdd = 7; // Next week
    }
  }

  // Calculate target time in ms
  const currentMins = time.hours * 60 + time.minutes;
  const currentSecs = time.seconds;
  const targetMins = targetHour * 60 + targetMinute;

  let totalMins = 0;
  if (daysToAdd === 0) {
    totalMins = targetMins - currentMins;
  } else {
    totalMins = (24 * 60 - currentMins) + (daysToAdd - 1) * 24 * 60 + targetMins;
  }

  return totalMins * 60 * 1000 - currentSecs * 1000;
}

// Get next event for a specific market
function getMarketNextEvent(market: Market): { type: 'open' | 'close'; ms: number } {
  const time = getTimeInZone(market.timezone);
  const currentMins = time.hours * 60 + time.minutes;
  const openMins = market.openHour * 60 + market.openMinute;
  const closeMins = market.closeHour * 60 + market.closeMinute;

  const open = isMarketOpen(market);

  if (open) {
    // Market is open - find time until close
    if (market.isOvernight) {
      // For overnight, close is on Friday at closeHour
      if (time.day === 5) {
        // It's Friday, close today
        const minsUntil = closeMins - currentMins;
        return { type: 'close', ms: minsUntil * 60 * 1000 - time.seconds * 1000 };
      } else {
        // Close on Friday
        let daysUntilFriday = 5 - time.day;
        if (daysUntilFriday <= 0) daysUntilFriday += 7;
        const totalMins = (24 * 60 - currentMins) + (daysUntilFriday - 1) * 24 * 60 + closeMins;
        return { type: 'close', ms: totalMins * 60 * 1000 - time.seconds * 1000 };
      }
    } else {
      // Regular market - close today
      const minsUntil = closeMins - currentMins;
      return { type: 'close', ms: minsUntil * 60 * 1000 - time.seconds * 1000 };
    }
  } else {
    // Market is closed - find time until open
    // Find next trading day
    let bestMs = Infinity;

    for (let i = 0; i <= 7; i++) {
      const checkDay = (time.day + i) % 7;
      if (market.tradingDays.includes(checkDay)) {
        let ms: number;

        if (i === 0 && currentMins < openMins) {
          // Opens later today
          ms = (openMins - currentMins) * 60 * 1000 - time.seconds * 1000;
        } else if (i > 0) {
          // Opens on a future day
          const totalMins = (24 * 60 - currentMins) + (i - 1) * 24 * 60 + openMins;
          ms = totalMins * 60 * 1000 - time.seconds * 1000;
        } else {
          continue;
        }

        if (ms > 0 && ms < bestMs) {
          bestMs = ms;
          break;
        }
      }
    }

    return { type: 'open', ms: bestMs };
  }
}

// Get next market event across all markets
export interface NextEvent {
  market: Market;
  type: 'open' | 'close';
  timeUntil: number;
}

export function getNextMarketEvent(): NextEvent | null {
  let best: NextEvent | null = null;

  for (const market of MARKETS) {
    const event = getMarketNextEvent(market);

    if (event.ms > 0 && (!best || event.ms < best.timeUntil)) {
      best = {
        market,
        type: event.type,
        timeUntil: event.ms,
      };
    }
  }

  return best;
}

// Format countdown for display
export function formatCountdown(ms: number): {
  days?: string;
  hours: string;
  minutes: string;
  seconds: string;
} {
  if (ms <= 0) return { hours: '00', minutes: '00', seconds: '00' };

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return {
      days: days.toString(),
      hours: hours.toString().padStart(2, '0'),
      minutes: minutes.toString().padStart(2, '0'),
      seconds: seconds.toString().padStart(2, '0'),
    };
  }

  return {
    hours: hours.toString().padStart(2, '0'),
    minutes: minutes.toString().padStart(2, '0'),
    seconds: seconds.toString().padStart(2, '0'),
  };
}
