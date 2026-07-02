// === Charts ===
const ctxBar = document.getElementById('casesChart').getContext('2d');
const casesChart = new Chart(ctxBar, {
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

const ctxTrend = document.getElementById('trendChart').getContext('2d');
const trendChart = new Chart(ctxTrend, {
  type: 'line',
  data: { labels: [], datasets: [] },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true } },
    scales: {
      x: { title: { display: true, text: 'Month' } },
      y: { title: { display: true, text: 'Total Cases' }, beginAtZero: true }
    }
  }
});

// === Map ===
const map = L.map('brgyMap').setView([12.35, 121.13], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// === Helpers ===
function showAlert(message) {
  const alertBox = document.getElementById("alertBox");
  alertBox.textContent = `⚠️ ${message}`;
  alertBox.style.display = "block";
}
function hideAlert() {
  document.getElementById("alertBox").style.display = "none";
}
function resetStats() {
  document.getElementById("totalCases").textContent = "0";
  document.getElementById("diseasesTracked").textContent = "0";
  document.getElementById("affectedBarangays").textContent = "0";
  document.getElementById("lastUpdate").textContent = "-";
  casesChart.data.labels = [];
  casesChart.data.datasets = [];
  casesChart.update();
  trendChart.data.labels = [];
  trendChart.data.datasets = [];
  trendChart.update();
  map.eachLayer(layer => { if (!(layer instanceof L.TileLayer)) map.removeLayer(layer); });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
  document.querySelector("#directory-table tbody").innerHTML = "";
}

// === Utility ===
function computeTotal(entry) {
  if (entry.total !== undefined) return entry.total;
  return (entry.age10_14 || 0) + (entry.age15_19 || 0) +
         (entry.male || 0) + (entry.female || 0);
}

// === Load Data (Monthly or Annual) ===
async function loadData(year, month, disease, type = "monthly") {
  try {
    const statsPath = type === "monthly"
      ? `./data/${year}/${month}.json`
      : `./data/${year}/annual.json`;

    const monthNames = ["January","February","March","April","May","June",
                        "July","August","September","October","November","December"];
    const monthLabel = type === "monthly"
      ? `${monthNames[parseInt(month, 10) - 1]} ${year}`
      : `${year} Annual Report`;

    const response = await fetch(statsPath);
    if (!response.ok) throw new Error(`Stats file not found: ${monthLabel}`);

    const statsAll = await response.json();
    if (!statsAll || (Array.isArray(statsAll) && statsAll.length === 0) || Object.keys(statsAll).length === 0) {
      throw new Error(`Stats file is empty: ${monthLabel}`);
    }

    const stats = statsAll[disease];
    if (!Array.isArray(stats) || stats.length === 0) {
      showAlert(`No data for ${disease} in ${monthLabel}`);
      resetStats();
      return;
    }

    hideAlert();

    const formattedLabel = type === "monthly"
      ? new Date(`${year}-${month}-01`).toLocaleDateString("en-US", { year: "numeric", month: "long" })
      : `${year} Annual`;

    // Quick Stats
    const totalCases = stats.reduce((sum, s) => sum + computeTotal(s), 0);
    document.getElementById("totalCases").textContent = `${totalCases} (${formattedLabel})`;
    document.getElementById("diseasesTracked").textContent = Object.keys(statsAll).length;
    const affectedBarangays = new Set(stats.map(s => s.barangay));
    document.getElementById("affectedBarangays").textContent = affectedBarangays.size;
    document.getElementById("lastUpdate").textContent = formattedLabel;

    // Section Titles
    document.querySelector("#recentCases .section-title").textContent =
      `Recent Cases (${disease} – ${formattedLabel})`;
    document.querySelector("#charts .section-title").textContent =
      `Cases Overview (${disease} – ${formattedLabel})`;
    document.querySelector("#mapSection .section-title").textContent =
      `Cases Map (${disease} – ${formattedLabel})`;
    document.querySelector("#trend .section-title").textContent =
      `Yearly Overview (${disease} – ${year})`;

// === Bar Chart ===
casesChart.data.labels = stats.map(s => s.barangay);

let datasets = [];
if (stats.some(s => s.age10_14 !== undefined || s.age15_19 !== undefined)) {
  datasets.push({
    label: `10–14 y/o – ${formattedLabel}`,
    data: stats.map(s => s.age10_14 || 0),
    backgroundColor: "#42a5f5"
  });
  datasets.push({
    label: `15–19 y/o – ${formattedLabel}`,
    data: stats.map(s => s.age15_19 || 0),
    backgroundColor: "#66bb6a"
  });
} else if (stats.some(s => s.male !== undefined || s.female !== undefined)) {
  datasets.push({
    label: `Male – ${formattedLabel}`,
    data: stats.map(s => s.male || 0),
    backgroundColor: "#1e88e5"
  });
  datasets.push({
    label: `Female – ${formattedLabel}`,
    data: stats.map(s => s.female || 0),
    backgroundColor: "#d81b60"
  });
} else {
  datasets.push({
    label: `Total Cases – ${formattedLabel}`,
    data: stats.map(s => computeTotal(s)),
    backgroundColor: "#8e24aa"
  });
}

casesChart.data.datasets = datasets;
casesChart.options.scales.x.title.text = `Barangays – ${formattedLabel}`;
casesChart.options.scales.y.title.text = `Cases – ${formattedLabel}`;

// 👉 Responsive ticks config (Mayor’s Dashboard style)
casesChart.options.scales.x.ticks = {
  autoSkip: false,
  maxRotation: 25,
  minRotation: 0,
  font: ctx => {
    const w = window.innerWidth;
    if (w < 480) return { size: 9 };   // phones
    if (w < 1024) return { size: 11 }; // tablets
    return { size: 14 };               // desktops
  },
  callback: function(value) {
    const label = this.getLabelForValue(value);
    return label.length > 12 ? label.slice(0, 12) + "…" : label;
  }
};

casesChart.options.scales.y.ticks = {
  font: ctx => {
    const w = window.innerWidth;
    if (w < 480) return { size: 9 };
    if (w < 1024) return { size: 11 };
    return { size: 14 };
  }
};

// 👉 Styling para mas malinis
casesChart.options.scales.y.grid = { color: "rgba(0,0,0,0.05)" };
casesChart.options.scales.x.grid = { display: false };
casesChart.options.layout = { padding: { left: 10, right: 10, top: 20, bottom: 20 } };
casesChart.options.maintainAspectRatio = false;

casesChart.update();

    // --- Line Chart (Yearly Overview) ---
    if (type === "monthly") {
      const monthNamesShort = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const monthlyTotals = [];
      for (let i=1; i<=12; i++) {
        const monthKey = String(i).padStart(2,"0");
        try {
          const resp = await fetch(`./data/${year}/${monthKey}.json`);
          if (!resp.ok) { monthlyTotals.push(0); continue; }
          const monthDataAll = await resp.json();
          const monthStats = monthDataAll[disease];
          const total = Array.isArray(monthStats) ? monthStats.reduce((sum, s) => sum + computeTotal(s), 0) : 0;
          monthlyTotals.push(total);
        } catch {
          monthlyTotals.push(0);
        }
      }
      trendChart.data.labels = monthNamesShort;
      trendChart.data.datasets = [
        { label: `${disease} Cases – ${year}`, data: monthlyTotals, borderColor:"#ff5722", fill:false }
      ];
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
          const yearStats = yearDataAll[disease];
          const total = Array.isArray(yearStats) ? yearStats.reduce((sum, s) => sum + computeTotal(s), 0) : 0;
          yearlyTotals.push(total);
        } catch {
          yearlyTotals.push(0);
        }
      }

      trendChart.data.labels = yearsToCompare;
      trendChart.data.datasets = [
        { label: `${disease} Cases – Annual Comparison`, data: yearlyTotals, borderColor:"#ff5722", fill:false }
      ];
    }

    trendChart.options.scales.y.title.text = `Total Cases – ${year}`;
    trendChart.update();

    // --- Map reset ---
    map.eachLayer(layer => { if (!(layer instanceof L.TileLayer)) map.removeLayer(layer); });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    // --- Map + Table ---
    await renderMapAndTable(stats, disease, formattedLabel);

    // --- Legend removed ---
    const legendDiv = document.getElementById("legend");
    legendDiv.style.display = "none";
    legendDiv.innerHTML = "";

  } catch (err) {
    console.error("Data load error:", err);
    showAlert(err.message || "Error loading data");
    resetStats();
  }
}

// === Map + Table Rendering ===
async function renderMapAndTable(stats, disease, formattedLabel) {
  try {
    const geoResponse = await fetch("./data/geolocation.geojson");
    if (!geoResponse.ok) {
      console.warn("Barangay map file not found, showing table only");
      renderTable(stats, disease, formattedLabel);
      return;
    }

    const geoData = await geoResponse.json();
    const geoLayer = L.geoJSON(geoData).addTo(map);

    const heatPoints = [];

    stats.forEach(s => {
      const normalize = str => str.replace(/^Brgy\.?\s*/i, "").trim().toLowerCase();
      const feature = geoLayer.getLayers().find(
        l => normalize(l.feature.properties.name) === normalize(s.barangay)
      );
      if (!feature) {
        console.warn("No match for barangay:", s.barangay);
        return;
      }

      let center;
      if (feature.feature.geometry.type === "Point") {
        const [lng, lat] = feature.feature.geometry.coordinates;
        center = L.latLng(lat, lng);
      } else {
        center = feature.getBounds().getCenter();
      }

      const total = computeTotal(s);

      let popupContent = `<b>${s.barangay}</b><br>Disease/Issue: ${disease}<br>`;
      if (disease.toLowerCase() === "teenage pregnancy") {
        popupContent += `10–14 y/o: ${s.age10_14 || 0}<br>`;
        popupContent += `15–19 y/o: ${s.age15_19 || 0}<br>`;
      } else {
        popupContent += `Male: ${s.male || 0}<br>`;
        popupContent += `Female: ${s.female || 0}<br>`;
      }
      popupContent += `Total: ${total}<br><i>Reported: ${formattedLabel}</i>`;

      heatPoints.push([center.lat, center.lng, total]);

      L.circleMarker(center, {
        radius: total >= 30 ? 25 : total >= 20 ? 20 : total >= 10 ? 15 : 8,
        color: "purple",
        fillColor: "violet",
        fillOpacity: 0.7,
        interactive: false
      }).addTo(map);

      L.marker(center).addTo(map).bindPopup(popupContent);
    });

    if (heatPoints.length > 0) {
      const heatLayer = L.heatLayer(heatPoints, { radius: 20, blur: 10, maxZoom: 17 });
      heatLayer.addTo(map);
      heatLayer.bringToBack();
    }

    renderTable(stats, disease, formattedLabel);

  } catch (err) {
    console.error("Map/Table render error:", err);
    renderTable(stats, disease, formattedLabel);
  }
}

// === Table Rendering ===
function renderTable(stats, disease, formattedLabel) {
  const tbody = document.querySelector("#directory-table tbody");
  tbody.innerHTML = "";
  stats.forEach(s => {
    const total = computeTotal(s);
    const row = document.createElement("tr");
    row.innerHTML = `<td>${disease}</td><td>${s.barangay}</td><td>${total}</td>`;
    tbody.appendChild(row);
  });
}

// === Startup ===
resetStats();
const defaultYear = document.getElementById("yearSelector").value;
const defaultDisease = document.getElementById("diseaseFilter").value;
if (defaultYear && defaultDisease) {
  loadData(defaultYear, null, defaultDisease, "annual");
} else {
  showAlert("Please select a disease and date to view data");
}

// === Event Listeners ===
document.getElementById("reportType").addEventListener("change", e => {
  const type = e.target.value;
  if (type === "annual") {
    document.getElementById("yearSelector").style.display = "inline-block";
    document.getElementById("dateRange").style.display = "none";
  } else {
    document.getElementById("yearSelector").style.display = "none";
    document.getElementById("dateRange").style.display = "inline-block";
  }
});

document.getElementById("diseaseFilter").addEventListener("change", e => {
  const disease = e.target.value;
  const type = document.getElementById("reportType").value;
  if (type === "monthly") {
    const [year, month] = document.getElementById("dateRange").value.split("-");
    if (year && month && disease) loadData(year, month, disease, "monthly");
  } else {
    const year = document.getElementById("yearSelector").value;
    if (year && disease) loadData(year, null, disease, "annual");
  }
});

document.getElementById("dateRange").addEventListener("change", e => {
  const [year, month] = e.target.value.split("-");
  const disease = document.getElementById("diseaseFilter").value;
  if (year && month && disease) loadData(year, month, disease, "monthly");
});

document.getElementById("yearSelector").addEventListener("change", e => {
  const year = e.target.value;
  const disease = document.getElementById("diseaseFilter").value;
  if (year && disease) loadData(year, null, disease, "annual");
});
