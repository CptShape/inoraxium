import { buildFolders, folderItems, folderUrl } from "../lib/explorer.mjs";
import { escapeHtml as e, pageUrl } from "./markdown.js";

export function mountExplorer(
  container,
  pages,
  { path = "", icon, refreshIcons },
) {
  const { root, byPath } = buildFolders(pages),
    node = byPath.get(path);
  if (!node) {
    container.innerHTML = `<div class="empty-state"><h1>Klasör bulunamadı.</h1><p>Klasör mevcut değil veya içindeki sayfalara erişim iznin yok.</p><a class="button-primary" href="${folderUrl("")}">Dosya gezginine dön</a></div>`;
    return;
  }
  const parent = path.split("/").slice(0, -1).join("/");
  let layout = "list";
  try {
    layout =
      localStorage.getItem("inoraxium:explorer-layout") === "grid"
        ? "grid"
        : "list";
  } catch {}
  const parts = path ? path.split("/") : [];
  container.innerHTML = `<section class="explorer-view"><header class="explorer-intro"><div class="eyebrow">EVRENİN DOSYALARI</div><h1>${e(node.name)}</h1><p>Klasörler arasında gezin, aradığın hikâyeye ulaş.</p></header><div class="explorer-top"><nav class="folder-breadcrumbs" aria-label="Klasör yolu"><a href="${folderUrl("")}" ${!path ? 'aria-current="page"' : ""}>${icon("library")}<span>Atlas</span></a>${parts.map((part, index) => `${icon("chevron-right")}<a href="${folderUrl(parts.slice(0, index + 1).join("/"))}" ${index === parts.length - 1 ? 'aria-current="page"' : ""}>${e(part)}</a>`).join("")}</nav><span class="folder-total">${node.total} erişilebilir sayfa</span></div><div class="explorer-toolbar"><a class="icon-button folder-up ${!path ? "is-disabled" : ""}" href="${folderUrl(parent)}" aria-label="Üst klasöre git" ${!path ? 'aria-disabled="true" tabindex="-1"' : ""}>${icon("arrow-left")}</a><label class="explorer-search">${icon("search")}<input type="search" placeholder="Bu klasörde ve alt klasörlerde ara…" aria-label="Klasör içinde ara"></label><label><span class="sr-only">Dosya sıralaması</span><select aria-label="Dosya sıralaması"><option value="az">İsim: A → Z</option><option value="za">İsim: Z → A</option></select></label><div class="explorer-layout" role="group" aria-label="Görünüm"><button data-layout="list" aria-label="Liste görünümü">${icon("menu")}</button><button data-layout="grid" aria-label="Kart görünümü">${icon("layers")}</button></div></div><div class="explorer-count" role="status" aria-live="polite"></div><div class="explorer-items"></div></section>`;
  const input = container.querySelector("input"),
    sort = container.querySelector("select"),
    items = container.querySelector(".explorer-items"),
    count = container.querySelector(".explorer-count");
  function draw() {
    const matches = folderItems(node, pages, input.value, sort.value);
    items.className = `explorer-items explorer-${layout}`;
    container.querySelectorAll("[data-layout]").forEach((button) => {
      const chosen = button.dataset.layout === layout;
      button.classList.toggle("active", chosen);
      button.setAttribute("aria-pressed", String(chosen));
    });
    count.textContent = input.value.trim()
      ? `${matches.length} sonuç · Alt klasörler dahil`
      : `${node.folders.size} klasör · ${node.pages.length} sayfa`;
    items.innerHTML = matches.length
      ? `${layout === "list" ? '<div class="explorer-columns" aria-hidden="true"><span>İSİM</span><span>TÜR</span><span>İÇERİK</span></div>' : ""}${matches
          .map((item) => {
            const folder = item.kind === "folder",
              page = item.page;
            return `<a class="explorer-item ${folder ? "folder-item" : "document-item"}" href="${folder ? folderUrl(item.folder.path) : pageUrl(page.id)}"><span class="explorer-item-icon">${icon(folder ? "folder" : page.type === "canvas" ? "layers" : "file-text")}</span><span class="explorer-item-name"><strong>${e(item.name)}</strong><small>${folder ? `${item.folder.folders.size} alt klasör · ${item.folder.total} sayfa` : input.value.trim() ? e(page.id.split("/").slice(0, -1).join("/") || "Atlas") : e(page.type === "canvas" ? "Bağlantılar ve fikirler" : "Hikâyeyi okumak için aç")}</small></span><span class="explorer-item-type">${folder ? "Klasör" : page.type === "canvas" ? "Canvas" : "Sayfa"}</span><span class="explorer-item-detail">${folder ? `${item.folder.total} sayfa` : page.type === "canvas" ? `${page.canvas?.nodes?.length || 0} kart` : `${Math.max(1, Math.ceil(page.words / 200))} dk okuma`}</span><span class="explorer-item-arrow">${icon(folder ? "chevron-right" : "arrow-up-right")}</span></a>`;
          })
          .join("")}`
      : `<div class="empty-state">${icon("search")}<h2>${input.value ? "Aradığın dosyayı bulamadık." : "Bu klasör henüz boş."}</h2><p>${input.value ? "Başka bir isimle tekrar dene." : "Görüntüleme iznin olan sayfalar burada görünür."}</p>${input.value ? '<button class="text-link" data-clear-search>Aramayı temizle</button>' : ""}</div>`;
    items
      .querySelector("[data-clear-search]")
      ?.addEventListener("click", () => {
        input.value = "";
        draw();
        input.focus();
      });
    refreshIcons();
  }
  input.addEventListener("input", draw);
  sort.addEventListener("change", draw);
  container.querySelectorAll("[data-layout]").forEach((button) =>
    button.addEventListener("click", () => {
      layout = button.dataset.layout;
      try {
        localStorage.setItem("inoraxium:explorer-layout", layout);
      } catch {}
      draw();
    }),
  );
  draw();
}
