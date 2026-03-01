const express = require("express");
const { fetchDayAheadPrices, aggregateHourly, computeStats } = require("./nordpool");
const { renderAllLayouts, wrapForPreview } = require("./markup");

const app = express();
const PORT = process.env.PORT || 4000;
const AREA = process.env.NORDPOOL_AREA || "FI";
const CURRENCY = process.env.NORDPOOL_CURRENCY || "EUR";

const DEFAULT_TIMEZONE = process.env.NORDPOOL_TIMEZONE || "Europe/Helsinki";

// Cache prices per timezone to avoid hammering the API on every request
const cacheByTimezone = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getPrices(timezone = DEFAULT_TIMEZONE) {
  const now = Date.now();
  const cached = cacheByTimezone.get(timezone);
  if (cached && cached.fetchedAt && now - cached.fetchedAt < CACHE_TTL_MS) {
    return { prices: cached.prices, hourly: cached.hourly, stats: cached.stats };
  }

  const prices = await fetchDayAheadPrices(AREA, CURRENCY, null, timezone);

  const hourly = aggregateHourly(prices);
  const stats = computeStats(prices, timezone);
  cacheByTimezone.set(timezone, { prices, hourly, stats, fetchedAt: now });
  return { prices, hourly, stats };
}

// TRMNL webhook endpoint — returns JSON with markup for all layout sizes
// Query params: ?tz=Europe/Helsinki (IANA timezone name)
app.get("/api/trmnl", async (req, res) => {
  try {
    const timezone = req.query.tz || DEFAULT_TIMEZONE;
    const { hourly, stats } = await getPrices(timezone);
    const layouts = renderAllLayouts(hourly, stats, timezone);
    res.json(layouts);
  } catch (err) {
    console.error("Error fetching prices:", err.message);
    res.status(502).json({ error: "Failed to fetch Nord Pool prices" });
  }
});

// Browser preview endpoints
// Query params: ?tz=Europe/Helsinki (IANA timezone name)
app.get("/preview", async (req, res) => {
  try {
    const timezone = req.query.tz || DEFAULT_TIMEZONE;
    const { hourly, stats } = await getPrices(timezone);
    const layouts = renderAllLayouts(hourly, stats, timezone);
    res.send(wrapForPreview(layouts.markup, "view--full"));
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).send("Error loading preview");
  }
});

app.get("/preview/half-horizontal", async (req, res) => {
  try {
    const timezone = req.query.tz || DEFAULT_TIMEZONE;
    const { hourly, stats } = await getPrices(timezone);
    const layouts = renderAllLayouts(hourly, stats, timezone);
    res.send(wrapForPreview(layouts.markup_half_horizontal, "view--half_horizontal"));
  } catch (err) {
    res.status(500).send("Error loading preview");
  }
});

app.get("/preview/half-vertical", async (req, res) => {
  try {
    const timezone = req.query.tz || DEFAULT_TIMEZONE;
    const { hourly, stats } = await getPrices(timezone);
    const layouts = renderAllLayouts(hourly, stats, timezone);
    res.send(wrapForPreview(layouts.markup_half_vertical, "view--half_vertical"));
  } catch (err) {
    res.status(500).send("Error loading preview");
  }
});

app.get("/preview/quadrant", async (req, res) => {
  try {
    const timezone = req.query.tz || DEFAULT_TIMEZONE;
    const { hourly, stats } = await getPrices(timezone);
    const layouts = renderAllLayouts(hourly, stats, timezone);
    res.send(wrapForPreview(layouts.markup_quadrant, "view--quadrant"));
  } catch (err) {
    res.status(500).send("Error loading preview");
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", area: AREA, currency: CURRENCY, timezone: DEFAULT_TIMEZONE });
});

app.listen(PORT, () => {
  console.log(`TRMNL Nord Pool plugin running on http://localhost:${PORT}`);
  console.log(`  Webhook:  http://localhost:${PORT}/api/trmnl`);
  console.log(`  Preview:  http://localhost:${PORT}/preview`);
  console.log(`  Area: ${AREA}, Currency: ${CURRENCY}, Timezone: ${DEFAULT_TIMEZONE}`);
  console.log(`  Use ?tz=<timezone> to override (e.g., ?tz=Europe/Stockholm)`);
});
