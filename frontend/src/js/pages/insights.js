const InsightState = {
  overview: {
    dataset: null,           // e.g., 'customers.csv'
    rows: null,
    cols: null,
    k: null,
    generated_at: null,      // ISO string
  },
  metrics: {
    wcss: null,
    dbi: null,
    silhouette: null,
  },
  clusters: [
    // { id: 0, size: 120, share: 0.45, title: "Sangat Puas", traits: ["…","…"], actions: ["…","…"] }
  ],
  top_features: [
    // optional: [{ feature:'Cleanliness', importance:0.42 }, ...]
  ],
  images: {
    distribution_b64: null,  // optional: base64 image for cluster distribution
  },
};

const $ = (s, r=document)=>r.querySelector(s);
const fmt = (v, d=2)=> (v==null || Number.isNaN(v)) ? "—" : Number(v).toFixed(d);
// Persentase aman 0–1 / 0–100
const pct = (v, d=1) => {
  const n = Number(v);
  if (!isFinite(n)) return "—";
  return (n > 1 ? n : n*100).toFixed(d) + "%";
};

// ------- Plain-language helpers untuk orang awam ------- //
const normText = (s) => String(s||"")
  .replace(/^\s*\d+\.\s*/,'')               // buang "1. "
  .replace(/^apakah\s+/i,'')                 // buang "Apakah "
  .replace(/[?;]/g,'')                       // buang tanda tanya/titik koma
  .replace(/\s+/g,' ')                       // rapikan spasi
  .trim();

// Pemetaan keyword -> label singkat (chips)
// --- GANTI toChipLabels: buat chips dari kalimat aslinya (tanpa keyword global) ---
function _titleCase(s) {
  return s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1));
}
function _shorten(s, len = 32) {
  s = s.trim();
  return s.length > len ? s.slice(0, len - 1) + "…" : s;
}
function labelFromTrait(text) {
  const t = normText(text).toLowerCase();

  // ringkas beberapa pola umum → label yang “ramah awam”
  if (/bersih|rapi/.test(t))                     return "Kebersihan & kerapian";
  if (/nyaman|aman/.test(t))                     return "Kenyamanan pelanggan";
  if (/kembali.*menggunakan|akan kembali/.test(t)) return "Niat kembali";
  if (/waktu tunggu|lama/.test(t))               return "Waktu tunggu";
  if (/lokasi|akses/.test(t))                    return "Akses lokasi";
  if (/harga|biaya/.test(t))                     return "Harga";

  // fallback: ambil frasa awal sebelum "dan/," lalu title case & truncate
  const firstClause = t.split(/,| dan /)[0];
  return _titleCase(_shorten(firstClause));
}

function cleanRec(s){
  return String(s || "")
    .replace(/^[\s\d)+\-.]+/, "")    // buang nomor urut di depan
    .replace(/[_-]\d+\b/g, "")       // buang suffix seperti _1
    .replace(/\s+/g, " ")
    .trim();
}

function toChipLabels(textOrArr, max = 3) {
  const items = Array.isArray(textOrArr) ? textOrArr : String(textOrArr).split(/\n|•|;|,/);
  const picked = [];
  const seen = new Set();

  for (const raw of items) {
    const lab = labelFromTrait(raw);
    if (!lab) continue;
    const key = lab.toLowerCase();
    if (seen.has(key)) continue;     // dedup
    seen.add(key);
    picked.push(lab);
    if (picked.length >= max) break; // batasi 3 chip
  }
  return picked.length ? picked : ["Ciri utama belum tersedia"];
}

// Chip full yang bisa multiline
const chipsHTMLFull = (labels=[]) =>
  `<div class="flex flex-wrap gap-2">
     ${labels.map(l=>`
       <span class="inline-flex items-start gap-1 px-2.5 py-1.5 rounded-full
                    text-xs bg-gradient-to-r from-sky-50 to-indigo-50
                    text-sky-800 ring-1 ring-sky-200 whitespace-normal break-words
                    max-w-[28rem]" title="${String(l).replace(/"/g,'&quot;')}">
          <span class="mt-0.5">🔎</span>${l}
       </span>`).join("")}
   </div>`;

// Rekomendasi jadi 1–2 langkah kalimat sederhana
function toSteps(textOrArr, max = 2){ 
  const items = Array.isArray(textOrArr) 
    ? textOrArr 
    : String(textOrArr).split(/[;\n•]+/); 
  const clean = items 
    .map(x => cleanRec(normText(x)))   // ← bersihkan angka 4,5,1 dan artefak _1 
    .filter(Boolean) 
    .slice(0, max); 
  return clean.length ? clean : ["Tingkatkan kualitas layanan di faktor utama."]; 
}

// ---------- UI builders ----------
function renderMetrics() {
  $("#metric-wcss").textContent = fmt(InsightState.metrics.wcss, 2);
  $("#metric-dbi").textContent = fmt(InsightState.metrics.dbi, 3);
  $("#metric-sil").textContent = fmt(InsightState.metrics.silhouette, 3);
}

function renderOverview() {
  const o = InsightState.overview;
  $("#ov-dataset").textContent = o.dataset || "—";
  $("#ov-shape").textContent = (o.rows!=null && o.cols!=null) ? `${o.rows} × ${o.cols}` : "—";
  $("#ov-k").textContent = o.k ?? "—";
  $("#ov-time").textContent = o.generated_at ? new Date(o.generated_at).toLocaleString() : "—";
}

function renderClusterRows(){
  const box = document.getElementById("cluster-rows");
  const arr = InsightState?.clusters || [];
  if (!box) return;

  if (!arr.length){
    box.innerHTML = `
      <tr>
        <td colspan="5" class="px-4 py-6 text-slate-500">
          Belum ada data cluster. Jalankan modeling terlebih dahulu.
        </td>
      </tr>`;
    return;
  }

  box.innerHTML = arr.map(c=>{
    const jumlah   = c?.size != null ? Number(c.size).toLocaleString("id-ID") : "—";
    const proporsi = pct(c?.share ?? null, 1);

    // Ciri utama → gunakan teks full dari backend (array) tanpa pemendekan
    const traits = Array.isArray(c?.traits)
      ? c.traits
      : String(c?.traits || c?.feature || c?.features || "")
          .split(/[;\n•,]+/).map(s=>s.trim()).filter(Boolean);
    const ciriHTML = chipsHTMLFull(traits);

    // Rekomendasi → tampilkan sampai 3 langkah (kalau backend sudah kirim array)
    const recSteps = Array.isArray(c?.actions)
      ? c.actions.slice(0, 3)
      : toSteps(c?.actions || c?.recommendation || c?.recommendations || "", 3);

    const recHTML  = recSteps.length
      ? recSteps.map(s => `
          <div class="mb-2 px-3 py-2 rounded-lg bg-sky-50 text-sky-800 text-sm ring-1 ring-sky-200 break-words">
            💡 ${s}
          </div>
        `).join("")
      : `<div class="text-slate-400">—</div>`;

    return `
      <tr class="align-top">
        <td class="px-4 py-3 font-medium text-slate-700">C${c?.id ?? "?"}</td>
        <td class="px-4 py-3 text-slate-700">${jumlah}</td>
        <td class="px-4 py-3 text-slate-700">${proporsi}</td>
        <td class="px-4 py-3">
          ${c?.title ? `<div class="text-slate-700 font-medium mb-2">${c.title}</div>` : ``}
          ${ciriHTML}
        </td>
        <td class="px-4 py-3">
          ${recHTML}
        </td>
      </tr>`;
  }).join("");
}

function renderTopFeatures() {
  const box = $("#top-features");
  const arr = InsightState.top_features || [];
  if (!arr.length) {
    box.innerHTML = `<div class="text-sm text-slate-500">Belum ada feature importance.</div>`;
    return;
  }
  box.innerHTML = arr.slice(0, 10).map(f => `
    <div class="flex items-center gap-3">
      <div class="w-44 shrink-0 text-sm text-slate-700">${f.feature}</div>
      <div class="flex-1 h-2 rounded bg-slate-100 overflow-hidden">
        <div class="h-full bg-sky-500" style="width:${Math.min(100, Math.max(0, f.importance*100))}%;"></div>
      </div>
      <div class="w-12 text-right text-sm text-slate-600">${pct(f.importance,1)}</div>
    </div>
  `).join("");
}

function renderDistributionImage() {
  const img = $("#img-dist");
  const ph  = $("#ph-dist");
  if (InsightState.images.distribution_b64) {
    img.src = `data:image/png;base64,${InsightState.images.distribution_b64}`;
    img.classList.remove("hidden");
    ph.classList.add("hidden");
  } else {
    img.classList.add("hidden");
    ph.classList.remove("hidden");
  }
}

// ---------- Actions (download, refresh) ----------
async function downloadReport(format="pdf") {
  try {
    const res = await fetch(`/api/report/download?format=${encodeURIComponent(format)}`);
    if (!res.ok) throw new Error("Download failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error(e);
    alert("Gagal mengunduh laporan.");
  }
}

async function loadSummary() {
  // Opsional: panggil jika backend sudah siap
  try {
    const res = await fetch("/api/report/summary");
    if (!res.ok) return; // biarkan placeholder
    const data = await res.json();

    InsightState.overview = data.overview || InsightState.overview;
    InsightState.metrics  = data.metrics  || InsightState.metrics;
    InsightState.clusters = data.clusters || [];
    InsightState.top_features = data.top_features || [];
    if (data.images?.distribution_b64) InsightState.images.distribution_b64 = data.images.distribution_b64;

    renderOverview();
    renderMetrics();
    renderClusterRows();
    renderTopFeatures();
    renderDistributionImage();
  } catch (e) {
    console.warn("Summary not loaded:", e);
  }
}

// ---------- Page object ----------
const InsightPage = {
  render() {
    return `
<section class="col-span-12 pr-6">
  <div class="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200">
    <div class="p-6 border-b">
      <h1 class="text-xl font-semibold text-slate-800">Report & Insights</h1>
      <p class="text-sm text-slate-500 mt-1">Ringkasan hasil clustering, ciri utama tiap segmen, dan rekomendasi aksi.</p>
    </div>

    <div class="p-6 space-y-6">

      <!-- OVERVIEW -->
      <div class="grid gap-4 md:grid-cols-4">
        <div class="rounded-2xl border bg-white p-4 shadow-sm">
          <div class="text-xs text-slate-500">Dataset</div>
          <div id="ov-dataset" class="text-lg font-semibold">—</div>
        </div>
        <div class="rounded-2xl border bg-white p-4 shadow-sm">
          <div class="text-xs text-slate-500">Shape</div>
          <div id="ov-shape" class="text-lg font-semibold">—</div>
        </div>
        <div class="rounded-2xl border bg-white p-4 shadow-sm">
          <div class="text-xs text-slate-500">K (clusters)</div>
          <div id="ov-k" class="text-lg font-semibold">—</div>
        </div>
        <div class="rounded-2xl border bg-white p-4 shadow-sm">
          <div class="text-xs text-slate-500">Generated</div>
          <div id="ov-time" class="text-lg font-semibold">—</div>
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

      <!-- DISTRIBUSI CLUSTER -->
      <div class="grid gap-6 md:grid-cols-2 items-start">
        <div class="rounded-2xl border bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between mb-3">
            <h2 class="font-semibold">Distribusi Cluster</h2>
            <button id="btn-refresh" class="h-9 px-3 rounded-lg border text-sm hover:bg-slate-50">Refresh</button>
          </div>
          <img id="img-dist" class="rounded-md w-full hidden" alt="Cluster Distribution"/>
          <div id="ph-dist" class="aspect-[4/3] rounded-md bg-slate-100 grid place-content-center text-slate-400 text-sm">
            Chart here
          </div>
        </div>

        <!-- TOP FEATURES -->
        <div class="rounded-2xl border bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between mb-3">
            <h2 class="font-semibold">Top Features</h2>
          </div>
          <div id="top-features" class="space-y-2"></div>
        </div>
      </div>

      <!-- TABEL SEGMENTASI -->
      <div class="rounded-2xl border bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-semibold">Segmentasi & Rekomendasi</h2>
          <div class="flex gap-2">
            <button id="btn-dl-csv" class="h-9 px-3 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700">Download CSV</button>
            <button id="btn-dl-pdf" class="h-9 px-3 rounded-lg bg-sky-600 text-white text-sm hover:bg-sky-700">Download PDF</button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="table-fixed w-full text-sm">
            <colgroup>
              <col class="w-16">
              <col class="w-20">
              <col class="w-24">
              <col class="w-[38%]">
              <col class="w-[38%]">
            </colgroup>
            <thead>
              <tr class="text-left text-slate-500">
                <th class="py-2 pr-4">Cluster</th>
                <th class="py-2 pr-4">Jumlah</th>
                <th class="py-2 pr-4">Proporsi</th>
                <th class="py-2 pr-4">Ciri Utama</th>
                <th class="py-2 pr-4">Rekomendasi</th>
              </tr>
            </thead>
            <tbody id="cluster-rows" class="divide-y"></tbody>
          </table>
        </div>
      </div>

    </div>
  </div>
</section>
    `;
  },

  init() {
    // Render awal (placeholder kosong)
    renderOverview();
    renderMetrics();
    renderClusterRows();
    renderTopFeatures();
    renderDistributionImage();

    // Wire actions
    $("#btn-dl-pdf")?.addEventListener("click", () => downloadReport("pdf"));
    $("#btn-dl-csv")?.addEventListener("click", () => downloadReport("csv"));
    $("#btn-refresh")?.addEventListener("click", () => loadSummary());

    // Coba load summary dari backend (kalau ada)
    loadSummary();
  },
};

export default InsightPage;
