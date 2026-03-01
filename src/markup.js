const { getTimeInZone } = require("./nordpool");

const TRMNL_CSS = "https://trmnl.com/css/latest/plugins.css";
const TRMNL_JS = "https://trmnl.com/js/latest/plugins.js";
const PLUGIN_ICON = "https://trmnl.com/images/plugins/trmnl--render.svg";

function chartScript(chartId, prices, height, timezone = "Europe/Helsinki") {
  const { hour: currentHour } = getTimeInZone(new Date(), timezone);

  const barColors = prices.map((p) =>
    p.hour === currentHour ? "#000000" : {
      pattern: {
        image: "https://trmnl.com/images/grayscale/gray-5.png",
        width: 12,
        height: 12,
      },
    }
  );

  const categories = prices.map((p) => p.hourLabel);
  const values = prices.map((p) => p.price);

  return `
<script>
(function() {
  var createChart = function() {
    Highcharts.chart("${chartId}", {
      chart: { type: "column", height: ${height}, animation: false, backgroundColor: "transparent" },
      title: { text: null },
      xAxis: {
        categories: ${JSON.stringify(categories)},
        labels: { style: { fontSize: "11px", color: "#000" }, step: 2 },
        gridLineWidth: 0,
        lineWidth: 1,
        lineColor: "#000"
      },
      yAxis: {
        title: { text: null },
        labels: { style: { fontSize: "11px", color: "#000" }, format: "{value}" },
        gridLineDashStyle: "shortdot",
        gridLineColor: "#000",
        gridLineWidth: 1
      },
      legend: { enabled: false },
      tooltip: { enabled: false },
      plotOptions: {
        column: {
          animation: false,
          borderWidth: 1,
          borderColor: "#000",
          pointPadding: 0.05,
          groupPadding: 0.05,
          enableMouseTracking: false,
          colorByPoint: true,
          colors: ${JSON.stringify(barColors)}
        }
      },
      series: [{ data: ${JSON.stringify(values)} }],
      credits: { enabled: false }
    });
  };
  if (typeof Highcharts !== "undefined") { createChart(); }
  else { document.addEventListener("DOMContentLoaded", function() { setTimeout(createChart, 500); }); }
})();
</script>`;
}

function statBlock(label, value, unit) {
  return `
      <div class="item">
        <span class="value value--tnums">${value}</span>
        <span class="label">${label} ${unit}</span>
      </div>`;
}

function formatTimestamp(timezone = "Europe/Helsinki") {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("fi-FI", {
    timeZone: timezone,
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const day = parts.find((p) => p.type === "day").value;
  const month = parts.find((p) => p.type === "month").value;
  const hours = parts.find((p) => p.type === "hour").value;
  const minutes = parts.find((p) => p.type === "minute").value;
  return `${hours}:${minutes} ${day}.${month}.`;
}

function renderFull(prices, stats, timezone = "Europe/Helsinki") {
  const chartId = "chart-full";
  return `
<div class="layout layout--col gap--space-between">
  <div class="grid grid--cols-4">
    ${statBlock("Now", stats.current !== null ? stats.current : "—", "c/kWh")}
    ${statBlock("Min", stats.min, "c/kWh")}
    ${statBlock("Max", stats.max, "c/kWh")}
    ${statBlock("Avg", stats.avg, "c/kWh")}
  </div>
  <div id="${chartId}" class="w--full"></div>
</div>
<div class="title_bar">
  <img class="image" src="${PLUGIN_ICON}" />
  <span class="title">Nord Pool — FI</span>
  <span class="instance" style="position: absolute; right: 24px;">${formatTimestamp(timezone)}</span>
</div>
<script src="https://code.highcharts.com/highcharts.js"></script>
${chartScript(chartId, prices, 300, timezone)}`;
}

function renderHalfHorizontal(prices, stats, timezone = "Europe/Helsinki") {
  const chartId = "chart-hh";
  return `
<div class="layout layout--col gap--space-between">
  <div class="grid grid--cols-4">
    ${statBlock("Now", stats.current !== null ? stats.current : "—", "c/kWh")}
    ${statBlock("Min", stats.min, "c/kWh")}
    ${statBlock("Max", stats.max, "c/kWh")}
    ${statBlock("Avg", stats.avg, "c/kWh")}
  </div>
  <div id="${chartId}" class="w--full"></div>
</div>
<div class="title_bar">
  <img class="image" src="${PLUGIN_ICON}" />
  <span class="title">Nord Pool — FI</span>
  <span class="instance" style="position: absolute; right: 24px;">${formatTimestamp(timezone)}</span>
</div>
<script src="https://code.highcharts.com/highcharts.js"></script>
${chartScript(chartId, prices, 140, timezone)}`;
}

function renderHalfVertical(prices, stats, timezone = "Europe/Helsinki") {
  const chartId = "chart-hv";
  return `
<div class="layout layout--col gap--space-between">
  <div class="grid grid--cols-2">
    ${statBlock("Now", stats.current !== null ? stats.current : "—", "c/kWh")}
    ${statBlock("Avg", stats.avg, "c/kWh")}
  </div>
  <div id="${chartId}" class="w--full"></div>
</div>
<div class="title_bar">
  <img class="image" src="${PLUGIN_ICON}" />
  <span class="title">Nord Pool FI</span>
  <span class="instance" style="position: absolute; right: 24px;">${formatTimestamp(timezone)}</span>
</div>
<script src="https://code.highcharts.com/highcharts.js"></script>
${chartScript(chartId, prices, 260, timezone)}`;
}

function renderQuadrant(prices, stats, timezone = "Europe/Helsinki") {
  return `
<div class="layout layout--col layout--center gap--space-between">
  <div class="grid grid--cols-2">
    ${statBlock("Now", stats.current !== null ? stats.current : "—", "c/kWh")}
    ${statBlock("Avg", stats.avg, "c/kWh")}
  </div>
  <div class="grid grid--cols-2">
    ${statBlock("Min", stats.min, "c/kWh")}
    ${statBlock("Max", stats.max, "c/kWh")}
  </div>
</div>
<div class="title_bar">
  <img class="image" src="${PLUGIN_ICON}" />
  <span class="title">NordPool FI</span>
  <span class="instance" style="position: absolute; right: 24px;">${formatTimestamp(timezone)}</span>
</div>`;
}

/**
 * Render all layout variants and return a TRMNL-compatible response object.
 * @param {Array} prices - Hourly price data
 * @param {Object} stats - Statistics object
 * @param {string} timezone - IANA timezone name (e.g., "Europe/Helsinki")
 */
function renderAllLayouts(prices, stats, timezone = "Europe/Helsinki") {
  return {
    markup: renderFull(prices, stats, timezone),
    markup_half_horizontal: renderHalfHorizontal(prices, stats, timezone),
    markup_half_vertical: renderHalfVertical(prices, stats, timezone),
    markup_quadrant: renderQuadrant(prices, stats, timezone),
  };
}

/**
 * Wrap markup in a full HTML page for preview in a browser.
 */
function wrapForPreview(markup, viewClass = "view--full") {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="${TRMNL_CSS}">
  <script src="${TRMNL_JS}"></script>
  <style>
    body { background: #f0f0f0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .screen { width: 800px; height: 480px; background: #fff; overflow: hidden; }
  </style>
</head>
<body class="environment trmnl">
  <div class="screen">
    <div class="view ${viewClass}">
      ${markup}
    </div>
  </div>
</body>
</html>`;
}

module.exports = { renderAllLayouts, wrapForPreview };
