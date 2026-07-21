// === Element References ===
const el = {
  totalCases: document.getElementById("totalCases"),
  diseasesTracked: document.getElementById("diseasesTracked"),
  affectedBarangays: document.getElementById("affectedBarangays"),
  lastUpdate: document.getElementById("lastUpdate"),
  alertBox: document.getElementById("alertBox"),
  legend: document.getElementById("legend"),
  tableBody: document.querySelector("#directory-table tbody"),
  reportType: document.getElementById("reportType"),
  diseaseFilter: document.getElementById("diseaseFilter"),
  dateRange: document.getElementById("dateRange"),
  yearSelector: document.getElementById("yearSelector"),
  scrollBtn: document.getElementById("scrollTopBtn")
};

// === Config ===
const DATA_PATHS = {
  annual: (year) => `./data/${year}/annual.json`,
  monthly: (year, month) => `./data/${year}/${month}.json`
};

// === Disease Key Mapping (fix for inconsistent JSON keys) ===
const DISEASE_MAP = {
  "Hypertension": "Hypertensive Adults",
  "Hypertensive Adults": "Hypertensive Adults",
  "Type II Diabetes": "Type II Diabetes Mellitus",
  "Type II Diabetes Mellitus": "Type II Diabetes Mellitus",
  "Teenage Pregnancy": "Teenage Pregnancy"
};

// === Chart Initialization ===
function createBarChart() {
  const ctx = document.getElementById('casesChart').getContext('2d');
  return new Chart(ctx, {
    type: 'bar',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true } },
      scales: {
        x: { title: { display: true, text: 'Barangays' } },
        y: { title: { display: true, text: 'Cases' }, beginAtZero: true }
      }
    }
  });
}
function createLineChart() {
  const ctx = document.getElementById('trendChart').getContext('2d');
  return new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true } },
      scales: {
        x: { title: { display: true, text: 'Month/Year' } },
        y: { title: { display: true, text: 'Total Cases' }, beginAtZero: true }
      }
    }
  });
}
const casesChart = createBarChart();
const trendChart = createLineChart();

// === Map Initialization ===
const map = L.map('brgyMap').setView([12.35, 121.13], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// === GeoJSON Loader ===
let geoCache = null;
async function getGeoData() {
  if (geoCache) return geoCache;
  try {
    const resp = await fetch("./data/geolocation.geojson");
    if (!resp.ok) throw new Error("GeoJSON file not found");
    geoCache = await resp.json();
    return geoCache;
  } catch (err) {
    console.error("GeoData load error:", err);
    return null;
  }
}

// === Helpers ===
function showAlert(message) {
  el.alertBox.textContent = `⚠️ ${message}`;
  el.alertBox.style.display = "block";
}
function hideAlert() { el.alertBox.style.display = "none"; }
function computeTotal(entry) {
  return entry.total ?? (entry.age10_14 || 0) + (entry.age15_19 || 0) + (entry.male || 0) + (entry.female || 0);
}
function resetChart(chart) {
  chart.data.labels = [];
  chart.data.datasets = [];
  chart.update();
}
function resetStats() {
  el.totalCases.textContent = "0";
  el.diseasesTracked.textContent = "0";
  el.affectedBarangays.textContent = "0";
  el.lastUpdate.textContent = "-";
  resetChart(casesChart);
  resetChart(trendChart);
  map.eachLayer(layer => { if (!(layer instanceof L.TileLayer)) map.removeLayer(layer); });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
  el.tableBody.innerHTML = "";
  document.querySelector("#recentCases .section-title").textContent = "Recent Cases – No data available";
  document.querySelector("#charts .section-title").textContent = "Cases Overview – No data available";
  document.querySelector("#mapSection .section-title").textContent = "Cases Map – No data available";
  document.querySelector("#trend .section-title").textContent = "Yearly Overview – No data available";
  el.legend.style.display = "none";
  el.legend.innerHTML = "";
}

// === Fetch Helper ===
async function fetchStats(year, month, type) {
  const path = type === "monthly" ? DATA_PATHS.monthly(year, month) : DATA_PATHS.annual(year);
  try {
    const resp = await fetch(path);
    if (!resp.ok) throw new Error(`Stats file not found: ${path}`);
    const json = await resp.json();
    if (!json || Object.keys(json).length === 0) throw new Error(`Stats file is empty: ${path}`);
    return json;
  } catch (err) {
    console.warn("Fetch error:", err.message);
    return { "Placeholder Disease": [{ barangay: "No Data", male: 0, female: 0 }] };
  }
}

// === Chart Updaters ===
function updateChart(chart, { labels, datasets, xTitle, yTitle }) {
  chart.data.labels = labels;
  chart.data.datasets = datasets;
  if (xTitle) chart.options.scales.x.title.text = xTitle;
  if (yTitle) chart.options.scales.y.title.text = yTitle;
  chart.update();
}
function updateBarChart(stats, disease, formattedLabel) {
  const labels = stats.map(s => s.barangay);
  let datasets = [];
  if (stats.some(s => s.age10_14 !== undefined || s.age15_19 !== undefined)) {
    datasets = [
      { label: `10–14 y/o – ${formattedLabel}`, data: stats.map(s => s.age10_14 || 0), backgroundColor: "#42a5f5" },
      { label: `15–19 y/o – ${formattedLabel}`, data: stats.map(s => s.age15_19 || 0), backgroundColor: "#66bb6a" }
    ];
  } else if (stats.some(s => s.male !== undefined || s.female !== undefined)) {
    datasets = [
      { label: `Male – ${formattedLabel}`, data: stats.map(s => s.male || 0), backgroundColor: "#1e88e5" },
      { label: `Female – ${formattedLabel}`, data: stats.map(s => s.female || 0), backgroundColor: "#d81b60" }
    ];
  } else {
    datasets = [
      { label: `Total Cases – ${formattedLabel}`, data: stats.map(s => computeTotal(s)), backgroundColor: "#8e24aa" }
    ];
  }
  updateChart(casesChart, { labels, datasets, xTitle: `Barangays – ${formattedLabel}`, yTitle: `Cases – ${formattedLabel}` });
  casesChart.options.scales.x.ticks = { autoSkip: false, maxRotation: 90, minRotation: 45 };
  casesChart.update();
}

// === Line Chart Updater ===
async function updateLineChart(type, year, disease, month = null) {
  if (type === "monthly" && month) {
    const monthNamesShort = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const monthIndex = parseInt(month, 10) - 1;
    const path = `./data/${year}/${month}.json`;

    try {
      const resp = await fetch(path);
      if (!resp.ok) throw new Error(`Stats file not found: ${path}`);
      const data = await resp.json();
      const key = DISEASE_MAP[disease] || disease;
      const monthStats = data?.[key];
      const total = Array.isArray(monthStats)
        ? monthStats.reduce((sum, s) => sum + computeTotal(s), 0)
        : 0;

      updateChart(trendChart, {
        labels: [monthNamesShort[monthIndex]],
        datasets: [
          { label: `${disease} Cases – ${year}`, data: [total], borderColor: "#ff5722", fill: false }
        ],
        yTitle: `Total Cases – ${year}`
      });
    } catch (err) {
      console.error("Monthly chart error:", err);
      updateChart(trendChart, { labels: [], datasets: [] });
    }

  } else {
    const selectedYear = parseInt(year, 10);
    const yearsToCompare = [];
    if (selectedYear > 2020) yearsToCompare.push(selectedYear - 1);
    yearsToCompare.push(selectedYear);
    if (selectedYear < 2030) yearsToCompare.push(selectedYear + 1);

    const yearlyTotals = [];
    for (let y of yearsToCompare) {
      try {
        const resp = await fetch(`./data/${y}/annual.json`);
        if (!resp.ok) { yearlyTotals.push(0); continue; }
        const yearDataAll = await resp.json();
        const key = DISEASE_MAP[disease] || disease;
        const yearStats = yearDataAll[key];
        const total = Array.isArray(yearStats)
          ? yearStats.reduce((sum, s) => sum + computeTotal(s), 0)
          : 0;
        yearlyTotals.push(total);
      } catch {
        yearlyTotals.push(0);
      }
    }

    updateChart(trendChart, {
      labels: yearsToCompare,
      datasets: [
        { label: `${disease} Cases – Annual Comparison`, data: yearlyTotals, borderColor: "#ff5722", fill: false }
      ],
      yTitle: `Total Cases – ${year}`
    });
  }

  trendChart.options.plugins.legend.labels = {
    usePointStyle: true,
    pointStyle: 'line',
    boxWidth: 30,
    boxHeight: 4
  };
  trendChart.update();
}

// === Table Rendering ===
function renderTable(stats, disease, formattedLabel) {
  el.tableBody.innerHTML = "";
  stats.forEach(s => {
    const total = computeTotal(s);
    const row = document.createElement("tr");
    row.innerHTML = `<td>${disease}</td><td>${s.barangay}</td><td>${total}</td>`;
    el.tableBody.appendChild(row);
  });
}

// === Map + Table Rendering ===
async function renderMapAndTable(stats, disease, formattedLabel) {
  try {
    map.eachLayer(layer => { if (!(layer instanceof L.TileLayer)) map.removeLayer(layer); });
    const geoData = await getGeoData();
    if (!geoData) { renderTable(stats, disease, formattedLabel); return; }

    const geoLayer = L.geoJSON(geoData).addTo(map);
    const heatPoints = [];

    stats.forEach(s => {
      const normalize = str => str.replace(/^Brgy\.?\s*/i, "").trim().toLowerCase();
      const feature = geoLayer.getLayers().find(l => normalize(l.feature.properties.name) === normalize(s.barangay));
      if (!feature) return;

      const center = feature.feature.geometry.type === "Point"
        ? L.latLng(feature.feature.geometry.coordinates[1], feature.feature.geometry.coordinates[0])
        : feature.getBounds().getCenter();

      const total = computeTotal(s);
      heatPoints.push([center.lat, center.lng, total]);

      L.circleMarker(center, {
        radius: total >= 30 ? 25 : total >= 20 ? 20 : total >= 10 ? 15 : 8,
        color: "purple",
        fillColor: "violet",
        fillOpacity: 0.7
      }).addTo(map);

      L.marker(center).addTo(map).bindPopup(`
        <b>${s.barangay}</b><br>
        Disease/Issue: ${disease}<br>
        Total: ${total}<br>
        <i>Reported: ${formattedLabel}</i>
      `);
    });

    if (heatPoints.length > 0) {
      L.heatLayer(heatPoints, { radius: 20, blur: 10, maxZoom: 17 }).addTo(map);
    }

    renderTable(stats, disease, formattedLabel);
  } catch (err) {
    console.error("Map/Table render error:", err);
    renderTable(stats, disease, formattedLabel);
  }
}

// === Load Data ===
async function loadData(year, month, disease, type = "monthly") {
  try {
    const statsAll = await fetchStats(year, month, type);
    const key = DISEASE_MAP[disease] || disease;
    const stats = statsAll[key];

    if (!Array.isArray(stats) || stats.length === 0) {
      showAlert(`No data for ${disease} in ${type === "monthly" ? `${year}-${month}` : year}`);
      resetStats();
      return;
    }

    hideAlert();
    const formattedLabel = type === "monthly"
      ? new Date(`${year}-${month}-01`).toLocaleDateString("en-US", { year: "numeric", month: "long" })
      : `${year} Annual`;

    const totalCases = stats.reduce((sum, s) => sum + computeTotal(s), 0);
    el.totalCases.textContent = `${totalCases} (${formattedLabel})`;
    el.diseasesTracked.textContent = Object.keys(statsAll).length;
    el.affectedBarangays.textContent = new Set(stats.map(s => s.barangay)).size;
    el.lastUpdate.textContent = formattedLabel;

    document.querySelector("#recentCases .section-title").textContent = `Recent Cases (${disease} – ${formattedLabel})`;
    document.querySelector("#charts .section-title").textContent = `Cases Overview (${disease} – ${formattedLabel})`;
    document.querySelector("#mapSection .section-title").textContent = `Cases Map (${disease} – ${formattedLabel})`;
    document.querySelector("#trend .section-title").textContent = `Yearly Overview (${disease} – ${year})`;

    updateBarChart(stats, disease, formattedLabel);
    await updateLineChart(type, year, disease, month);
    await renderMapAndTable(stats, disease, formattedLabel);

    el.legend.style.display = "none";
    el.legend.innerHTML = "";
  } catch (err) {
    console.error("Data load error:", err);
    showAlert(err.message || "Error loading data");
    resetStats();
  }
}

// === Unified Data Loader ===
function triggerLoad() {
  const type = el.reportType.value;
  const disease = el.diseaseFilter.value;

  if (!disease) {
    showAlert("Please select a disease to view data");
    return;
  }

  if (type === "monthly") {
    const [year, month] = el.dateRange.value.split("-");
    if (year && month) loadData(year, month, disease, "monthly");
  } else {
    const year = el.yearSelector.value;
    if (year) loadData(year, null, disease, "annual");
  }
}

// === Event Listeners ===
el.reportType.addEventListener("change", e => {
  const type = e.target.value;
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');

  if (type === "monthly") {
    document.getElementById("yearGroup").style.display = "none";
    document.getElementById("monthGroup").style.display = "flex";
    el.dateRange.value = `${yyyy}-${mm}`;
  } else {
    document.getElementById("yearGroup").style.display = "flex";
    document.getElementById("monthGroup").style.display = "none";
  }

  triggerLoad();
});
el.diseaseFilter.addEventListener("change", triggerLoad);
el.dateRange.addEventListener("change", triggerLoad);
el.yearSelector.addEventListener("change", triggerLoad);

// === Startup Initialization ===
function initializeDashboard() {
  resetStats();
  const defaultYear = el.yearSelector.value;
  const defaultDisease = el.diseaseFilter.value;
  if (defaultYear && defaultDisease) {
    loadData(defaultYear, null, defaultDisease, "annual");
  } else {
    showAlert("Please select a disease and date to view data");
  }

  // Scroll-to-top button setup
  window.addEventListener("scroll", () => {
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    el.scrollBtn.style.display = scrollTop > 200 ? "block" : "none";
  });
  el.scrollBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

// === Call Startup ===
initializeDashboard();
