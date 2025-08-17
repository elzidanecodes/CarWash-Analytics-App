// aktifkan komponen interaktif Flowbite (dropdown, modal, dsb.)
import "flowbite";


import DataPage from "./pages/data.js";
import ModelingPage from "./pages/modeling.js";
import InsightPage from "./pages/insights.js";

const routes = {
  "/data": DataPage,
  "/modeling": ModelingPage,
  "/insight": InsightPage,
};

const outlet = document.getElementById("spa-content");

function normalize(path) {
  if (routes[path]) return path;
  if (path === "/" || path === "") return "/data";
  // fallback
  return "/data";
}

function setActiveLink(path) {
  document.querySelectorAll(".nav-link").forEach((link) => {
    const isActive = link.getAttribute("href") === path;

    // toggle wrapper
    link.classList.toggle("bg-white", isActive);
    link.classList.toggle("text-sky-700", isActive);
    link.classList.toggle("ring-1", isActive);
    link.classList.toggle("ring-sky-200", isActive);

    // toggle icon color bg
    const iconWrap = link.querySelector("span.inline-flex");
    if (iconWrap) {
      iconWrap.classList.toggle("bg-sky-50", isActive);
      iconWrap.classList.toggle("text-sky-600", isActive);
      iconWrap.classList.toggle("bg-slate-100", !isActive);
      iconWrap.classList.toggle("text-slate-500", !isActive);
    }

    // toggle font weight label
    const label = link.querySelector(".text-sm > div");
    if (label) {
      label.classList.toggle("font-semibold", isActive);
      label.classList.toggle("font-medium", !isActive);
    }
  });
}

async function render(path) {
  const p = normalize(path);
  setActiveLink(p);

  const page = routes[p];
  if (!page) return;

  // render HTML
  outlet.innerHTML = page.render();

  // jalankan inisialisasi event untuk halaman itu
  if (typeof page.init === "function") page.init();
}

function navigate(path) {
  history.pushState({}, "", path);
  render(path);
}

// intercept klik sidebar (SPA, tanpa #)
document.addEventListener("click", (e) => {
  const a = e.target.closest("a.nav-link");
  if (!a) return;

  const href = a.getAttribute("href");
  if (!href || !href.startsWith("/")) return;

  e.preventDefault();
  navigate(href);
});

window.addEventListener("popstate", () => render(location.pathname));

// first paint
render(location.pathname);
