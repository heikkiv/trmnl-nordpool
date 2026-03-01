const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { parseResponse, aggregateHourly, computeStats, getTimeInZone, VAT_RATE } = require("./nordpool");

// Use local timezone for tests
const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Helper: build multiAreaEntries with 15-min resolution
// hourlyPrices is { hour: [q0, q1, q2, q3] } in EUR/MWh
function buildApiResponse(hourlyPrices, area = "FI") {
  const entries = [];
  for (const [hour, prices] of Object.entries(hourlyPrices)) {
    const h = Number(hour);
    for (let q = 0; q < prices.length; q++) {
      const start = new Date(2026, 1, 7, h, q * 15, 0);
      const end = new Date(2026, 1, 7, h, (q + 1) * 15, 0);
      entries.push({
        deliveryStart: start.toISOString(),
        deliveryEnd: end.toISOString(),
        entryPerArea: { [area]: prices[q] },
      });
    }
  }
  return { multiAreaEntries: entries };
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

describe("parseResponse", () => {
  it("returns one entry per 15-min slot", () => {
    const apiData = buildApiResponse({
      0: [100, 120, 80, 100],
      1: [200, 200, 200, 200],
    });

    const prices = parseResponse(apiData, "FI", LOCAL_TZ);

    assert.equal(prices.length, 8);
  });

  it("converts EUR/MWh to cent/kWh with VAT", () => {
    const apiData = buildApiResponse({
      5: [100, 100, 100, 100], // 100 EUR/MWh = 10 c/kWh ex-VAT = 12.55 incl VAT
    });

    const prices = parseResponse(apiData, "FI", LOCAL_TZ);

    assert.equal(prices[0].price, round3(10 * VAT_RATE));
  });

  it("includes hour, minute, and label for each slot", () => {
    const apiData = buildApiResponse({
      9: [120, 130, 140, 150],
    });

    const prices = parseResponse(apiData, "FI", LOCAL_TZ);

    assert.equal(prices[0].hour, 9);
    assert.equal(prices[0].minute, 0);
    assert.equal(prices[0].label, "09:00");
    assert.equal(prices[1].minute, 15);
    assert.equal(prices[1].label, "09:15");
    assert.equal(prices[2].minute, 30);
    assert.equal(prices[2].label, "09:30");
    assert.equal(prices[3].minute, 45);
    assert.equal(prices[3].label, "09:45");
  });

  it("sorts by hour and minute", () => {
    const apiData = {
      multiAreaEntries: [
        { deliveryStart: new Date(2026, 1, 7, 23, 0).toISOString(), deliveryEnd: new Date(2026, 1, 7, 23, 15).toISOString(), entryPerArea: { FI: 100 } },
        { deliveryStart: new Date(2026, 1, 7, 0, 0).toISOString(), deliveryEnd: new Date(2026, 1, 7, 0, 15).toISOString(), entryPerArea: { FI: 200 } },
        { deliveryStart: new Date(2026, 1, 7, 0, 30).toISOString(), deliveryEnd: new Date(2026, 1, 7, 0, 45).toISOString(), entryPerArea: { FI: 150 } },
      ],
    };

    const prices = parseResponse(apiData, "FI", LOCAL_TZ);

    assert.equal(prices[0].hour, 0);
    assert.equal(prices[0].minute, 0);
    assert.equal(prices[1].hour, 0);
    assert.equal(prices[1].minute, 30);
    assert.equal(prices[2].hour, 23);
  });

  it("skips entries with missing area data", () => {
    const apiData = {
      multiAreaEntries: [
        { deliveryStart: new Date(2026, 1, 7, 0, 0).toISOString(), deliveryEnd: new Date(2026, 1, 7, 0, 15).toISOString(), entryPerArea: { FI: 100 } },
        { deliveryStart: new Date(2026, 1, 7, 1, 0).toISOString(), deliveryEnd: new Date(2026, 1, 7, 1, 15).toISOString(), entryPerArea: { SE1: 200 } },
      ],
    };

    const prices = parseResponse(apiData, "FI", LOCAL_TZ);

    assert.equal(prices.length, 1);
    assert.equal(prices[0].hour, 0);
  });

  it("skips entries with null price", () => {
    const apiData = {
      multiAreaEntries: [
        { deliveryStart: new Date(2026, 1, 7, 0, 0).toISOString(), deliveryEnd: new Date(2026, 1, 7, 0, 15).toISOString(), entryPerArea: { FI: null } },
        { deliveryStart: new Date(2026, 1, 7, 1, 0).toISOString(), deliveryEnd: new Date(2026, 1, 7, 1, 15).toISOString(), entryPerArea: { FI: 100 } },
      ],
    };

    const prices = parseResponse(apiData, "FI", LOCAL_TZ);

    assert.equal(prices.length, 1);
    assert.equal(prices[0].hour, 1);
  });

  it("returns empty array for empty response", () => {
    const prices = parseResponse({ multiAreaEntries: [] }, "FI", LOCAL_TZ);
    assert.equal(prices.length, 0);
  });

  it("returns empty array for missing multiAreaEntries", () => {
    const prices = parseResponse({}, "FI", LOCAL_TZ);
    assert.equal(prices.length, 0);
  });

  it("rounds to 3 decimal places", () => {
    // 121.86 EUR/MWh -> 12.186 c/kWh -> * 1.255 = 15.29343 -> round to 15.293
    const apiData = {
      multiAreaEntries: [
        { deliveryStart: new Date(2026, 1, 7, 0, 0).toISOString(), deliveryEnd: new Date(2026, 1, 7, 0, 15).toISOString(), entryPerArea: { FI: 121.86 } },
      ],
    };

    const prices = parseResponse(apiData, "FI", LOCAL_TZ);

    assert.equal(prices[0].price, round3(12.186 * VAT_RATE));
  });
});

describe("aggregateHourly", () => {
  it("averages 15-min prices into hourly values", () => {
    const prices = [
      { hour: 0, minute: 0, price: 10 },
      { hour: 0, minute: 15, price: 12 },
      { hour: 0, minute: 30, price: 8 },
      { hour: 0, minute: 45, price: 10 },
      { hour: 1, minute: 0, price: 20 },
      { hour: 1, minute: 15, price: 20 },
      { hour: 1, minute: 30, price: 20 },
      { hour: 1, minute: 45, price: 20 },
    ];

    const hourly = aggregateHourly(prices);

    assert.equal(hourly.length, 2);
    assert.equal(hourly[0].hour, 0);
    assert.equal(hourly[0].price, 10);
    assert.equal(hourly[0].hourLabel, "00");
    assert.equal(hourly[1].hour, 1);
    assert.equal(hourly[1].price, 20);
  });

  it("sorts by hour", () => {
    const prices = [
      { hour: 23, minute: 0, price: 5 },
      { hour: 0, minute: 0, price: 10 },
      { hour: 12, minute: 0, price: 15 },
    ];

    const hourly = aggregateHourly(prices);

    assert.equal(hourly[0].hour, 0);
    assert.equal(hourly[1].hour, 12);
    assert.equal(hourly[2].hour, 23);
  });

  it("handles single entry per hour", () => {
    const prices = [
      { hour: 0, minute: 0, price: 12 },
      { hour: 1, minute: 0, price: 8 },
    ];

    const hourly = aggregateHourly(prices);

    assert.equal(hourly.length, 2);
    assert.equal(hourly[0].price, 12);
    assert.equal(hourly[1].price, 8);
  });

  it("returns empty array for empty input", () => {
    const hourly = aggregateHourly([]);
    assert.equal(hourly.length, 0);
  });

  it("rounds to 3 decimal places", () => {
    const prices = [
      { hour: 0, minute: 0, price: 15.168 },
      { hour: 0, minute: 15, price: 15.932 },
      { hour: 0, minute: 30, price: 16.213 },
      { hour: 0, minute: 45, price: 15.687 },
    ];

    const hourly = aggregateHourly(prices);

    assert.equal(hourly[0].price, 15.75);
  });
});

describe("computeStats", () => {
  it("computes min, max, and avg", () => {
    const prices = [
      { hour: 0, minute: 0, price: 5 },
      { hour: 0, minute: 15, price: 10 },
      { hour: 0, minute: 30, price: 15 },
    ];

    const stats = computeStats(prices, LOCAL_TZ);

    assert.equal(stats.min, 5);
    assert.equal(stats.max, 15);
    assert.equal(stats.avg, 10);
  });

  it("finds current price from the current 15-min slot", () => {
    const now = new Date();
    const { hour: currentHour, minute: currentMinute } = getTimeInZone(now, LOCAL_TZ);
    const currentSlot = Math.floor(currentMinute / 15) * 15;

    const prices = [
      { hour: currentHour, minute: currentSlot, price: 15.168 },
      { hour: currentHour, minute: (currentSlot + 15) % 60, price: 20 },
    ];

    const stats = computeStats(prices, LOCAL_TZ);

    assert.equal(stats.current, 15.168);
    assert.equal(stats.currentHour, currentHour);
  });

  it("sets current to null if current slot is not in data", () => {
    const { hour: currentHour } = getTimeInZone(new Date(), LOCAL_TZ);
    const otherHour = (currentHour + 5) % 24;
    const prices = [{ hour: otherHour, minute: 0, price: 10 }];

    const stats = computeStats(prices, LOCAL_TZ);

    assert.equal(stats.current, null);
  });

  it("returns zeros for empty input", () => {
    const stats = computeStats([]);

    assert.equal(stats.min, 0);
    assert.equal(stats.max, 0);
    assert.equal(stats.avg, 0);
    assert.equal(stats.current, 0);
  });

  it("handles single price entry", () => {
    const prices = [{ hour: 0, minute: 0, price: 7.5 }];

    const stats = computeStats(prices, LOCAL_TZ);

    assert.equal(stats.min, 7.5);
    assert.equal(stats.max, 7.5);
    assert.equal(stats.avg, 7.5);
  });

  it("handles negative prices", () => {
    const prices = [
      { hour: 0, minute: 0, price: -2 },
      { hour: 1, minute: 0, price: 5 },
      { hour: 2, minute: 0, price: 10 },
    ];

    const stats = computeStats(prices, LOCAL_TZ);

    assert.equal(stats.min, -2);
    assert.equal(stats.max, 10);
    assert.equal(stats.avg, 4.333);
  });

  it("rounds min, max, and avg to 3 decimal places", () => {
    const prices = [
      { hour: 0, minute: 0, price: 10.1234 },
      { hour: 0, minute: 15, price: 10.5678 },
    ];

    const stats = computeStats(prices, LOCAL_TZ);

    assert.equal(stats.min, 10.123);
    assert.equal(stats.max, 10.568);
    assert.equal(stats.avg, 10.346);
  });
});
