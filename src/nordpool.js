const API_URL = "https://dataportal-api.nordpoolgroup.com/api/DayAheadPrices";
const VAT_RATE = 1.255; // Finnish ALV 25.5%

/**
 * Fetch day-ahead prices from Nord Pool for the given area and currency.
 * Returns an array of { hour, minute, price } objects where price is in cent/kWh incl. VAT.
 * @param {string} area - The delivery area (e.g., "FI")
 * @param {string} currency - The currency (e.g., "EUR")
 * @param {string|null} date - The date in YYYY-MM-DD format, or null for today
 * @param {string} timezone - IANA timezone name (e.g., "Europe/Helsinki")
 */
async function fetchDayAheadPrices(area = "FI", currency = "EUR", date = null, timezone = "Europe/Helsinki") {
  const targetDate = date || new Date().toISOString().slice(0, 10);

  const params = new URLSearchParams({
    currency,
    market: "DayAhead",
    deliveryArea: area,
    date: targetDate,
  });

  const url = `${API_URL}?${params}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Nord Pool API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return parseResponse(data, area, timezone);
}

function getTimeInZone(date, timezone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === "hour").value, 10);
  const minute = parseInt(parts.find((p) => p.type === "minute").value, 10);
  return { hour, minute };
}

function parseResponse(data, area, timezone = "Europe/Helsinki") {
  const entries = data.multiAreaEntries || [];

  return entries
    .map((entry) => {
      const start = new Date(entry.deliveryStart);
      const areaPrice = entry.entryPerArea?.[area];
      if (areaPrice === undefined || areaPrice === null) return null;

      // API returns EUR/MWh, convert to cent/kWh (÷10) and add VAT
      const price = Math.round((areaPrice / 10) * VAT_RATE * 1000) / 1000;

      const { hour, minute } = getTimeInZone(start, timezone);

      return {
        hour,
        minute,
        label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
        price,
        deliveryStart: entry.deliveryStart,
        deliveryEnd: entry.deliveryEnd,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
}

/**
 * Aggregate 15-min prices into hourly averages for the bar chart.
 */
function aggregateHourly(prices) {
  const buckets = new Map();

  for (const p of prices) {
    if (!buckets.has(p.hour)) buckets.set(p.hour, []);
    buckets.get(p.hour).push(p.price);
  }

  return Array.from(buckets.entries())
    .map(([hour, values]) => ({
      hour,
      hourLabel: String(hour).padStart(2, "0"),
      price: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 1000) / 1000,
    }))
    .sort((a, b) => a.hour - b.hour);
}

function computeStats(prices, timezone = "Europe/Helsinki") {
  if (!prices.length) return { min: 0, max: 0, avg: 0, current: 0 };

  const values = prices.map((p) => p.price);
  const now = new Date();
  const { hour: currentHour, minute: currentMinute } = getTimeInZone(now, timezone);
  const currentSlot = Math.floor(currentMinute / 15) * 15;

  const currentEntry = prices.find(
    (p) => p.hour === currentHour && p.minute === currentSlot
  );

  return {
    min: Math.round(Math.min(...values) * 1000) / 1000,
    max: Math.round(Math.max(...values) * 1000) / 1000,
    avg: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 1000) / 1000,
    current: currentEntry ? currentEntry.price : null,
    currentHour,
  };
}

module.exports = { fetchDayAheadPrices, parseResponse, aggregateHourly, computeStats, getTimeInZone, VAT_RATE };
