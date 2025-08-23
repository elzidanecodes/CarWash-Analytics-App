/////////////////////////////
// ---- App State -------- //
/////////////////////////////
const DataState = {
  filename: null,
  headers: [],
  rows: [], // array of objects
  sampleRows: [], // max 20 rows for preview
  mapping: {
    id: null,
    features: [],
    label: null,
  },
  preprocessing: {
    missing: "none", // none | drop | mean | median
    scaling: "none", // none | standard | minmax
    encoding: "onehot", // onehot | label
  },
  stats: { rows: 0, cols: 0, missing: 0 },
};

/////////////////////////////
// ---- Small Helpers ---- //
/////////////////////////////
const $ = (sel, root = document) => root.querySelector(sel);
const $all = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function computeStats(rows, headers) {
  const totalCells = rows.length * headers.length;
  let missing = 0;
  rows.forEach((r) => {
    headers.forEach((h) => {
      const v = r[h];
      if (
        v === null ||
        v === undefined ||
        v === "" ||
        (typeof v === "string" && v.trim() === "")
      ) {
        missing += 1;
      }
    });
  });
  DataState.stats = { rows: rows.length, cols: headers.length, missing };
}

function csvToObjects(text) {
  // Normalisasi line endings
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;

  while (i < s.length) {
    const ch = s[i];
    const next = s[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        // escaped quote "" -> "
        cell += '"';
        i += 2;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    } else {
      if (ch === '"') { inQuotes = true; i++; continue; }
      if (ch === ",") { row.push(cell.trim()); cell = ""; i++; continue; }
      if (ch === "\n") { row.push(cell.trim()); rows.push(row); row = []; cell = ""; i++; continue; }
      cell += ch; i++; continue;
    }
  }
  // push last cell/row
  row.push(cell.trim());
  rows.push(row);

  if (!rows.length) return { headers: [], rows: [] };

  const headers = rows.shift().map(h => h.trim());
  const objects = rows
    .filter(r => r.length && r.some(v => v !== "")) // buang baris kosong
    .map(r => {
      const o = {};
      headers.forEach((h, idx) => o[h] = (r[idx] ?? "").trim());
      return o;
    });

  return { headers, rows: objects };
}

async function xlsxFileToObjects(file) {
  // butuh SheetJS (XLSX) di window
  if (typeof XLSX === "undefined") {
    throw new Error("Parser XLSX (SheetJS) belum dimuat di halaman.");
  }
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const first = wb.SheetNames[0];
  const ws = wb.Sheets[first];
  // header: 1 baris pertama jadi nama kolom
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  // normalisasi semua value ke string (konsisten dengan csvToObjects)
  const norm = rows.map(r => {
    const o = {};
    headers.forEach(h => o[h] = String(r[h] ?? "").trim());
    return o;
  });
  return { headers, rows: norm };
}


function renderPreviewTable(sample, headers) {
  const container = $("#preview-table");
  if (!container) return;
  if (!headers.length || !sample.length) {
    container.innerHTML = `<div class="text-sm text-slate-500">Belum ada data untuk preview.</div>`;
    return;
  }
   const thead = `
    <thead class="sticky top-0 bg-white z-10">
      <tr class="text-left text-slate-500 text-xs border-b">
        ${headers.map((h) => `<th class="py-2 pr-4">${h}</th>`).join("")}
      </tr>
    </thead>`;
  const tbody = `
    <tbody class="divide-y">
      ${sample
        .map(
          (row) => `
        <tr class="text-sm">
          ${headers
            .map((h) => `<td class="py-2 pr-4">${row[h] ?? ""}</td>`)
            .join("")}
        </tr>`
        )
        .join("")}
    </tbody>`;
    // bungkus dengan scroll vertikal + horizontal (kalau kolom banyak) 
  container.innerHTML = `
   <div class="overflow-x-auto">
     <div class="max-h-[720px] overflow-y-auto rounded-md">
       <table class="w-full">
         ${thead}${tbody}
       </table>
     </div>
   </div>`;
}

function showStats() {
  const { rows, cols, missing } = DataState.stats;
  $("#stat-rows").textContent = rows;
  $("#stat-cols").textContent = cols;
  $("#stat-missing").textContent = missing;
}

function enableNextIfReady() {
  // 1) File dianggap terpilih kalau filename ada (CSV/XLSX)
  const fileChosen = !!DataState.filename;
  const okUpload   = fileChosen;

  // 2) Enable tombol "Next: Mapping" setelah file dipilih
  const btnMap = $("#btn-to-mapping");
  if (btnMap) btnMap.disabled = !okUpload;

  // 3) Label TIDAK wajib, cukup minimal satu fitur terpilih
  const okMapping = DataState.mapping.features.length > 0;

  // 4) Enable tombol Apply & Simpan
  const btnApply = $("#btn-apply-prep");
  const btnSave  = $("#btn-save-dataset");
  if (btnApply) btnApply.disabled = !okMapping;
  if (btnSave)  btnSave.disabled  = !(okUpload && okMapping);
}


/////////////////////////////
// ---- Upload Step ------ //
/////////////////////////////
function initUpload() {
  const input = $("#dropzone-file");
  if (!input) return;

  input.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // set nama file
    DataState.filename = file.name;

    // RESET mapping agar pilihan dari upload sebelumnya tidak kebawa
    DataState.mapping = { id: null, features: [], label: null };

    // (opsional) bersihkan preview lama
    const preview = $("#preview-table");
    if (preview) {
      preview.innerHTML = `<div class="text-sm text-slate-500">Memuat data...</div>`;
    }

    // deteksi tipe file
    const lower = file.name.toLowerCase();

    if (lower.endsWith(".csv")) {
      // parse CSV di browser
      const text = await file.text();
      const { headers, rows } = csvToObjects(text);

      // simpan ke state
      DataState.headers = headers;
      DataState.rows = rows;
      DataState.sampleRows = rows;

      // statistik + preview
      computeStats(rows, headers);
      showStats();
      renderPreviewTable(rows, headers);

      // bangun ulang UI mapping dari state baru (ID/Label kosong, fitur auto semua)
      buildMappingUI(headers);
      enableNextIfReady();

    } else if (lower.endsWith(".xlsx")) {
      try {
        // parse XLSX via SheetJS
        const { headers, rows } = await xlsxFileToObjects(file);

        // simpan ke state
        DataState.headers = headers;
        DataState.rows = rows;
        DataState.sampleRows = rows;

        // statistik + preview
        computeStats(rows, headers);
        showStats();
        renderPreviewTable(rows, headers);

        // bangun ulang UI mapping (fresh)
        buildMappingUI(headers);
        enableNextIfReady();

      } catch (err) {
        console.error(err);
        // tampilkan fallback info; user masih bisa upload ke backend
        $("#preview-table").innerHTML = `
          <div class="text-sm text-rose-600">
            Gagal membaca Excel di browser: ${err.message}.
            Kamu masih bisa klik <b>Simpan & Upload</b> agar diproses di backend.
          </div>`;
      }

    } else {
      Swal.fire("Format tidak didukung", "Gunakan file .csv atau .xlsx", "warning");
    }
  });
}

/////////////////////////////
// ---- Mapping (UI) ----- //
/////////////////////////////
function buildIdLabelOptions(headers) {
  const idSel = $("#map-id");
  const labelSel = $("#map-label");

  const fill = (sel, withEmpty = true) => {
    sel.innerHTML = withEmpty ? `<option value="">— pilih —</option>` : "";
    headers.forEach((h) =>
      sel.insertAdjacentHTML("beforeend", `<option value="${h}">${h}</option>`)
    );
  };
  fill(idSel);
  fill(labelSel);

  // default kosong (biar user pilih sendiri)
  DataState.mapping.id = null;
  DataState.mapping.label = null;

  idSel.onchange = () => {
    DataState.mapping.id = idSel.value || null;
    syncFeaturesAfterIdLabelChange();
    enableNextIfReady();
  };
  labelSel.onchange = () => {
    DataState.mapping.label = labelSel.value || null;
    syncFeaturesAfterIdLabelChange();
    enableNextIfReady();
  };
}

function renderFeatureChecklist(headers) {
  const featList = $("#feat-list");
  featList.innerHTML = "";

  headers.forEach((h) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <label class="flex items-center gap-2 px-3 py-2 hover:bg-slate-50">
        <input type="checkbox" value="${h}" class="size-4">
        <span>${h}</span>
      </label>`;
    featList.appendChild(li);
  });

  // default: semua kecuali id/label
  const defaultFeat = headers.filter(
    (h) => h !== DataState.mapping.id && h !== DataState.mapping.label
  );
  DataState.mapping.features = defaultFeat.slice();

  featList.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.checked = defaultFeat.includes(cb.value);
    cb.addEventListener("change", () => {
      const v = cb.value;
      if (cb.checked) {
        if (!DataState.mapping.features.includes(v))
          DataState.mapping.features.push(v);
      } else {
        DataState.mapping.features = DataState.mapping.features.filter(
          (x) => x !== v
        );
      }
      drawFeatureChips();
      updateFeatureCount();
      enableNextIfReady();
    });
  });

  drawFeatureChips();
  updateFeatureCount();
}

function drawFeatureChips() {
  const box = $("#feat-chips");
  box.innerHTML = "";
  const arr = DataState.mapping.features;

  if (!arr.length) {
    box.innerHTML = `<span class="text-xs text-slate-400">Belum ada fitur terpilih.</span>`;
    return;
  }
  arr.forEach((f) => {
    const chip = document.createElement("span");
    chip.className =
      "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-sky-50 text-sky-700 border border-sky-200";
    chip.innerHTML = `${f}
      <button type="button" class="ml-1 text-sky-600 hover:text-sky-800" data-remove="${f}" title="hapus">×</button>`;
    box.appendChild(chip);
  });

  // remove via chip
  box.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.getAttribute("data-remove");
      DataState.mapping.features = DataState.mapping.features.filter(
        (x) => x !== v
      );
      const cb = $(`#feat-list input[value="${CSS.escape(v)}"]`);
      if (cb) cb.checked = false;
      drawFeatureChips();
      updateFeatureCount();
      enableNextIfReady();
    });
  });
}

function updateFeatureCount() {
  const el = $("#feat-count");
  if (el) el.textContent = `${DataState.mapping.features.length} dipilih`;
}

function initFeatureDropdown(headers) {
  const btn = $("#feat-btn");
  const menu = $("#feat-menu");
  const search = $("#feat-search");
  if (!btn || !menu || !search) return;

  const toggle = (ev) => {
    ev?.stopPropagation?.();
    menu.classList.toggle("hidden");
    if (!menu.classList.contains("hidden")) search.focus();
  };

  btn.addEventListener("click", toggle);
  document.addEventListener("click", () => menu.classList.add("hidden"));

  // filter list
  search.addEventListener("input", () => {
    const q = search.value.toLowerCase();
    $all("#feat-list li").forEach((li) => {
      const t = li.innerText.toLowerCase();
      li.classList.toggle("hidden", !t.includes(q));
    });
  });
}

function syncFeaturesAfterIdLabelChange() {
  // Pastikan id/label tidak ikut features
  DataState.mapping.features = DataState.mapping.features.filter(
    (f) => f !== DataState.mapping.id && f !== DataState.mapping.label
  );

  // Sinkronkan checkbox
  $all('#feat-list input[type="checkbox"]').forEach((cb) => {
    const v = cb.value;
    if (v === DataState.mapping.id || v === DataState.mapping.label) {
      cb.checked = false;
      cb.disabled = true;
      cb.parentElement.classList.add("opacity-60");
    } else {
      cb.disabled = false;
      cb.parentElement.classList.remove("opacity-60");
      cb.checked = DataState.mapping.features.includes(v);
    }
  });

  drawFeatureChips();
  updateFeatureCount();
}

function buildMappingUI(headers) {
  buildIdLabelOptions(headers);
  renderFeatureChecklist(headers);
  initFeatureDropdown(headers);
}

function initMapping() {
  const btn = $("#btn-to-mapping");
  if (btn) {
    btn.addEventListener("click", () => {
      $("#card-mapping")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }
}

/////////////////////////////
// ---- Preprocessing ---- //
/////////////////////////////
function initPreprocessing() {
  // radios
  $all('input[name="missing"]').forEach((r) =>
    r.addEventListener("change", () => {
      DataState.preprocessing.missing = r.value;
    })
  );
  $all('input[name="scaling"]').forEach((r) =>
    r.addEventListener("change", () => {
      DataState.preprocessing.scaling = r.value;
    })
  );
  $all('input[name="encoding"]').forEach((r) =>
    r.addEventListener("change", () => {
      DataState.preprocessing.encoding = r.value;
    })
  );

  $("#btn-apply-prep")?.addEventListener("click", () => {
    const note = $("#prep-note");
    if (note) {
      note.textContent = `Opsi (preview): missing = ${DataState.preprocessing.missing}, scaling = ${DataState.preprocessing.scaling}, encoding = ${DataState.preprocessing.encoding}`;
      note.classList.remove("hidden");
    }
  });

  $("#btn-save-dataset")?.addEventListener("click", async () => {
    const file = $("#dropzone-file")?.files?.[0];
    if (!file) {
      Swal.fire("Oops!", "Pilih file CSV/XLSX dulu.", "warning");
      return;
    }
    if (!DataState.mapping.features?.length) {
      Swal.fire("Butuh fitur", "Pilih minimal satu kolom fitur.", "info");
      return;
    }

    const fd = new FormData();
    fd.append("file", file);
    fd.append("filename", DataState.filename || file.name || "");
    fd.append("mapping", JSON.stringify(DataState.mapping));
    fd.append("preprocessing", JSON.stringify(DataState.preprocessing));

    Swal.fire({
      title: "Mengunggah...",
      text: "Mohon tunggu, dataset sedang diproses.",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      // Pakai URL absolut agar tidak tergantung proxy Vite
      const res = await fetch("http://127.0.0.1:5000/api/upload", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();

      if (res.ok) {
        Swal.fire("Berhasil!", json?.message || "Dataset siap dimodelkan.", "success");
      } else {
        Swal.fire("Gagal", json?.message || "Terjadi kesalahan di server.", "error");
      }
    } catch (err) {
      console.error(err);
      Swal.fire("Error", err?.message || "Gagal mengirim dataset ke server.", "error");
    }
  });
}

/////////////////////////////
// ---- Page Object ------ //
/////////////////////////////
const DataPage = {
  render() {
    return `
<section class="col-span-12 pr-6">
  <div class="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 w-full">
    <div class="p-6 border-b">
      <h1 class="text-xl font-semibold text-slate-800">Data</h1>
      <p class="text-sm text-slate-500 mt-1">Upload dataset, lakukan mapping kolom, atur preprocessing, dan cek preview.</p>
    </div>

    <div class="p-6 space-y-6">

      <!-- ========== CARD 1: Upload Dataset ========== -->
      <div class="rounded-2xl border bg-white shadow-sm">
        <div class="p-5 border-b flex items-center justify-between">
          <div>
            <h2 class="font-semibold">Upload Dataset</h2>
            <p class="text-sm text-slate-500">Format: CSV & XLSX.</p>
          </div>
          <button id="btn-to-mapping" class="h-9 px-3 rounded-lg border text-sm hover:bg-slate-50" disabled>
            Next: Mapping
          </button>
        </div>
        <div class="p-5 space-y-4">
          <div class="flex items-center justify-center w-full">
            <label for="dropzone-file"
                   class="flex flex-col items-center justify-center w-full h-56 border-2 border-gray-300 border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100">
              <div class="flex flex-col items-center justify-center pt-5 pb-6">
                <svg class="w-8 h-8 mb-3 text-gray-500" viewBox="0 0 20 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                </svg>
                <p class="mb-2 text-sm text-gray-600"><span class="font-semibold">Click to upload</span> atau drag & drop</p>
                <p class="text-xs text-gray-500">CSV / XLSX (MAX. 10MB)</p>
              </div>
              <input id="dropzone-file" type="file" accept=".csv,.xlsx" class="hidden"/>
            </label>
          </div>

          <div class="grid gap-4 grid-cols-3">
            <div class="rounded-xl border p-4">
              <div class="text-xs text-slate-500">Rows</div>
              <div id="stat-rows" class="text-lg font-semibold">0</div>
            </div>
            <div class="rounded-xl border p-4">
              <div class="text-xs text-slate-500">Columns</div>
              <div id="stat-cols" class="text-lg font-semibold">0</div>
            </div>
            <div class="rounded-xl border p-4">
              <div class="text-xs text-slate-500">Missing cells</div>
              <div id="stat-missing" class="text-lg font-semibold">0</div>
            </div>
          </div>

          <div>
            <h3 class="font-medium mb-2">Preview</h3>
            <div id="preview-table" class="rounded-xl border bg-white p-3">
              <div class="text-sm text-slate-500">Belum ada data untuk preview.</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ========== CARD 2: Mapping Kolom (eye-catching) ========== -->
      <div id="card-mapping" class="rounded-2xl border bg-white shadow-sm">
        <div class="p-5 border-b">
          <h2 class="font-semibold">Mapping Kolom</h2>
          <p class="text-sm text-slate-500">Pilih kolom ID (opsional), fitur (multi), dan label/target.</p>
        </div>

        <div class="p-5 space-y-4">
          <!-- Row: ID & Label sejajar -->
          <div class="grid gap-4 md:grid-cols-2">
            <!-- ID -->
            <label class="block">
              <span class="text-sm text-slate-600">Kolom ID (opsional)</span>
              <div class="relative mt-1">
                <span class="pointer-events-none absolute inset-y-0 left-3 grid place-items-center">
                ID
                </span>
                <select id="map-id"
                        class="w-full rounded-lg border pl-9 pr-8 py-2 text-sm focus:ring-2 focus:ring-sky-200 focus:border-sky-400"></select>
                <span class="pointer-events-none absolute inset-y-0 right-2 grid place-items-center">
                  <svg class="size-4 text-slate-400" viewBox="0 0 24 24" fill="currentColor"><path d="M6 9l6 6 6-6"/></svg>
                </span>
              </div>
              <p class="mt-1 text-xs text-slate-500">Boleh dikosongkan.</p>
            </label>

            <!-- Label -->
            <label class="block">
              <span class="text-sm text-slate-600">Label / Target</span>
              <div class="relative mt-1">
                <span class="pointer-events-none absolute inset-y-0 left-3 grid place-items-center">
                  <svg class="size-4 text-slate-400" viewBox="0 0 24 24" fill="currentColor" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                    <path d="M17.63,5.84 C17.27,5.33 16.67,5 16,5 L5,5.01 C3.9,5.01 3,5.9 3,7 L3,17 C3,18.1 3.9,18.99 5,18.99 L16,19 C16.67,19 17.27,18.67 17.63,18.16 L21.59,12.58 C21.84,12.23 21.84,11.77 21.59,11.42 L17.63,5.84 Z"></path>
                  </svg>
                </span>
                <select id="map-label"
                        class="w-full rounded-lg border pl-9 pr-8 py-2 text-sm focus:ring-2 focus:ring-sky-200 focus:border-sky-400"></select>
                <span class="pointer-events-none absolute inset-y-0 right-2 grid place-items-center">
                  <svg class="size-4 text-slate-400" viewBox="0 0 24 24" fill="currentColor"><path d="M6 9l6 6 6-6"/></svg>
                </span>
              </div>
            </label>
          </div>

          <!-- Fitur (chips + dropdown checklist) -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm text-slate-600">Fitur (multi)</span>
              <span id="feat-count" class="text-xs px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">0 dipilih</span>
            </div>

            <div id="feat-chips" class="min-h-10 rounded-lg border bg-white p-2 flex flex-wrap gap-2">
              <span class="text-xs text-slate-400">Belum ada fitur terpilih.</span>
            </div>

            <div class="relative mt-2">
              <button id="feat-btn" class="h-10 w-full rounded-lg border bg-white px-3 text-sm flex items-center justify-between">
                <span class="inline-flex items-center gap-2">
                  <svg class="size-4 text-slate-400" viewBox="0 0 24 24" fill="currentColor"><path d="M4.5 6.75h15v1.5h-15zM4.5 11.25h15v1.5h-15zM4.5 15.75h15v1.5h-15z"/></svg>
                  Pilih fitur
                </span>
                <svg class="size-4 text-slate-500" viewBox="0 0 24 24" fill="currentColor"><path d="M6 9l6 6 6-6"/></svg>
              </button>

              <div id="feat-menu" class="hidden absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-lg border bg-white shadow">
                <div class="p-2 sticky top-0 bg-white border-b">
                  <input id="feat-search" type="text" placeholder="Cari kolom…"
                         class="w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-sky-200 focus:border-sky-400"/>
                </div>
                <ul id="feat-list" class="py-1 text-sm"></ul>
              </div>
            </div>

            <p class="mt-2 text-xs text-slate-500">Tips: pilih fitur yang relevan. Label tidak perlu ikut sebagai fitur.</p>
          </div>
        </div>
      </div>

      <!-- ========== CARD 3: Preprocessing ========== -->
      <div class="rounded-2xl border bg-white shadow-sm">
        <div class="p-5 border-b">
          <h2 class="font-semibold">Preprocessing</h2>
          <p class="text-sm text-slate-500">Atur penanganan missing value, scaling, dan encoding.</p>
        </div>
        <div class="p-5 space-y-4">
          <div class="grid md:grid-cols-3 gap-4">
            <div>
              <div class="text-sm font-medium mb-2">Missing values</div>
              <div class="space-y-2 text-sm">
                <label class="inline-flex items-center gap-2"><input type="radio" name="missing" value="none" checked> None</label><br/>
                <label class="inline-flex items-center gap-2"><input type="radio" name="missing" value="drop"> Drop rows</label><br/>
                <label class="inline-flex items-center gap-2"><input type="radio" name="missing" value="mean"> Impute mean</label><br/>
                <label class="inline-flex items-center gap-2"><input type="radio" name="missing" value="median"> Impute median</label>
              </div>
            </div>
            <div>
              <div class="text-sm font-medium mb-2">Scaling</div>
              <div class="space-y-2 text-sm">
                <label class="inline-flex items-center gap-2"><input type="radio" name="scaling" value="none" checked> None</label><br/>
                <label class="inline-flex items-center gap-2"><input type="radio" name="scaling" value="standard"> StandardScaler</label><br/>
                <label class="inline-flex items-center gap-2"><input type="radio" name="scaling" value="minmax"> MinMaxScaler</label>
              </div>
            </div>
            <div>
              <div class="text-sm font-medium mb-2">Encoding kategorikal</div>
              <div class="space-y-2 text-sm">
                <label class="inline-flex items-center gap-2"><input type="radio" name="encoding" value="onehot" checked> One-hot</label><br/>
                <label class="inline-flex items-center gap-2"><input type="radio" name="encoding" value="label"> Label encoding</label>
              </div>
            </div>
          </div>

          <div class="flex gap-2">
            <button id="btn-apply-prep" class="h-9 px-3 rounded-lg border text-sm hover:bg-slate-50" disabled>
              Terapkan (preview)
            </button>
            <button id="btn-save-dataset" class="h-9 px-4 rounded-lg bg-sky-600 text-white text-sm hover:bg-sky-700" disabled>
              Simpan & Upload
            </button>
          </div>
          <div id="prep-note" class="hidden text-sm text-sky-700">Opsi diterapkan.</div>
        </div>
      </div>

    </div>
  </div>
</section>`;
  },

  init() {
    initUpload();
    initMapping();
    initPreprocessing();
  },
};

export default DataPage;
