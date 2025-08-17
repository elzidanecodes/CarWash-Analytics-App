// src/js/pages/modeling.js
// Frontend Modeling — siap dihubungkan ke backend Flask
// Endpoint yang dipakai (POST, JSON):
//  - /api/model/train       -> { params }                     -> { wcss, counts:[{cluster,count}], centroids:[{feature,c0,c1,...}] }
//  - /api/model/elbow       -> { k_max }                      -> { image_base64, wcss_at_k? }
//  - /api/model/dbi         -> { params }                     -> { dbi }
//  - /api/model/silhouette  -> { params }                     -> { score, image_base64? }

const ModelingState = {
  params: {
    k: 3,
    init: "k-means++",
    max_iter: 300,
    n_init: 10,
    random_state: 42,
  },
  metrics: {
    wcss: null,
    dbi: null,
    silhouette: null,
  },
  clusterCounts: [], // [{cluster:0, count:123}, ...]
  centroids: [],     // [{feature:'X1', c0:..., c1:...}, ...]
};

// ---------- helpers ----------
const $ = (s, r=document)=>r.querySelector(s);
const $all = (s, r=document)=>Array.from(r.querySelectorAll(s));
const fmt = (v, d=3)=> (v==null||Number.isNaN(v)) ? "—" : Number(v).toFixed(d);

function setLoading(btn, loading=true) {
  if (!btn) return;
  btn.disabled = loading;
  const spin = btn.querySelector("[data-spin]");
  if (spin) spin.classList.toggle("hidden", !loading);
}

function notify(el, text, ok=true) {
  if (!el) return;
  el.textContent = text;
  el.className = ok ? "text-sm text-emerald-700" : "text-sm text-rose-700";
}

// ---------- UI builders ----------
function renderClusterTable() {
  const box = $("#cluster-table");
  const arr = ModelingState.clusterCounts;
  if (!arr?.length) {
    box.innerHTML = `<div class="text-sm text-slate-500">Belum ada hasil clustering.</div>`;
    return;
  }
  box.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-slate-500">
            <th class="py-2 pr-4">Cluster</th>
            <th class="py-2 pr-4">Count</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          ${arr.map(r => `
            <tr>
              <td class="py-2 pr-4 font-medium">${r.cluster}</td>
              <td class="py-2 pr-4">${r.count}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderCentroidTable() {
  const box = $("#centroid-table");
  const arr = ModelingState.centroids;
  if (!arr?.length) {
    box.innerHTML = `<div class="text-sm text-slate-500">Belum ada centroid.</div>`;
    return;
  }
  const k = Object.keys(arr[0]).filter(k=>/^c\d+$/.test(k)).length;
  box.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-slate-500">
            <th class="py-2 pr-4">Feature</th>
            ${Array.from({length:k}).map((_,i)=>`<th class="py-2 pr-4">C${i}</th>`).join("")}
          </tr>
        </thead>
        <tbody class="divide-y">
          ${arr.map(r => `
            <tr>
              <td class="py-2 pr-4 font-medium">${r.feature}</td>
              ${Array.from({length:k}).map((_,i)=>`<td class="py-2 pr-4">${fmt(r[`c${i}`])}</td>`).join("")}
            </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function setMetrics({wcss, dbi, silhouette}={}) {
  if (wcss!=null) ModelingState.metrics.wcss = wcss;
  if (dbi!=null) ModelingState.metrics.dbi = dbi;
  if (silhouette!=null) ModelingState.metrics.silhouette = silhouette;
  $("#metric-wcss").textContent = fmt(ModelingState.metrics.wcss, 2);
  $("#metric-dbi").textContent = fmt(ModelingState.metrics.dbi, 3);
  $("#metric-sil").textContent = fmt(ModelingState.metrics.silhouette, 3);
}

function showImageBase64(imgEl, b64) {
  if (!imgEl) return;
  if (b64) {
    imgEl.src = `data:image/png;base64,${b64}`;
    imgEl.classList.remove("hidden");
    imgEl.nextElementSibling?.classList.add("hidden");
  } else {
    imgEl.classList.add("hidden");
    imgEl.nextElementSibling?.classList.remove("hidden");
  }
}

// ---------- API (hubungkan ke Flask) ----------
async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function runClustering() {
  const btn = $("#btn-run");
  const log = $("#run-log");
  setLoading(btn, true); notify(log, "Menjalankan K-Means…", true);

  try {
    const data = await postJSON("/api/model/train", { params: ModelingState.params });
    // { wcss, counts, centroids }
    setMetrics({ wcss: data.wcss });
    ModelingState.clusterCounts = data.counts || [];
    ModelingState.centroids = data.centroids || [];
    renderClusterTable();
    renderCentroidTable();
    notify(log, "Clustering selesai.", true);
  } catch (e) {
    console.error(e);
    notify(log, "Gagal menjalankan clustering.", false);
  } finally {
    setLoading(btn, false);
  }
}

async function runElbow() {
  const btn = $("#btn-elbow");
  const img = $("#img-elbow");
  const note = $("#note-elbow");
  setLoading(btn, true); notify(note, "Menghitung Elbow (WCSS)…", true);

  try {
    const data = await postJSON("/api/model/elbow", { k_max: Number($("#kmax").value) || 10 });
    // { image_base64, wcss_at_k? }
    showImageBase64(img, data.image_base64);
    if (data.wcss_at_k!=null) setMetrics({ wcss: data.wcss_at_k });
    notify(note, "Selesai.", true);
  } catch (e) {
    console.error(e);
    notify(note, "Gagal menghitung Elbow.", false);
  } finally {
    setLoading(btn, false);
  }
}

async function runDBI() {
  const btn = $("#btn-dbi");
  const note = $("#note-dbi");
  setLoading(btn, true); notify(note, "Menghitung Davies–Bouldin Index…", true);

  try {
    const data = await postJSON("/api/model/dbi", { params: ModelingState.params });
    // { dbi }
    setMetrics({ dbi: data.dbi });
    notify(note, "Selesai.", true);
  } catch (e) {
    console.error(e);
    notify(note, "Gagal menghitung DBI.", false);
  } finally {
    setLoading(btn, false);
  }
}

async function runSilhouette() {
  const btn = $("#btn-sil");
  const img = $("#img-sil");
  const note = $("#note-sil");
  setLoading(btn, true); notify(note, "Menghitung Silhouette…", true);

  try {
    const data = await postJSON("/api/model/silhouette", { params: ModelingState.params });
    // { score, image_base64? }
    setMetrics({ silhouette: data.score });
    showImageBase64(img, data.image_base64);
    notify(note, "Selesai.", true);
  } catch (e) {
    console.error(e);
    notify(note, "Gagal menghitung Silhouette.", false);
  } finally {
    setLoading(btn, false);
  }
}

// ---------- inputs ----------
function initInputs() {
  $("#k").value = ModelingState.params.k;
  $("#max_iter").value = ModelingState.params.max_iter;
  $("#n_init").value = ModelingState.params.n_init;
  $("#random_state").value = ModelingState.params.random_state;
  $("#init").value = ModelingState.params.init;

  $all("[data-bind]").forEach(el => {
    el.addEventListener("input", () => {
      const key = el.getAttribute("data-bind");
      let val = el.value;
      if (["k","max_iter","n_init","random_state"].includes(key)) val = Number(val);
      ModelingState.params[key] = val;
    });
  });
}

// ---------- Page object ----------
const ModelingPage = {
  render() {
    return `
<section class="col-span-12 pr-6">
  <div class="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200">
    <div class="p-6 border-b">
      <h1 class="text-xl font-semibold text-slate-800">Modeling</h1>
      <p class="text-sm text-slate-500 mt-1">Atur parameter, jalankan K-Means, dan hitung metrik evaluasi.</p>
    </div>

    <div class="p-6 space-y-6">
      <!-- PARAMS -->
      <div class="rounded-2xl border bg-white shadow-sm">
        <div class="p-5 border-b">
          <h2 class="font-semibold">Parameter K-Means</h2>
        </div>
        <div class="p-5 grid gap-4 md:grid-cols-5">
          <label class="block">
            <span class="text-sm text-slate-600">K (clusters)</span>
            <input id="k" data-bind="k" type="number" min="2" max="20" value="3" class="mt-1 w-full rounded-lg border px-3 py-2"/>
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
          <button id="btn-run" class="h-9 px-4 rounded-lg bg-sky-600 text-white text-sm hover:bg-sky-700 inline-flex items-center gap-2">
            <svg data-spin class="animate-spin hidden size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1010 10h-2A8 8 0 112 12H0A10 10 0 0012 2z"/></svg>
            Run Clustering
          </button>
          <div id="run-log" class="text-sm text-slate-500"></div>
        </div>
      </div>

      <!-- METRICS -->
      <div class="grid gap-6 md:grid-cols-3">
        <div class="rounded-2xl border bg-white p-5 shadow-sm">
          <div class="text-xs text-slate-500">WCSS</div>
          <div id="metric-wcss" class="text-2xl font-semibold">—</div>
        </div>
        <div class="rounded-2xl border bg-white p-5 shadow-sm">
          <div class="text-xs text-slate-500">Davies–Bouldin Index</div>
          <div id="metric-dbi" class="text-2xl font-semibold">—</div>
        </div>
        <div class="rounded-2xl border bg-white p-5 shadow-sm">
          <div class="text-xs text-slate-500">Silhouette Score</div>
          <div id="metric-sil" class="text-2xl font-semibold">—</div>
        </div>
      </div>

      <!-- CHARTS -->
      <div class="grid gap-6 md:grid-cols-2">
        <div class="rounded-2xl border bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between mb-3">
            <h2 class="font-semibold">Elbow Method</h2>
            <div class="flex items-center gap-2">
              <input id="kmax" type="number" min="5" max="30" value="10" class="w-20 rounded-lg border px-2 py-1 text-sm"/>
              <button id="btn-elbow" class="h-9 px-3 rounded-lg border text-sm hover:bg-slate-50 inline-flex items-center gap-2">
                <svg data-spin class="animate-spin hidden size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1010 10h-2A8 8 0 112 12H0A10 10 0 0012 2z"/></svg>
                Hitung
              </button>
            </div>
          </div>
          <img id="img-elbow" class="rounded-md w-full hidden" alt="Elbow Chart"/>
          <div class="aspect-[4/3] rounded-md bg-slate-100 grid place-content-center text-slate-400 text-sm">Chart here</div>
          <div id="note-elbow" class="mt-2 text-sm text-slate-500"></div>
        </div>

        <div class="rounded-2xl border bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between mb-3">
            <h2 class="font-semibold">Silhouette</h2>
            <button id="btn-sil" class="h-9 px-3 rounded-lg border text-sm hover:bg-slate-50 inline-flex items-center gap-2">
              <svg data-spin class="animate-spin hidden size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1010 10h-2A8 8 0 112 12H0A10 10 0 0012 2z"/></svg>
              Hitung
            </button>
          </div>
          <img id="img-sil" class="rounded-md w-full hidden" alt="Silhouette Chart"/>
          <div class="aspect-[4/3] rounded-md bg-slate-100 grid place-content-center text-slate-400 text-sm">Chart here</div>
          <div id="note-sil" class="mt-2 text-sm text-slate-500"></div>
        </div>
      </div>

      <!-- RESULTS -->
      <div class="grid gap-6 md:grid-cols-2">
        <div class="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 class="font-semibold mb-3">Distribusi Cluster</h2>
          <div id="cluster-table"></div>
        </div>
        <div class="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 class="font-semibold mb-3">Centroid</h2>
          <div id="centroid-table"></div>
        </div>
      </div>
    </div>
  </div>
</section>
    `;
  },

  init() {
    initInputs();
    setMetrics({});
    renderClusterTable();
    renderCentroidTable();

    $("#btn-run")?.addEventListener("click", runClustering);
    $("#btn-elbow")?.addEventListener("click", runElbow);
    $("#btn-dbi")?.addEventListener("click", runDBI);
    $("#btn-sil")?.addEventListener("click", runSilhouette);
  },
};

export default ModelingPage;