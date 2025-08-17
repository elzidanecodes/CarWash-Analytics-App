// src/js/pages/modeling.js
const ModelingPage = {
  render() {
    return `
<section class="col-span-12 pr-6">
  <div class="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200">
    <div class="p-6 border-b">
      <h1 class="text-xl font-semibold text-slate-800">Modeling</h1>
    </div>
    <div class="p-6 space-y-6">
      <p class="text-slate-600 text-sm">Set parameter, jalankan clustering, dan evaluasi (Elbow / DBI).</p>

      <div class="grid gap-4 md:grid-cols-3">
        <label class="block">
          <span class="text-sm text-slate-600">K (clusters)</span>
          <input type="number" value="3" min="2" max="10" class="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <label class="block">
          <span class="text-sm text-slate-600">Max Iter</span>
          <input type="number" value="300" min="10" max="1000" class="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <label class="block">
          <span class="text-sm text-slate-600">Init</span>
          <select class="mt-1 w-full rounded-lg border px-3 py-2">
            <option>k-means++</option>
            <option>random</option>
          </select>
        </label>
      </div>

      <div class="flex gap-3">
        <button class="h-9 px-4 rounded-lg bg-sky-600 text-white text-sm hover:bg-sky-700">Jalankan</button>
        <button class="h-9 px-4 rounded-lg border text-sm hover:bg-slate-50">Elbow</button>
        <button class="h-9 px-4 rounded-lg border text-sm hover:bg-slate-50">Hitung DBI</button>
      </div>

      <div class="grid gap-6 md:grid-cols-2">
        <div class="rounded-xl border bg-white p-5 shadow-sm">
          <h2 class="font-semibold mb-3">Visualisasi Cluster</h2>
          <div class="aspect-[4/3] rounded-lg bg-slate-100 grid place-content-center text-slate-400 text-sm">Chart here</div>
        </div>
        <div class="rounded-xl border bg-white p-5 shadow-sm">
          <h2 class="font-semibold mb-3">Evaluasi</h2>
          <ul class="text-sm text-slate-700 space-y-1">
            <li>Elbow (WCSS): —</li>
            <li>Davies-Bouldin Index: —</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</section>
    `;
  },
  init() {},
};

export default ModelingPage;