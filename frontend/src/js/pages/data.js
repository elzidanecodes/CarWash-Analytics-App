// src/js/pages/data.js
function bindDropdown(btnId, menuId) {
  const btn = document.getElementById(btnId);
  const menu = document.getElementById(menuId);
  if (!btn || !menu) return;

  const toggle = (ev) => {
    ev?.stopPropagation?.();
    menu.classList.toggle("hidden");
  };
  btn.addEventListener("click", toggle);
  document.addEventListener("click", () => menu.classList.add("hidden"), { once: true });
  menu.addEventListener("click", (e) => e.stopPropagation());
}

function initInteractions() {
  // Dropdown “Type” & “Add Action”
  bindDropdown("typeBtn", "typeMenu");
  bindDropdown("actionBtn", "actionMenu");

  // Dropzone: klik label → buka input file
  const input = document.getElementById("dropzone-file");
  if (input) {
    input.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) {
        console.log("Selected:", file.name);
        // TODO: kirim ke backend Flask pakai fetch FormData kalau perlu
      }
    });
  }
}

const DataPage = {
  render() {
    return `
<section class="col-span-12 pr-6">
  <div class="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 w-full h-full max-h-none max-w-none">
    <div class="p-6 border-b">
      <h1 class="text-xl font-semibold text-slate-800">Enhance your workflow</h1>
    </div>

    <div class="p-6 space-y-6">
      <!-- job header -->
      <div class="flex flex-wrap items-center gap-3 justify-between">
        <div class="flex flex-wrap items-center gap-2">
          <span class="px-3 py-1 rounded-lg bg-slate-50 ring-1 ring-slate-200 text-sm font-medium">UI / UX Designer</span>
          <span class="inline-flex items-center gap-1 text-slate-500 text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" class="size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.25c-4.556 0-8.25 3.694-8.25 8.25 0 6.188 8.25 11.25 8.25 11.25s8.25-5.062 8.25-11.25c0-4.556-3.694-8.25-8.25-8.25zM12 12.75a2.25 2.25 0 110-4.5 2.25 2.25 0 010 4.5z"/></svg>
            Berlin, Germany
          </span>
          <span class="inline-flex items-center gap-1 text-slate-500 text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" class="size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M4.5 5.25a2.25 2.25 0 012.25-2.25h10.5A2.25 2.25 0 0119.5 5.25v13.5A2.25 2.25 0 0117.25 21H6.75A2.25 2.25 0 014.5 18.75V5.25zM7.5 6.75h9v10.5h-9V6.75z"/></svg>
            Employee
          </span>
          <span class="inline-flex items-center gap-1 text-slate-500 text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" class="size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M4.5 6.75A2.25 2.25 0 016.75 4.5h10.5A2.25 2.25 0 0119.5 6.75v10.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 17.25V6.75z"/></svg>
            IT &amp; Development
          </span>
        </div>
        <button class="h-9 px-3 rounded-lg border text-slate-700 hover:bg-slate-50 text-sm">Save as default</button>
      </div>

      <!-- Pipeline -->
      <div>
        <h2 class="text-sm font-semibold text-slate-700 mb-2">Upload File</h2>
        <p class="text-sm text-slate-500 mb-4">Manage candidates by setting up a hiring pipeline for this job.</p>

        <div class="space-y-2">
          <div class="flex items-center justify-center w-full">
            <label for="dropzone-file" class="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
              <div class="flex flex-col items-center justify-center pt-5 pb-6">
                <svg class="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/></svg>
                <p class="mb-2 text-sm text-gray-500 dark:text-gray-400"><span class="font-semibold">Click to upload</span> or drag and drop</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">CSV or Excel (MAX. 10MB)</p>
              </div>
              <input id="dropzone-file" type="file" class="hidden" />
            </label>
          </div>

          <!-- Applied -->
          <div class="flex items-center gap-2 h-11 px-3 rounded-lg border bg-white">
            <span class="inline-flex size-2.5 rounded-full bg-slate-300"></span>
            <span class="text-sm font-medium text-slate-700 flex-1">Applied</span>
            <span class="text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" class="size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.5a4.5 4.5 0 00-4.5 4.5v1.5h9V6A4.5 4.5 0 0012 1.5z"/><path d="M4.5 10.5A2.25 2.25 0 016.75 8.25h10.5A2.25 2.25 0 0119.5 10.5v9A2.25 2.25 0 0117.25 21.75H6.75A2.25 2.25 0 014.5 19.5v-9z"/></svg>
            </span>
          </div>

          <!-- Screening -->
          <div class="flex items-center gap-2 h-11 px-3 rounded-lg border bg-white">
            <span class="inline-flex size-2.5 rounded-full bg-rose-400"></span>
            <span class="text-sm font-medium text-slate-700 flex-1">Screening</span>
          </div>

          <!-- Editable Stage -->
          <div class="rounded-xl border-2 border-sky-300 bg-sky-50/40 p-4">
            <div class="flex justify-between items-start mb-3">
              <div class="text-sm font-medium text-slate-700">Stage name</div>
              <button class="text-slate-400 hover:text-slate-600" title="Remove">
                <svg xmlns="http://www.w3.org/2000/svg" class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input type="text" placeholder="Onsite Talk" class="col-span-2 h-10 rounded-lg border-slate-300 focus:ring-2 focus:ring-sky-200 focus:border-sky-400 text-sm"/>

              <div class="relative">
                <button id="typeBtn" data-dropdown-toggle="typeMenu" class="w-full h-10 inline-flex items-center justify-between rounded-lg border bg-white px-3 text-sm">
                  <span class="inline-flex items-center gap-2">
                    <span class="size-2.5 inline-block rounded-full bg-amber-400"></span>
                    Interview
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" class="size-4 text-slate-500" viewBox="0 0 24 24" fill="currentColor"><path d="M6 9l6 6 6-6" /></svg>
                </button>
                <div id="typeMenu" class="z-20 hidden w-44 bg-white rounded-lg shadow border">
                  <ul class="py-1 text-sm text-slate-700">
                    <li><a href="#" class="flex items-center gap-2 px-3 py-2 hover:bg-slate-50"><span class="size-2.5 bg-amber-400 rounded-full"></span>Interview</a></li>
                    <li><a href="#" class="flex items-center gap-2 px-3 py-2 hover:bg-slate-50"><span class="size-2.5 bg-sky-400 rounded-full"></span>Assignment</a></li>
                    <li><a href="#" class="flex items-center gap-2 px-3 py-2 hover:bg-slate-50"><span class="size-2.5 bg-emerald-400 rounded-full"></span>Offer</a></li>
                  </ul>
                </div>
              </div>
            </div>

            <div class="mt-3 flex items-center justify-between">
              <div class="relative">
                <button id="actionBtn" data-dropdown-toggle="actionMenu" class="h-9 px-3 rounded-lg border bg-white text-sm inline-flex items-center gap-2">
                  <span class="text-sky-600">+ Add Action</span>
                </button>
                <div id="actionMenu" class="z-20 hidden w-48 bg-white rounded-lg shadow border">
                  <ul class="py-1 text-sm text-slate-700">
                    <li><a href="#" class="block px-3 py-2 hover:bg-slate-50">Send an email</a></li>
                    <li><a href="#" class="block px-3 py-2 hover:bg-slate-50">Add a note</a></li>
                    <li><a href="#" class="block px-3 py-2 hover:bg-slate-50">Add followers</a></li>
                  </ul>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <button class="h-9 px-3 rounded-lg border text-sm hover:bg-slate-50">Cancel</button>
                <button class="h-9 px-4 rounded-lg bg-sky-600 text-white text-sm hover:bg-sky-700">Save</button>
              </div>
            </div>
          </div>

          <!-- Hired -->
          <div class="flex items-center gap-2 h-11 px-3 rounded-lg border bg-white">
            <span class="inline-flex size-2.5 rounded-full bg-emerald-400"></span>
            <span class="text-sm font-medium text-slate-700 flex-1">Hired</span>
          </div>
        </div>

        <div class="pt-3">
          <button class="text-sky-700 text-sm hover:underline">+ Add another pipeline stage</button>
        </div>
      </div>
    </div>
  </div>
</section>
    `;
  },
  init() {
    initInteractions();
  },
};

export default DataPage;
