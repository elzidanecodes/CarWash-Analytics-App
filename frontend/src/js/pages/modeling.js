// ---------- helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const $all = (s, r = document) => Array.from(r.querySelectorAll(s));
const fmt = (v, d = 3) =>
  v == null || Number.isNaN(v) ? "—" : Number(v).toFixed(d);

function setLoading(btn, loading = true) {
  if (!btn) return;
  btn.disabled = loading;
  const s = btn.querySelector("[data-spin]");
  if (s) s.classList.toggle("hidden", !loading);
}

function showImageBase64(imgEl, b64) {
  if (!imgEl || !b64) return;
  imgEl.src = `data:image/png;base64,${b64}`;
  imgEl.classList.remove("hidden");
}

function notify(el, text, ok = true) {
  if (!el) return;
  el.textContent = text || "";
  el.classList.toggle("text-red-600", !ok);
  el.classList.toggle("text-slate-700", ok);
}

// --- state ---
const ModelingState = {
  params: {
    k: null,
    init: "k-means++",
    max_iter: 300,
    n_init: 10,
    random_state: 42,
  },
  metrics: { wcss: null, dbi: null, silhouette: null },
  elbowDone: false,
  trained: false,
};

// k input (kalau ada di UI)
function lockKInput(k) {
  const inp = $("#k");
  if (!inp) return;
  inp.value = k;
  inp.readOnly = true;
  inp.classList.add("bg-slate-100", "cursor-not-allowed");
}

function unlockKInput() {
  const inp = $("#k");
  if (!inp) return;
  inp.readOnly = false;
  inp.classList.remove("bg-slate-100", "cursor-not-allowed");
}

function setKValue(k) {
  ModelingState.params.k = Number(k);
  const inp = document.querySelector("#k");
  if (inp) inp.value = k ?? "";
}

// --- metrics render ---
function setMetrics({ wcss = null, dbi = null, silhouette = null }) {
  if (wcss !== null) ModelingState.metrics.wcss = wcss;
  if (dbi !== null) ModelingState.metrics.dbi = dbi;
  if (silhouette !== null) ModelingState.metrics.silhouette = silhouette;
  $("#metric-wcss") &&
    ($("#metric-wcss").textContent = fmt(ModelingState.metrics.wcss));
  $("#metric-dbi") &&
    ($("#metric-dbi").textContent = fmt(ModelingState.metrics.dbi));
  $("#metric-sil") &&
    ($("#metric-sil").textContent = fmt(ModelingState.metrics.silhouette));
}

function renderClusterTable() {
  const box = $("#cluster-table"),
    arr = ModelingState.clusterCounts;
  if (!arr?.length) {
    box.innerHTML = `<div class="text-sm text-slate-500">Belum ada hasil clustering.</div>`;
    return;
  }
  box.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead><tr class="text-left text-slate-500"><th class="py-2 pr-4">Cluster</th><th class="py-2 pr-4">Count</th></tr></thead>
        <tbody class="divide-y">
          ${arr
            .map(
              (r) =>
                `<tr><td class="py-2 pr-4 font-medium">${r.cluster}</td><td class="py-2 pr-4">${r.count}</td></tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
}

function renderCentroidTable() {
  const box = $("#centroid-table"),
    arr = ModelingState.centroids;
  if (!arr?.length) {
    box.innerHTML = `<div class="text-sm text-slate-500">Belum ada centroid.</div>`;
    return;
  }
  const k = Object.keys(arr[0]).filter((k) => /^c\d+$/.test(k)).length;
  box.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead><tr class="text-left text-slate-500"><th class="py-2 pr-4">Feature</th>${Array.from(
          { length: k }
        )
          .map((_, i) => `<th class="py-2 pr-4">C${i}</th>`)
          .join("")}</tr></thead>
        <tbody class="divide-y">
          ${arr
            .map(
              (r) =>
                `<tr><td class="py-2 pr-4 font-medium">${
                  r.feature
                }</td>${Array.from({ length: k })
                  .map(
                    (_, i) => `<td class="py-2 pr-4">${fmt(r[`c${i}`])}</td>`
                  )
                  .join("")}</tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
}

function setDisabledFlow() {
  const hasK = Number.isFinite(ModelingState.params.k);
  // Run aktif kalau sudah Elbow ATAU user isi K manual
  $("#btn-run").disabled = !(ModelingState.elbowDone || hasK);

  // DBI butuh model hasil train
  $("#btn-dbi").disabled = !ModelingState.trained;

  // Silhouette chart TIDAK butuh train → always ON (atau aktifkan setelah Elbow kalau mau)
  $("#btn-sil").disabled = false;

  $("#flow-tip")?.classList.toggle("hidden", ModelingState.elbowDone || hasK);
}

// ---------- API ----------
async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `${res.status} ${res.statusText}${text ? ` – ${text}` : ""}`
    );
  }
  return res.json();
}

// --- actions ---
async function runElbow() {
  const btn = $("#btn-elbow"),
    img = $("#img-elbow"),
    note = $("#note-elbow");
  setLoading(btn, true);
  notify(note, "Menghitung Elbow (WCSS)…", true);
  try {
    const data = await postJSON("/api/model/elbow", { k_min: 2, k_max: 10 });
    // tampilkan grafik
    showImageBase64(img, data.image_base64);
    $("#ph-elbow")?.classList.add("hidden");

    if (data.wcss_at_k != null) setMetrics({ wcss: data.wcss_at_k });

    // ambil k_suggest dan kunci input
    if (typeof data.k_suggest === "number" && !Number.isNaN(data.k_suggest)) {
      setKValue(data.k_suggest);
      ModelingState.params.k = data.k_suggest;
      // lockKInput(data.k_suggest);
      ModelingState.elbowDone = true;
      notify(note, `K optimal = ${data.k_suggest} (dari Elbow)`);
      setDisabledFlow();
    } else {
      notify(note, "Tidak berhasil menentukan K optimal dari Elbow", false);
    }
  } catch (err) {
    console.error(err);
    notify(note, `Error: ${err.message}`, false);
  } finally {
    setLoading(btn, false);
  }
}

async function runClustering() {
  const btn = $("#btn-run"),
    note = $("#run-log");
  setLoading(btn, true);
  notify(note, "Menjalankan KMeans…", true);
  try {
    const data = await postJSON("/api/model/train", {
      params: ModelingState.params,
    });

    setMetrics({
      wcss: data.inertia,
      silhouette: data.silhouette ?? null,
    });

    // tampilkan counts & centroid
    renderClusterCounts(data.counts || []);
    renderCentroids(data.centroids || []);
    ModelingState.trained = true;
    notify(note, ``);
    setDisabledFlow();
  } catch (err) {
    console.error(err);
    notify(note, `Error: ${err.message}`, false);
  } finally {
    setLoading(btn, false);
  }
}

// --- render counts & centroids (sesuaikan selector/HTML kamu) ---
function renderClusterCounts(rows) {
  const box = $("#cluster-table");
  if (!box) return;
  if (!rows?.length) {
    box.innerHTML = `<div class="text-sm text-slate-500">Belum ada hasil clustering.</div>`;
    return;
  }
  box.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead><tr class="text-left text-slate-500"><th class="py-2 pr-4">Cluster</th><th class="py-2 pr-4">Count</th></tr></thead>
        <tbody class="divide-y">
          ${rows
            .map(
              (r) =>
                `<tr><td class="py-2 pr-4 font-medium">${r.cluster}</td><td class="py-2 pr-4">${r.count}</td></tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
}

function renderCentroids(rows) {
  const box = $("#centroid-table");
  if (!box) return;
  if (!rows?.length) {
    box.innerHTML = `<div class="text-sm text-slate-500">Belum ada centroid.</div>`;
    return;
  }
  const headers = Object.keys(rows[0]).filter((k) => k !== "feature");
  box.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead><tr class="text-left text-slate-500"><th class="py-2 pr-4">Feature</th>${headers
          .map((h) => `<th class="py-2 pr-4">${h.toUpperCase()}</th>`)
          .join("")}</tr></thead>
        <tbody class="divide-y">
          ${rows
            .map(
              (r) =>
                `<tr><td class="py-2 pr-4 font-medium">${
                  r.feature
                }</td>${headers
                  .map((h) => `<td class="py-2 pr-4">${fmt(r[h])}</td>`)
                  .join("")}</tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
}

async function runDBI() {
  const btn = $("#btn-dbi"),
    note = $("#note-dbi");
  setLoading(btn, true);
  notify(note, "Menghitung DBI…", true);
  try {
    const data = await postJSON("/api/model/dbi", {});

    setMetrics({ dbi: data.dbi });
    notify(note, ``);
  } catch (err) {
    console.error(err);
    notify(note, `Error: ${err.message}`, false);
  } finally {
    setLoading(btn, false);
  }
}

async function runSilhouette() {
  const btn = $("#btn-sil"),
    img = $("#img-sil"),
    note = $("#note-sil");
  setLoading(btn, true);
  notify(note, "Menghitung Silhouette…", true);
  try {
    const data = await postJSON("/api/model/silhouette-curve", {
      k_min: 2,
      k_max: 10,
    });
    setMetrics({ silhouette: data.silhouette });
    showImageBase64(img, data.image_base64);
    $("#ph-sil")?.classList.add("hidden");
    notify(note, ``);
  } catch (e) {
    notify(note, "Gagal menghitung Silhouette", false);
    console.error(e);
  } finally {
    setLoading(btn, false);
  }
}

// ---------- inputs ----------
function initInputs() {
  $("#k").value = ModelingState.params.k ?? "";
  $("#max_iter").value = ModelingState.params.max_iter;
  $("#n_init").value = ModelingState.params.n_init;
  $("#random_state").value = ModelingState.params.random_state;
  $("#init").value = ModelingState.params.init;

  // K dikunci; akan dibuka otomatis kalau kamu mau override (hapus readonly di sini)
  // $("#k").setAttribute("readonly","readonly");
  // $("#k").classList.add("bg-slate-100","cursor-not-allowed");
  unlockKInput();

  $all("[data-bind]").forEach((el) => {
    el.addEventListener("input", () => {
      const key = el.getAttribute("data-bind");
      let val = el.value;
      if (["k", "max_iter", "n_init", "random_state"].includes(key)) {
        val = val === "" ? null : Number(val);
      }
      ModelingState.params[key] = val;
      setDisabledFlow();
    });
  });
}

// ---------- Page ----------
const ModelingPage = {
  render() {
    return `
<section class="col-span-12 pr-6">
  <div class="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200">
    <div class="p-6 border-b">
      <h1 class="text-xl font-semibold text-slate-800">Modeling</h1>
      <p class="text-sm text-slate-500 mt-1">Urutan: <b>Elbow</b> → <b>K‑Means</b> → <b>Evaluasi</b>.</p>
      <p id="flow-tip" class="text-xs text-amber-600 mt-1">Hitung Elbow terlebih dahulu untuk mengaktifkan tombol Run Clustering.</p>
    </div>

    <div class="p-6 space-y-6">
      <!-- PARAMS -->
      <div class="rounded-2xl border bg-white shadow-sm">
        <div class="p-5 border-b"><h2 class="font-semibold">Parameter K‑Means</h2></div>
        <div class="p-5 grid gap-4 md:grid-cols-5">
          <label class="block">
            <span class="text-sm text-slate-600">K (ditentukan oleh Elbow)</span>
            <input id="k" data-bind="k" type="number" min="2" max="30" value="3" class="mt-1 w-full rounded-lg border px-3 py-2"/>
          </label>
          <label class="block">
            <span class="text-sm text-slate-600">Init</span>
            <select id="init" data-bind="init" class="mt-1 w-full rounded-lg border px-3 py-2">
              <option value="k-means++">k-means++</option>
              <option value="random">random</option>
            </select>
          </label>
          <label class="block">
            <span class="text-sm text-slate-600">Max Iter</span>
            <input id="max_iter" data-bind="max_iter" type="number" min="10" max="5000" value="300" class="mt-1 w-full rounded-lg border px-3 py-2"/>
          </label>
          <label class="block">
            <span class="text-sm text-slate-600">n_init</span>
            <input id="n_init" data-bind="n_init" type="number" min="1" max="100" value="10" class="mt-1 w-full rounded-lg border px-3 py-2"/>
          </label>
          <label class="block">
            <span class="text-sm text-slate-600">Random State</span>
            <input id="random_state" data-bind="random_state" type="number" value="42" class="mt-1 w-full rounded-lg border px-3 py-2"/>
          </label>
        </div>
        <div class="px-5 pb-5 flex flex-wrap gap-2">
          <button id="btn-run" class="h-9 px-4 rounded-lg bg-sky-600 text-white text-sm hover:bg-sky-700 inline-flex items-center gap-2" disabled>
            <svg data-spin class="animate-spin hidden size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1010 10h-2A8 8 0 112 12H0A10 10 0 0012 2z"/></svg>
            Run Clustering
          </button>
          <div id="run-log" class="text-sm text-slate-500"></div>
        </div>
      </div>

      <!-- METRICS -->
      <div class="grid gap-6 md:grid-cols-3">
        <div class="rounded-2xl border bg-white p-5 shadow-sm"><div class="text-xs text-slate-500">WCSS</div><div id="metric-wcss" class="text-2xl font-semibold">—</div></div>
        <div class="rounded-2xl border bg-white p-5 shadow-sm">
          <div class="text-xs text-slate-500">Davies–Bouldin Index</div>
          <div id="metric-dbi" class="text-2xl font-semibold">—</div>
          <div class="mt-2"><button id="btn-dbi" class="h-8 px-3 rounded-lg border text-xs hover:bg-slate-50" disabled>Hitung DBI</button><div id="note-dbi" class="text-xs text-slate-500 mt-1"></div></div>
        </div>
        <div class="rounded-2xl border bg-white p-5 shadow-sm">
          <div class="text-xs text-slate-500">Silhouette Score</div>
          <div id="metric-sil" class="text-2xl font-semibold">—</div>
          <div class="mt-2"><button id="btn-sil" class="h-8 px-3 rounded-lg border text-xs hover:bg-slate-50" disabled>Hitung Silhouette</button><div id="note-sil" class="text-xs text-slate-500 mt-1"></div></div>
        </div>
      </div>

      <!-- CHARTS -->
      <div class="grid gap-6 md:grid-cols-2">
        <div class="rounded-2xl border bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between mb-3">
            <h2 class="font-semibold">Elbow Method</h2>
            <button id="btn-elbow" class="h-9 px-3 rounded-lg border text-sm hover:bg-slate-50 inline-flex items-center gap-2">
              <svg data-spin class="animate-spin hidden size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1010 10h-2A8 8 0 112 12H0A10 10 0 0012 2z"/></svg>
              Hitung
            </button>
          </div>
          <img id="img-elbow" class="rounded-md w-full hidden" alt="Elbow Chart"/>
          <div id="ph-elbow" class="aspect-[4/3] rounded-md bg-slate-100 grid place-content-center text-slate-400 text-sm">Chart here</div>
        </div>

        <div class="rounded-2xl border bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between mb-3"><h2 class="font-semibold">Silhouette</h2></div>
          <img id="img-sil" class="rounded-md w-full hidden" alt="Silhouette Chart"/>
          <div id="ph-sil" class="aspect-[4/3] rounded-md bg-slate-100 grid place-content-center text-slate-400 text-sm">Chart here</div>
        </div>
      </div>

      <!-- RESULTS -->
      <div class="grid gap-6 md:grid-cols-2">
        <div class="rounded-2xl border bg-white p-5 shadow-sm"><h2 class="font-semibold mb-3">Distribusi Cluster</h2><div id="cluster-table"></div></div>
        <div class="rounded-2xl border bg-white p-5 shadow-sm"><h2 class="font-semibold mb-3">Centroid</h2><div id="centroid-table"></div></div>
      </div>
    </div>
  </div>
</section>`;
  },
  init() {
    initInputs();
    setMetrics({});
    renderClusterTable();
    renderCentroidTable();
    setDisabledFlow(); // default: hanya Elbow yang aktif
    $("#btn-elbow")?.addEventListener("click", runElbow);
    $("#btn-run")?.addEventListener("click", runClustering);
    $("#btn-dbi")?.addEventListener("click", runDBI);
    $("#btn-sil")?.addEventListener("click", runSilhouette);
  },
};

export default ModelingPage;
