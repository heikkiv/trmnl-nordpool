const express = require("express");
const { fetchDayAheadPrices, aggregateHourly, computeStats } = require("./nordpool");
const { renderAllLayouts, wrapForPreview } = require("./markup");

const app = express();
const PORT = process.env.PORT || 4000;
const AREA = process.env.NORDPOOL_AREA || "FI";
const CURRENCY = process.env.NORDPOOL_CURRENCY || "EUR";

// Cache prices to avoid hammering the API on every request
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

// TRMNL webhook endpoint — returns JSON with markup for all layout sizes
app.get("/api/trmnl", async (req, res) => {
  try {
    const { hourly, stats } = await getPrices();
    const layouts = renderAllLayouts(hourly, stats);
    res.json(layouts);
  } catch (err) {
    console.error("Error fetching prices:", err.message);
    res.status(502).json({ error: "Failed to fetch Nord Pool prices" });
  }
});

// Browser preview endpoints
app.get("/preview", async (req, res) => {
  try {
    const { hourly, stats } = await getPrices();
    const layouts = renderAllLayouts(hourly, stats);
    res.send(wrapForPreview(layouts.markup, "view--full"));
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).send("Error loading preview");
  }
});

app.get("/preview/half-horizontal", async (req, res) => {
  try {
    const { hourly, stats } = await getPrices();
    const layouts = renderAllLayouts(hourly, stats);
    res.send(wrapForPreview(layouts.markup_half_horizontal, "view--half_horizontal"));
  } catch (err) {
    res.status(500).send("Error loading preview");
  }
});

app.get("/preview/half-vertical", async (req, res) => {
  try {
    const { hourly, stats } = await getPrices();
    const layouts = renderAllLayouts(hourly, stats);
    res.send(wrapForPreview(layouts.markup_half_vertical, "view--half_vertical"));
  } catch (err) {
    res.status(500).send("Error loading preview");
  }
});

app.get("/preview/quadrant", async (req, res) => {
  try {
    const { hourly, stats } = await getPrices();
    const layouts = renderAllLayouts(hourly, stats);
    res.send(wrapForPreview(layouts.markup_quadrant, "view--quadrant"));
  } catch (err) {
    res.status(500).send("Error loading preview");
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", area: AREA, currency: CURRENCY });
});

app.listen(PORT, () => {
  console.log(`TRMNL Nord Pool plugin running on http://localhost:${PORT}`);
  console.log(`  Webhook:  http://localhost:${PORT}/api/trmnl`);
  console.log(`  Preview:  http://localhost:${PORT}/preview`);
  console.log(`  Area: ${AREA}, Currency: ${CURRENCY}`);
});
