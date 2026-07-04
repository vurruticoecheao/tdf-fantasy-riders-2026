const state = {
  riders: [],
  filtered: [],
};

const fields = {
  search: document.querySelector("#searchInput"),
  team: document.querySelector("#teamFilter"),
  category: document.querySelector("#categoryFilter"),
  minPrice: document.querySelector("#minPrice"),
  maxPrice: document.querySelector("#maxPrice"),
  sort: document.querySelector("#sortSelect"),
};

const els = {
  body: document.querySelector("#ridersBody"),
  visibleCount: document.querySelector("#visibleCount"),
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

const categoryClass = {
  Leaders: "category-leaders",
  Climbers: "category-climbers",
  Sprinters: "category-sprinters",
  "All-rounders": "category-all-rounders",
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

  state.filtered = state.riders.filter((rider) => {
    const haystack = `${rider.Rider} ${rider.Team} ${rider.Category} ${rider.Tier} ${rider["Jersey Number"]}`.toLowerCase();
    if (query && !haystack.includes(query)) return false;
    if (fields.team.value && rider.Team !== fields.team.value) return false;
    if (fields.category.value && rider.Category !== fields.category.value) return false;
    if (minPrice !== null && rider.Price < minPrice) return false;
    if (maxPrice !== null && rider.Price > maxPrice) return false;
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
  renderCount();
  renderActiveFilters();

  if (!state.filtered.length) {
    els.body.innerHTML = '<tr><td colspan="12" class="empty">No hay riders con esos filtros.</td></tr>';
    return;
  }

  els.body.innerHTML = state.filtered.map((rider) => {
    const tier = tierClass[rider.Tier] || "average";
    const category = categoryClass[rider.Category] || "";
    return `
      <tr>
        <td>${rider["Jersey Number"]}</td>
        <td class="rider-name">${rider.Rider}</td>
        <td class="team-cell">${rider.Team}</td>
        <td><span class="pill ${category}">${rider.Category}</span></td>
        <td>${formatNumber(rider["PCS 2026"])}</td>
        <td>${formatNumber(rider["PCS 12 Months"])}</td>
        <td>${formatNumber(rider["Wins 2026"])}</td>
        <td><span class="value-pill">${formatNumber(rider.Value, 1)}</span></td>
        <td><span class="pill tier-pill ${tier}">${rider.Tier}</span></td>
        <td><span class="price-pill">${formatNumber(rider.Price)}</span></td>
        <td><span class="rank-pill">#${formatNumber(rider["PCS Rank"])}</span></td>
        <td><a class="link-button" href="${rider["PCS Link"]}" target="_blank" rel="noopener noreferrer">PCS</a></td>
      </tr>
    `;
  }).join("");
}

function renderCount() {
  els.visibleCount.textContent = `${state.filtered.length} / ${state.riders.length} riders`;
}

function renderActiveFilters() {
  const active = [];
  if (fields.search.value.trim()) active.push(`search: "${fields.search.value.trim()}"`);
  if (fields.team.value) active.push(fields.team.value);
  if (fields.category.value) active.push(fields.category.value);
  if (fields.minPrice.value || fields.maxPrice.value) active.push(`price ${fields.minPrice.value || "0"}-${fields.maxPrice.value || "max"}`);
  els.activeFilters.textContent = active.length ? active.join(" / ") : "No active filters";
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
  const response = await fetch("assets/riders_tdf_2026_with_jersey_numbers.csv?v=20260704-wide-pcs");
  const csv = await response.text();
  state.riders = parseCsv(csv);

  populateSelect(fields.team, uniqueSorted("Team"));
  populateSelect(fields.category, uniqueSorted("Category"));

  const prices = state.riders.map((rider) => rider.Price);
  fields.minPrice.placeholder = Math.min(...prices);
  fields.maxPrice.placeholder = Math.max(...prices);

  Object.values(fields).forEach((field) => field.addEventListener("input", filterRiders));
  els.reset.addEventListener("click", resetFilters);
  els.download.addEventListener("click", downloadFilteredCsv);
  els.lastUpdated.textContent = `Actualizado: ${new Date().toLocaleDateString("es-CL")}`;

  filterRiders();
}

init().catch((error) => {
  console.error(error);
  els.body.innerHTML = '<tr><td colspan="12" class="empty">No se pudo cargar la base de datos.</td></tr>';
});
