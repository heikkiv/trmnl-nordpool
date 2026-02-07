const { fetchDayAheadPrices, aggregateHourly, computeStats } = require("./nordpool");
const { renderAllLayouts } = require("./markup");

const AREA = process.env.NORDPOOL_AREA || "FI";
const CURRENCY = process.env.NORDPOOL_CURRENCY || "EUR";

// Module-level cache survives warm Lambda invocations
let cache = { prices: null, hourly: null, stats: null, fetchedAt: null };
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getPrices() {
  const now = Date.now();
  if (cache.prices && cache.fetchedAt && now - cache.fetchedAt < CACHE_TTL_MS) {
    return { prices: cache.prices, hourly: cache.hourly, stats: cache.stats };
  }

  const prices = await fetchDayAheadPrices(AREA, CURRENCY);
  const hourly = aggregateHourly(prices);
  const stats = computeStats(prices);
  cache = { prices, hourly, stats, fetchedAt: now };
  return { prices, hourly, stats };
}

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method || "GET";
  const path = event.rawPath || "/";

  if (method !== "GET") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  if (path === "/health") {
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "ok", area: AREA, currency: CURRENCY }),
    };
  }

  if (path === "/api/trmnl") {
    try {
      const { hourly, stats } = await getPrices();
      const layouts = renderAllLayouts(hourly, stats);
      return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(layouts),
      };
    } catch (err) {
      console.error("Error fetching prices:", err.message);
      return {
        statusCode: 502,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "Failed to fetch Nord Pool prices" }),
      };
    }
  }

  return {
    statusCode: 404,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ error: "Not found" }),
  };
};
