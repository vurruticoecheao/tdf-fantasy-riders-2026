const state = {
  riders: [],
  filtered: [],
};

const fields = {
  search: document.querySelector("#searchInput"),
  team: document.querySelector("#teamFilter"),
  category: document.querySelector("#categoryFilter"),
  tier: document.querySelector("#tierFilter"),
  minPrice: document.querySelector("#minPrice"),
  maxPrice: document.querySelector("#maxPrice"),
  minValue: document.querySelector("#minValue"),
  maxValue: document.querySelector("#maxValue"),
  sort: document.querySelector("#sortSelect"),
};

const els = {
  body: document.querySelector("#ridersBody"),
  visibleCount: document.querySelector("#visibleCount"),
  avgPrice: document.querySelector("#avgPrice"),
  avgValue: document.querySelector("#avgValue"),
  topValue: document.querySelector("#topValue"),
  activeFilters: document.querySelector("#activeFilters"),
  reset: document.querySelector("#resetFilters"),
  download: document.querySelector("#downloadCsv"),
  lastUpdated: document.querySelector("#lastUpdated"),
};

const numericColumns = new Set([
  "Jersey Number",
  "PCS 2026",
  "PCS 12 Months",
  "Wins 2026",
  "Value",
  "Price",
  "PCS Rank",
]);

const tierClass = {
  Excellent: "excellent",
  Great: "great",
  Good: "good",
  Average: "average",
  Poor: "poor",
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const headers = rows.shift().map((header) => header.replace(/^\uFEFF/, ""));
  return rows.map((values) => {
    const record = {};
    headers.forEach((header, index) => {
      const raw = values[index] ?? "";
      record[header] = numericColumns.has(header) ? Number(raw) : raw;
    });
    return record;
  });
}

function uniqueSorted(column) {
  return [...new Set(state.riders.map((rider) => rider[column]).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b)));
}

function populateSelect(select, values) {
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function getNumber(input) {
  return input.value === "" ? null : Number(input.value);
}

function filterRiders() {
  const query = fields.search.value.trim().toLowerCase();
  const minPrice = getNumber(fields.minPrice);
  const maxPrice = getNumber(fields.maxPrice);
  const minValue = getNumber(fields.minValue);
  const maxValue = getNumber(fields.maxValue);

  state.filtered = state.riders.filter((rider) => {
    const haystack = `${rider.Rider} ${rider.Team} ${rider.Category} ${rider.Tier} ${rider["Jersey Number"]}`.toLowerCase();
    if (query && !haystack.includes(query)) return false;
    if (fields.team.value && rider.Team !== fields.team.value) return false;
    if (fields.category.value && rider.Category !== fields.category.value) return false;
    if (fields.tier.value && rider.Tier !== fields.tier.value) return false;
    if (minPrice !== null && rider.Price < minPrice) return false;
    if (maxPrice !== null && rider.Price > maxPrice) return false;
    if (minValue !== null && rider.Value < minValue) return false;
    if (maxValue !== null && rider.Value > maxValue) return false;
    return true;
  });

  sortRiders();
  render();
}

function sortRiders() {
  const [key, direction] = fields.sort.value.split("-");
  const sorters = {
    value: (rider) => rider.Value,
    price: (rider) => rider.Price,
    pcs: (rider) => rider["PCS 2026"],
    rank: (rider) => rider["PCS Rank"],
    jersey: (rider) => rider["Jersey Number"],
    name: (rider) => rider.Rider,
  };
  const getter = sorters[key] || sorters.value;

  state.filtered.sort((a, b) => {
    const first = getter(a);
    const second = getter(b);
    const result = typeof first === "string"
      ? first.localeCompare(second)
      : first - second;
    return direction === "desc" ? -result : result;
  });
}

function formatNumber(value, decimals = 0) {
  return Number(value).toLocaleString("es-CL", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}

function render() {
  renderStats();
  renderActiveFilters();

  if (!state.filtered.length) {
    els.body.innerHTML = '<tr><td colspan="11" class="empty">No hay riders con esos filtros.</td></tr>';
    return;
  }

  els.body.innerHTML = state.filtered.map((rider) => {
    const tier = tierClass[rider.Tier] || "average";
    return `
      <tr>
        <td>${rider["Jersey Number"]}</td>
        <td class="rider-name">${rider.Rider}</td>
        <td class="team-cell">${rider.Team}</td>
        <td><span class="pill">${rider.Category}</span></td>
        <td>${formatNumber(rider["PCS 2026"])}</td>
        <td>${formatNumber(rider["PCS 12 Months"])}</td>
        <td>${formatNumber(rider["Wins 2026"])}</td>
        <td><strong>${formatNumber(rider.Value, 1)}</strong></td>
        <td><span class="pill tier-pill ${tier}">${rider.Tier}</span></td>
        <td>${formatNumber(rider.Price)}</td>
        <td>#${formatNumber(rider["PCS Rank"])}</td>
      </tr>
    `;
  }).join("");
}

function renderStats() {
  const visible = state.filtered.length;
  const avgPrice = visible ? state.filtered.reduce((sum, rider) => sum + rider.Price, 0) / visible : 0;
  const avgValue = visible ? state.filtered.reduce((sum, rider) => sum + rider.Value, 0) / visible : 0;
  const top = state.filtered.reduce((best, rider) => !best || rider.Value > best.Value ? rider : best, null);

  els.visibleCount.textContent = `${visible} / ${state.riders.length}`;
  els.avgPrice.textContent = formatNumber(avgPrice, 1);
  els.avgValue.textContent = formatNumber(avgValue, 1);
  els.topValue.textContent = top ? `${top.Rider} (${formatNumber(top.Value, 1)})` : "-";
}

function renderActiveFilters() {
  const active = [];
  if (fields.search.value.trim()) active.push(`busqueda: "${fields.search.value.trim()}"`);
  if (fields.team.value) active.push(fields.team.value);
  if (fields.category.value) active.push(fields.category.value);
  if (fields.tier.value) active.push(fields.tier.value);
  if (fields.minPrice.value || fields.maxPrice.value) active.push(`precio ${fields.minPrice.value || "0"}-${fields.maxPrice.value || "max"}`);
  if (fields.minValue.value || fields.maxValue.value) active.push(`value ${fields.minValue.value || "0"}-${fields.maxValue.value || "max"}`);
  els.activeFilters.textContent = active.length ? active.join(" / ") : "Sin filtros activos";
}

function resetFilters() {
  Object.values(fields).forEach((field) => {
    if (field.tagName === "SELECT") {
      field.selectedIndex = 0;
    } else {
      field.value = "";
    }
  });
  fields.sort.value = "value-desc";
  filterRiders();
}

function escapeCsv(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadFilteredCsv() {
  const headers = Object.keys(state.riders[0]);
  const lines = [headers.join(",")];
  state.filtered.forEach((rider) => {
    lines.push(headers.map((header) => escapeCsv(rider[header])).join(","));
  });

  const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "riders_tdf_2026_filtrado.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function init() {
  const response = await fetch("assets/riders_tdf_2026_with_jersey_numbers.csv");
  const csv = await response.text();
  state.riders = parseCsv(csv);

  populateSelect(fields.team, uniqueSorted("Team"));
  populateSelect(fields.category, uniqueSorted("Category"));
  populateSelect(fields.tier, ["Excellent", "Great", "Good", "Average", "Poor"]);

  const prices = state.riders.map((rider) => rider.Price);
  const values = state.riders.map((rider) => rider.Value);
  fields.minPrice.placeholder = Math.min(...prices);
  fields.maxPrice.placeholder = Math.max(...prices);
  fields.minValue.placeholder = Math.min(...values).toFixed(1);
  fields.maxValue.placeholder = Math.max(...values).toFixed(1);

  Object.values(fields).forEach((field) => field.addEventListener("input", filterRiders));
  els.reset.addEventListener("click", resetFilters);
  els.download.addEventListener("click", downloadFilteredCsv);
  els.lastUpdated.textContent = `Actualizado: ${new Date().toLocaleDateString("es-CL")}`;

  filterRiders();
}

init().catch((error) => {
  console.error(error);
  els.body.innerHTML = '<tr><td colspan="11" class="empty">No se pudo cargar la base de datos.</td></tr>';
});
