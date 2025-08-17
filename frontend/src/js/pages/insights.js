// src/js/pages/insight.js
const InsightPage = {
  render() {
    return `
<section class="col-span-12 pr-6">
  <div class="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200">
    <div class="p-6 border-b">
      <h1 class="text-xl font-semibold text-slate-800">Insight</h1>
    </div>
    <div class="p-6 space-y-6">
      <p class="text-slate-600 text-sm">Ringkasan hasil cluster & rekomendasi aksi.</p>

      <div class="rounded-xl border bg-white p-5 shadow-sm">
        <h2 class="font-semibold mb-3">Ringkasan Segmentasi</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-slate-500">
                <th class="py-2 pr-4">Cluster</th>
                <th class="py-2 pr-4">Jumlah</th>
                <th class="py-2 pr-4">Ciri Utama</th>
                <th class="py-2 pr-4">Rekomendasi</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr>
                <td class="py-2 pr-4 font-medium">0</td>
                <td class="py-2 pr-4">—</td>
                <td class="py-2 pr-4">—</td>
                <td class="py-2 pr-4">—</td>
              </tr>
              <tr>
                <td class="py-2 pr-4 font-medium">1</td>
                <td class="py-2 pr-4">—</td>
                <td class="py-2 pr-4">—</td>
                <td class="py-2 pr-4">—</td>
              </tr>
              <tr>
                <td class="py-2 pr-4 font-medium">2</td>
                <td class="py-2 pr-4">—</td>
                <td class="py-2 pr-4">—</td>
                <td class="py-2 pr-4">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  </div>
</section>
    `;
  },
  init() {},
};

export default InsightPage;
