import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-500.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/cormorant-garamond/latin-400.css";
import "@fontsource/cormorant-garamond/latin-500.css";
import "@fontsource/cormorant-garamond/latin-600.css";
import "@fontsource/cormorant-garamond/latin-500-italic.css";
import "@fontsource/manrope/latin-ext-400.css";
import "@fontsource/manrope/latin-ext-500.css";
import "@fontsource/manrope/latin-ext-600.css";
import "@fontsource/manrope/latin-ext-700.css";
import "@fontsource/cormorant-garamond/latin-ext-400.css";
import "@fontsource/cormorant-garamond/latin-ext-500.css";
import "@fontsource/cormorant-garamond/latin-ext-600.css";
import "@fontsource/cormorant-garamond/latin-ext-500-italic.css";
import {
  createIcons,
  Search,
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Orbit,
  Flame,
  Castle,
  ScrollText,
  House,
  Library,
  Bookmark,
  Network,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Layers,
  Compass,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Link,
  Check,
  Shuffle,
  Image,
  Maximize,
  Clock,
  Sparkles,
  FileText,
  Folder,
  ExternalLink,
} from "lucide";
import {
  createMarkdown,
  escapeHtml as e,
  pageUrl,
  headingId,
} from "./markdown.js";
import { mountBoard } from "./canvas.js";
import "./style.css";
import "./explorer.css";
import { mountExplorer } from "./explorer.js";
import { folderUrl } from "../lib/explorer.mjs";
import {
  access,
  connectAccess,
  login,
  logout,
  registeredUsers,
  saveAccess,
} from "./access.js";

const iconSet = {
  Search,
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Orbit,
  Flame,
  Castle,
  ScrollText,
  House,
  Library,
  Bookmark,
  Network,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Layers,
  Compass,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Link,
  Check,
  Shuffle,
  Image,
  Maximize,
  Clock,
  Sparkles,
  FileText,
  Folder,
  ExternalLink,
};
const i = (name, cls = "") =>
  `<i data-lucide="${name}" class="${cls}" aria-hidden="true"></i>`;
const icons = () =>
  createIcons({ icons: iconSet, attrs: { "stroke-width": 1.5 } });
const readStore = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(`inoraxium:${key}`)) ?? fallback;
  } catch {
    return fallback;
  }
};
const saveStore = (key, value) => {
  try {
    localStorage.setItem(`inoraxium:${key}`, JSON.stringify(value));
  } catch {
    /* reading still works without storage */
  }
};
let bookmarks = readStore("bookmarks", []),
  recent = readStore("recent", []);
if (!Array.isArray(bookmarks)) bookmarks = [];
if (!Array.isArray(recent)) recent = [];
document.documentElement.dataset.theme =
  readStore("theme", "dark") === "light" ? "light" : "dark";
let data, markdown, pages, current, boardCleanup, tocObserver, toastTimer;
const app = document.querySelector("#app");
const sigil = `<svg class="sigil" viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="m32 3 25 29-25 29L7 32Z"/><circle cx="32" cy="32" r="19"/><path d="M32 13v38M20 21h24M20 43h24M15 32h34"/><circle cx="32" cy="32" r="4"/></svg>`;
const route = () => {
  const raw = location.hash.slice(1) || "/";
  const [pathname, query] = raw.split("?");
  const parts = pathname.split("/").filter(Boolean);
  const decode = (value) => {
    try {
      return decodeURIComponent(value || "");
    } catch {
      return value || "";
    }
  };
  return {
    view: parts[0] || "home",
    id: decode(parts.slice(1).join("/")),
    query: new URLSearchParams(query || ""),
  };
};
const pageImage = (page, thumb = true) =>
  page?.images[0] ? markdown.asset(page.images[0].file, page.id, thumb) : null;
const collection = (page) =>
  data.config.collections.find((c) => c.id === page.collection);
const tagLink = (tag) => `#/tag/${encodeURIComponent(tag)}`;
const tagHtml = (tags) =>
  tags
    .map((tag) => `<a class="tag" href="${tagLink(tag)}">${e(tag)}</a>`)
    .join("");
function notify(message) {
  const el = document.querySelector("#toast");
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("visible"), 2600);
}

function shell() {
  const r = current;
  const active = (name) => (r.view === name ? "active" : "");
  const page = pages.get(r.id);
  const locationLabel =
    r.view === "page"
      ? collection(page || {})?.title || "Arşiv"
      : r.view === "collection"
        ? data.config.collections.find((c) => c.id === r.id)?.title
        : {
            home: "Genel bakış",
            archive: "Tüm sayfalar",
            files: "Dosya gezgini",
            graph: "Bağlantı haritası",
            bookmarks: "Kaydedilenler",
            canvases: "Canvas panoları",
            tag: r.id,
          }[r.view];
  app.innerHTML = `<aside class="sidebar" aria-label="Ana menü"><a class="brand" href="#/">${sigil}<span>INORAXIUM<small>EVRENİN ATLASI</small></span></a><button class="sidebar-search" data-action="search">${i("search")}<span>Atlas içinde ara</span><kbd>⌘ K</kbd></button><div class="sidebar-scroll"><div class="nav-label">KEŞFET</div><nav class="primary-nav"><a class="${active("files")}" href="#/files">${i("folder")}<span>Dosya gezgini</span></a><a class="${active("home")}" href="#/">${i("compass")}<span>Genel bakış</span></a><a class="${active("archive")}" href="#/archive">${i("library")}<span>Tüm sayfalar</span><small>${data.pages.length}</small></a><a class="${active("graph")}" href="#/graph">${i("network")}<span>Bağlantı haritası</span></a><a class="${active("canvases")}" href="#/canvases">${i("layers")}<span>Canvas panoları</span><small>${data.stats.canvases}</small></a><a class="${active("bookmarks")}" href="#/bookmarks">${i("bookmark")}<span>Kaydedilenler</span><small id="bookmark-count">${bookmarks.filter((id) => pages.has(id)).length}</small></a></nav><div class="nav-label collection-label">KOLEKSİYONLAR<span>04</span></div><nav class="collection-nav">${data.config.collections.map((c) => `<a class="${r.view === "collection" && r.id === c.id ? "active" : ""}" href="#/collection/${c.id}">${i(c.icon)}<span>${e(c.title)}</span><small>${data.pages.filter((p) => p.collection === c.id).length}</small></a>`).join("")}</nav></div><div class="sidebar-footer"><span class="status-dot"></span><div>Hikâyeler yaşamaya devam eder.<small>Inoraxium dijital arşivi</small></div><button class="icon-button" data-action="theme" aria-label="Renk temasını değiştir">${i(document.documentElement.dataset.theme === "light" ? "moon" : "sun")}</button></div></aside><button class="sidebar-scrim" data-action="close-menu" aria-label="Menüyü kapat"></button><div class="workspace"><header class="topbar"><div class="breadcrumbs"><button class="icon-button menu-button" data-action="menu" aria-label="Menüyü aç">${i("menu")}</button><a href="#/">ATLAS</a>${i("chevron-right")}<span>${e(locationLabel || "Sayfa")}</span></div><div class="topbar-actions"><span class="edition">INORAXIUM CHRONICLES</span><button class="icon-button" data-action="random" aria-label="Rastgele sayfa aç" title="Rastgele sayfa">${i("shuffle")}</button><button class="icon-button" data-action="search" aria-label="Ara">${i("search")}</button></div></header><main id="main" tabindex="-1"></main><footer class="site-footer"><a href="#/">INORAXIUM</a><span>Her sayfa, başka bir dünyanın kapısı.</span><a href="#/archive">Atlası keşfet ${i("arrow-up-right")}</a></footer></div>`;
}

function card(page, number = "", coverOverride = null) {
  const image = coverOverride || pageImage(page);
  return `<a class="page-card ${!image ? "no-image" : ""}" href="${pageUrl(page.id)}"><div class="card-art">${image ? `<img src="${e(image)}" alt="" loading="lazy">` : `<div class="card-constellation">${sigil}</div>`}<span class="card-category">${e(collection(page)?.title || (page.type === "canvas" ? "CANVAS" : "EVREN NOTLARI"))}</span><span class="card-corner">${i("arrow-up-right")}</span></div><div class="card-copy"><span class="card-index">${number || (page.type === "canvas" ? "CANVAS" : "ARŞİV")}</span><h3>${e(page.title)}</h3><p>${e(page.excerpt || "Bu hikâyenin satırları henüz yazılmayı bekliyor.")}</p><div class="card-meta"><span>${i(page.type === "canvas" ? "layers" : "book-open")}${page.type === "canvas" ? `${page.canvas.nodes?.length || 0} kart` : `${Math.max(1, Math.ceil(page.words / 200))} dk okuma`}</span><span>${page.links.length} bağlantı</span></div></div></a>`;
}

function home() {
  const hero = pages.get(data.config.heroPage);
  const features = data.config.featured
    .map((id) => pages.get(id))
    .filter(Boolean);
  const fallbackCovers = [];
  const visited = recent.filter((id) => pages.has(id)).slice(0, 4);
  document.querySelector("#main").innerHTML =
    `<div class="home-view"><section class="hero"><img class="hero-image" src="${e(pageImage(hero, false) || "")}" alt="" fetchpriority="high"><div class="hero-vignette"></div><div class="hero-orbit orbit-one"></div><div class="hero-orbit orbit-two"></div><div class="hero-content"><div class="eyebrow"><span class="tiny-star">✧</span> BİR EVREN. SAYISIZ HİKÂYE.</div><h1>Tanrılar düşer.<br><em>Hikâyeler kalır.</em></h1><p>Kadim güçlerin, unutulmuş diyarların ve birbirine bağlanan kaderlerin izini sür. Inoraxium'un hikâyesi burada başlıyor.</p><div class="hero-actions"><a class="button-primary" href="#/archive">Atlası keşfet ${i("arrow-right")}</a><a class="hero-secondary" href="#/graph">${i("network")}Bağları gör</a></div></div><a class="hero-caption" href="${pageUrl(hero?.id || "")}"><span>ÖNE ÇIKAN SAYFA</span><strong>${e(hero?.title || "Atlas")}</strong><small>Hikâyeyi keşfet ${i("arrow-up-right")}</small></a><span class="hero-coordinate">I · XXXVII · INFINITY</span></section><section class="stat-strip" aria-label="Atlas istatistikleri"><div>${i("book-open")}<strong>${data.stats.pages}</strong><span>arşiv sayfası</span></div><div>${i("network")}<strong>${data.stats.links}</strong><span>hikâyeler arası bağ</span></div><div>${i("image")}<strong>${data.stats.images}</strong><span>evrenden görüntü</span></div><span class="stat-note">BÜTÜN HİKÂYELER BİRBİRİNE BAĞLIDIR <span>✧</span></span></section><section class="home-section"><div class="section-heading"><div><div class="eyebrow">KEŞFE BAŞLA</div><h2>Atlasın sayfaları arasında</h2></div><a class="text-link" href="#/archive">Tüm sayfalar ${i("arrow-up-right")}</a></div><div class="feature-grid">${features.map((page, index) => card(page, `0${index + 1}`, fallbackCovers[index] ? pageImage(pages.get(fallbackCovers[index])) : null)).join("")}</div></section><section class="home-section collections-section"><div class="section-heading"><div><div class="eyebrow">EVRENİN KATMANLARI</div><h2>Bir yol seç.</h2></div><span class="section-note">Her kapı başka bir hikâyeye açılır.</span></div><div class="collection-grid">${data.config.collections.map((c, index) => `<a href="#/collection/${c.id}" class="collection-tile"><span class="collection-number">0${index + 1}</span>${i(c.icon)}<h3>${e(c.title)}</h3><p>${e(c.description)}</p><div><span>${data.pages.filter((p) => p.collection === c.id).length} sayfa</span>${i("arrow-up-right")}</div></a>`).join("")}</div></section>${
      visited.length
        ? `<section class="home-section"><div class="section-heading"><div><div class="eyebrow">YOLCULUĞUNA DEVAM ET</div><h2>Son ziyaret edilenler</h2></div></div><div class="recent-list">${visited
            .map((id) => {
              const p = pages.get(id);
              return `<a href="${pageUrl(id)}">${i("clock")}<span>${e(p.title)}</span>${i("arrow-up-right")}</a>`;
            })
            .join("")}</div></section>`
        : ""
    }</div>`;
}

function listView() {
  const r = current;
  const c = data.config.collections.find((c) => c.id === r.id);
  const selectedTag = r.view === "tag" ? r.id : r.query.get("tag") || "";
  const title =
    r.view === "collection"
      ? c?.title || "Koleksiyon"
      : r.view === "bookmarks"
        ? "Kaydedilen sayfalar"
        : r.view === "canvases"
          ? "Canvas panoları"
          : r.view === "tag"
            ? `#${r.id}`
            : "Bütün bir evren.";
  const description =
    r.view === "collection"
      ? c?.description
      : r.view === "bookmarks"
        ? "Yeniden dönmek istediğin hikâyeler. Bu tarayıcıda sana özel saklanır."
        : r.view === "canvases"
          ? "Hikâyeleri aynı düzlemde gör. Kartlar arasında gezin, bağların izini sür."
          : "Tanrıları, diyarları ve hikâyelerin ardındaki bağları keşfet.";
  let candidates = data.pages.filter((p) =>
    r.view === "collection"
      ? p.collection === r.id
      : r.view === "bookmarks"
        ? bookmarks.includes(p.id)
        : r.view === "canvases"
          ? p.type === "canvas"
          : true,
  );
  const tags = [...new Set(candidates.flatMap((p) => p.tags))].sort((a, b) =>
    a.localeCompare(b, "tr"),
  );
  document.querySelector("#main").innerHTML =
    `<div class="archive-view"><div class="view-intro"><div class="eyebrow">INORAXIUM / ${r.view === "canvases" ? "CANVAS" : "DİJİTAL ARŞİV"}</div><h1>${e(title)}</h1><p>${e(description || "")}</p></div><div class="archive-toolbar"><label class="archive-search">${i("search")}<input id="filter" type="search" placeholder="Bu sayfalarda ara…" aria-label="Sayfaları filtrele"></label><label class="filter-label"><span class="sr-only">Etiket</span><select id="tag-filter"><option value="">Tüm etiketler</option>${tags.map((t) => `<option value="${e(t)}" ${t === selectedTag ? "selected" : ""}>${e(t)}</option>`).join("")}</select></label><label class="filter-label"><span class="sr-only">Sıralama</span><select id="sort"><option value="az">A → Z</option><option value="links">En çok bağlantı</option><option value="length">En uzun okuma</option></select></label></div><div class="archive-count" aria-live="polite"></div><div class="archive-grid"></div></div>`;
  const filter = document.querySelector("#filter"),
    tag = document.querySelector("#tag-filter"),
    sort = document.querySelector("#sort");
  const update = () => {
    const query = fold(filter.value);
    const visible = candidates
      .filter(
        (p) =>
          (!tag.value || p.tags.includes(tag.value)) &&
          (!query ||
            fold(`${p.title} ${p.tags.join(" ")} ${p.search}`).includes(query)),
      )
      .sort((a, b) =>
        sort.value === "links"
          ? b.links.length - a.links.length
          : sort.value === "length"
            ? b.words - a.words
            : a.title.localeCompare(b.title, "tr"),
      );
    document.querySelector(".archive-count").innerHTML =
      `<span>${visible.length} ${r.view === "canvases" ? "canvas" : "sayfa"}</span><span>${tag.value ? `#${e(tag.value)}` : "KEŞFEDİLMEYİ BEKLEYEN HİKÂYELER"}</span>`;
    document.querySelector(".archive-grid").innerHTML = visible.length
      ? visible.map((page) => card(page)).join("")
      : `<div class="empty-state">${i(r.view === "bookmarks" ? "bookmark" : r.view === "canvases" ? "layers" : "search")}<h2>${r.view === "bookmarks" && !candidates.length ? "Hikâyelerine bir işaret bırak." : r.view === "canvases" && !candidates.length ? "İlk pano henüz çizilmedi." : "Burada bir sayfa bulamadık."}</h2><p>${r.view === "bookmarks" && !candidates.length ? "Bir sayfayı okurken yer imi simgesine tıkla; sonra buradan devam et." : r.view === "canvases" && !candidates.length ? "Chronicler’da oluşturacağın .canvas dosyaları, sonraki yayında burada görünecek." : "Başka bir kelime ya da etiketle yeniden dene."}</p><a class="text-link" href="#/archive">Arşive dön ${i("arrow-right")}</a></div>`;
    icons();
  };
  for (const element of [filter, tag, sort])
    element.addEventListener(element === filter ? "input" : "change", update);
  update();
}
const fold = (value) =>
  String(value)
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replaceAll("ı", "i");

function infobox(page) {
  const omitted = new Set([
    "title",
    "tags",
    "image",
    "images",
    "aliases",
    "cssclasses",
    "layout",
  ]);
  const field = (value) => {
    if (Array.isArray(value))
      return value
        .map((item) => `<div class="info-value">${field(item)}</div>`)
        .join("");
    if (value && typeof value === "object")
      return Object.entries(value)
        .map(
          ([key, item]) =>
            `<div class="info-value"><span class="info-key">${e(key)}</span>${field(item)}</div>`,
        )
        .join("");
    const string = String(value ?? "");
    const colon = string.indexOf(":");
    if (colon > 0 && !string.startsWith("[[") && !/^https?:/.test(string))
      return `<span class="info-key">${e(string.slice(0, colon))}</span>${markdown.render(string.slice(colon + 1).trim(), page.id).html}`;
    return markdown.render(string, page.id).html;
  };
  const meaningful = (value) =>
    Array.isArray(value)
      ? value.some(meaningful)
      : value && typeof value === "object"
        ? Object.values(value).some(meaningful)
        : Boolean(
            String(value ?? "")
              .replace(/^[^:]+:\s*/, "")
              .trim(),
          );
  const entries = Object.entries(page.meta).filter(
    ([key, value]) => !omitted.has(key) && meaningful(value),
  );
  if (!page.images.length && !entries.length && !page.tags.length) return "";
  return `<aside class="infobox" aria-label="${e(page.title)} bilgi kutusu">${page.images.length ? `<div class="infobox-gallery"><button class="portrait-button" data-action="lightbox" data-src="${e(markdown.asset(page.images[0].file, page.id))}" data-label="${e(page.images[0].label)}" aria-label="Görseli büyüt"><img id="info-image" src="${e(markdown.asset(page.images[0].file, page.id))}" alt="${e(page.images[0].label)}"><span>${i("maximize")}</span></button>${page.images.length > 1 ? `<div class="image-tabs" role="group" aria-label="Görsel seçimi">${page.images.map((image, index) => `<button class="${index === 0 ? "active" : ""}" data-image="${index}" title="${e(image.label)}" aria-label="${e(image.label)}" aria-pressed="${index === 0}">${e(image.label.replace(/ görünümü|Gerçek formu/g, (match) => (match === "Gerçek formu" ? "Gerçek form" : "")).replace("Overworld", "Overworld"))}</button>`).join("")}</div>` : ""}</div>` : ""}<div class="infobox-body"><div class="infobox-title">${e(page.title)}</div>${entries.map(([key, value]) => `<section class="info-section"><h3>${e(key)}</h3>${field(value)}</section>`).join("")}${page.tags.length ? `<div class="info-tags">${tagHtml(page.tags)}</div>` : ""}</div></aside>`;
}

function pageView() {
  const page = pages.get(current.id);
  if (!page) return missingView(current.id);
  recent = [page.id, ...recent.filter((id) => id !== page.id)].slice(0, 12);
  saveStore("recent", recent);
  document.title = `${page.title} — Inoraxium`;
  const rendered = markdown.render(page.body, page.id);
  const c = collection(page);
  const related = [...new Set([...page.links, ...page.backlinks])]
    .map((id) => pages.get(id))
    .filter(Boolean);
  const saved = bookmarks.includes(page.id);
  document.querySelector("#main").innerHTML =
    `<div class="reader-view ${page.type === "canvas" ? "canvas-reader" : ""}"><div class="page-breadcrumb"><a href="#/archive">Arşiv</a>${i("chevron-right")}${c ? `<a href="#/collection/${c.id}">${e(c.title)}</a>${i("chevron-right")}` : ""}<span>${e(page.title)}</span></div><header class="page-header"><div class="eyebrow">${e(c?.title || (page.type === "canvas" ? "CANVAS PANOSU" : "EVREN NOTLARI"))}</div><div class="page-heading-line"><h1>${e(page.title)}</h1><div class="page-actions"><a class="icon-button" href="${folderUrl(page.id.split("/").slice(0, -1).join("/"))}" aria-label="Bulunduğu klasörü aç" title="Bulunduğu klasörü aç">${i("folder")}</a>${access.dm ? `<button class="button-primary" data-action="permissions" data-id="${e(page.id)}">Erişim: ${e(page.access.visibility === "dm" ? "DM" : page.access.visibility === "public" ? "Public" : "Kullanıcılar")}</button>` : ""}<button class="icon-button ${saved ? "saved" : ""}" data-action="bookmark" data-id="${e(page.id)}" aria-label="${saved ? "Kaydedilenlerden çıkar" : "Sayfayı kaydet"}" aria-pressed="${saved}">${i("bookmark")}</button><button class="icon-button" data-action="copy" aria-label="Sayfanın bağlantısını kopyala">${i("link")}</button><a class="icon-button" href="#/graph?root=${encodeURIComponent(page.id)}" aria-label="Sayfanın bağlantı haritası">${i("network")}</a></div></div><div class="page-meta"><span>${i(page.type === "canvas" ? "layers" : "book-open")}${page.type === "canvas" ? `${page.canvas.nodes?.length || 0} kart` : `${Math.max(1, Math.ceil(page.words / 200))} dk okuma`}</span><span>${i("network")}${related.length} bağlantılı sayfa</span>${page.tags.length ? `<div class="page-tags">${tagHtml(page.tags)}</div>` : ""}</div></header>${
      page.type === "canvas"
        ? '<div id="board" class="board-container"></div>'
        : `<div class="reader-layout"><div class="article-column">${infobox(page)}<article class="prose" id="article">${page.body.trim() ? rendered.html : `<div class="unwritten">${i("scroll-text")}<h2>Bu hikâye henüz yazılmadı.</h2><p>Bu sayfa Inoraxium arşivinde yerini aldı. Satırları zamanla dolacak.</p></div>`}</article><div class="article-end"><span></span>✧<span></span></div></div><aside class="reader-rail"><div class="rail-sticky">${rendered.headings.length ? `<div class="rail-label">BU SAYFADA</div><nav class="toc" aria-label="İçindekiler">${rendered.headings.map((h) => `<a class="depth-${h.depth}" href="${pageUrl(page.id, h.id)}" data-heading="${e(h.id)}">${e(h.text)}</a>`).join("")}</nav>` : ""}<div class="rail-label backlinks-label">BURAYA BAĞLANANLAR <span>${page.backlinks.length}</span></div><nav class="backlink-list">${
            page.backlinks.length
              ? page.backlinks
                  .slice(0, 10)
                  .map(
                    (id) =>
                      `<a href="${pageUrl(id)}">${i("arrow-up-right")}<span>${e(pages.get(id).title)}</span></a>`,
                  )
                  .join("")
              : "<p>Henüz başka bir sayfadan bağlantı yok.</p>"
          }</nav><a class="rail-map" href="#/graph?root=${encodeURIComponent(page.id)}">${i("network")}Bağlantı haritasını aç ${i("arrow-up-right")}</a></div></aside></div>`
    }${
      related.length
        ? `<section class="related-section"><div class="section-heading"><div><div class="eyebrow">HİKÂYENİN DİĞER UÇLARI</div><h2>Bağlantılı sayfalar</h2></div><span>${related.length} sayfa</span></div><div class="related-grid">${related
            .slice(0, 8)
            .map(
              (p) =>
                `<a href="${pageUrl(p.id)}">${pageImage(p) ? `<img src="${e(pageImage(p))}" alt="" loading="lazy">` : `<span class="related-sigil">${i("book-open")}</span>`}<div><small>${e(collection(p)?.title || "EVREN NOTLARI")}</small><strong>${e(p.title)}</strong></div>${i("arrow-up-right")}</a>`,
            )
            .join("")}</div></section>`
        : ""
    }</div>`;
  if (page.type === "canvas")
    boardCleanup = mountBoard(document.querySelector("#board"), page.canvas, {
      ...markdown,
      pages,
      from: page.id,
    });
  for (const button of document.querySelectorAll("[data-image]"))
    button.addEventListener("click", () => {
      const image = page.images[Number(button.dataset.image)],
        src = markdown.asset(image.file, page.id);
      document.querySelector("#info-image").src = src;
      document.querySelector("#info-image").alt = image.label;
      const portrait = document.querySelector(".portrait-button");
      portrait.dataset.src = src;
      portrait.dataset.label = image.label;
      for (const other of document.querySelectorAll("[data-image]")) {
        other.classList.toggle("active", other === button);
        other.setAttribute("aria-pressed", String(other === button));
      }
    });
  const articleHeadings = document.querySelectorAll(
    "#article > h1, #article > h2, #article > h3, #article > h4",
  );
  if (articleHeadings.length) {
    tocObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];
        if (!visible) return;
        for (const anchor of document.querySelectorAll(".toc a"))
          anchor.classList.toggle(
            "active",
            anchor.dataset.heading === visible.target.id,
          );
      },
      { rootMargin: "-90px 0px -65% 0px" },
    );
    articleHeadings.forEach((h) => tocObserver.observe(h));
  }
}

function graphView() {
  const root = pages.get(current.query.get("root"));
  const items = root
    ? [
        root,
        ...[...new Set([...root.links, ...root.backlinks])]
          .map((id) => pages.get(id))
          .filter(Boolean),
      ]
    : data.pages;
  document.querySelector("#main").innerHTML =
    `<div class="graph-view"><div class="view-intro"><div class="eyebrow">İPLİKLERİN İZİNİ SÜR</div><h1>${root ? e(root.title) : "Her şey birbirine bağlı."}</h1><p>${root ? "Bu sayfaya gelen ve bu sayfadan çıkan bağlantılar." : "Bir hikâyeden diğerine uzanan bağlar. Bir isme tıkla, hikâyesine geç."}</p></div><div class="graph-toolbar"><span><b>${items.length}</b> sayfa · <b>${root ? items.filter((p) => p.id !== root.id).length : data.stats.links}</b> bağ</span>${root ? '<a class="text-link" href="#/graph">Bütün harita ↗</a>' : `<div class="graph-legend">${data.config.collections.map((c, j) => `<span style="--dot:${["#c9ad7b", "#ad88b8", "#7ea999", "#849bc4"][j]}">${e(c.title)}</span>`).join("")}</div>`}</div><div id="board" class="board-container graph-board"></div></div>`;
  const groups = root
    ? [{ id: "all" }]
    : [...data.config.collections, { id: "other" }];
  const nodes = [];
  const colors = ["#c9ad7b", "#ad88b8", "#7ea999", "#849bc4", "#8994a7"];
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    const group = groups[groupIndex],
      members = root ? items : items.filter((p) => p.collection === group.id);
    const centerX = root
      ? 0
      : Math.cos((groupIndex * Math.PI * 2) / groups.length - Math.PI / 2) *
        1150;
    const centerY = root
      ? 0
      : Math.sin((groupIndex * Math.PI * 2) / groups.length - Math.PI / 2) *
        1000;
    members.forEach((page, j) => {
      const angle =
        (j * Math.PI * 2) / Math.max(1, members.length - (root ? 1 : 0));
      const radius = root && j === 0 ? 0 : Math.max(380, members.length * 42);
      nodes.push({
        id: page.id,
        type: "text",
        text: `[[${page.id}|${page.title}]]\n\n${page.links.length} giden · ${page.backlinks.length} gelen`,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        width: 235,
        height: 100,
        color: colors[groupIndex],
      });
    });
  }
  const ids = new Set(items.map((p) => p.id));
  const edges = items.flatMap((p) =>
    p.links
      .filter(
        (id) => ids.has(id) && (!root || p.id === root.id || id === root.id),
      )
      .map((id) => ({ fromNode: p.id, toNode: id, color: "#475361" })),
  );
  boardCleanup = mountBoard(
    document.querySelector("#board"),
    { nodes, edges },
    { ...markdown, pages },
  );
}

function missingView(id) {
  document.querySelector("#main").innerHTML =
    `<div class="empty-state missing-view">${i("compass")}<div class="eyebrow">HENÜZ KEŞFEDİLMEMİŞ</div><h1>${e(
      id
        .replace(/\.(md|canvas)$/, "")
        .split("/")
        .pop() || "Sayfa bulunamadı",
    )}</h1><p>Bu bağlantının karşılığı kaynak vault içinde bulunmuyor.<br>Hikâye eklendiğinde bir sonraki yayında burada görünecek.</p><a class="button-primary" href="#/archive">Arşive dön ${i("arrow-right")}</a></div>`;
}

function scrollSection() {
  const section = current.query.get("section");
  if (section)
    requestAnimationFrame(() =>
      (
        document.getElementById(section) ||
        document.getElementById(headingId(section))
      )?.scrollIntoView({ block: "start" }),
    );
}
function navigate() {
  const next = route();
  if (
    current?.view === "page" &&
    next.view === "page" &&
    current.id === next.id
  ) {
    current = next;
    scrollSection();
    return;
  }
  boardCleanup?.();
  boardCleanup = null;
  tocObserver?.disconnect();
  closeDialog();
  document.querySelector(".hover-preview")?.remove();
  current = next;
  document.body.classList.remove("menu-open");
  document.title = "Inoraxium — Evrenin Atlası";
  shell();
  const bar = document.querySelector(".topbar-actions");
  bar.insertAdjacentHTML(
    "afterbegin",
    `<span class="auth-label">${access.user ? e(access.user.displayName || access.user.email) + (access.dm ? " · DM" : "") : ""}</span><button class="auth-button" data-action="${access.user ? "logout" : "login"}" ${!access.configured ? "disabled" : ""}>${access.user ? "Çıkış yap" : "Google ile giriş"}</button>`,
  );
  if (access.loading || access.error || !data.pages.length) {
    document.querySelector("#main").innerHTML =
      `<div class="empty-state"><h1>${access.loading ? "Atlas yükleniyor…" : access.error ? "Bağlantı kurulamadı" : "Henüz görüntüleyebileceğin bir sayfa yok."}</h1><p>${access.error ? "Firebase bağlantısını kontrol edip sayfayı yenile. Kod: " + e(access.error) : !access.configured ? "Firebase bağlantısı henüz yapılandırılmadı." : access.loading ? "Erişim izinleri kontrol ediliyor." : "DM tarafından sana açılan veya Public olarak paylaşılan sayfalar burada görünecek."}</p></div>`;
  } else if (next.view === "home") home();
  else if (next.view === "page") pageView();
  else if (next.view === "files")
    mountExplorer(document.querySelector("#main"), data.pages, {
      path: next.id,
      icon: i,
      refreshIcons: icons,
    });
  else if (
    ["archive", "collection", "tag", "canvases", "bookmarks"].includes(
      next.view,
    )
  )
    listView();
  else if (next.view === "graph") graphView();
  else missingView(next.id);
  icons();
  window.scrollTo(0, 0);
  scrollSection();
}

let dialogTrigger;
function closeDialog() {
  const dialog = document.querySelector("dialog");
  if (dialog) {
    dialog.close();
    dialog.remove();
    dialogTrigger?.focus();
  }
}
function openDialog(content, className = "") {
  closeDialog();
  dialogTrigger = document.activeElement;
  const dialog = document.createElement("dialog");
  dialog.className = className;
  dialog.innerHTML = content;
  document.querySelector("#overlays").append(dialog);
  dialog.showModal();
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog || event.target.closest("[data-close]"))
      closeDialog();
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialog();
  });
  icons();
  return dialog;
}
function openSearch() {
  const dialog = openDialog(
    `<div class="search-top">${i("search")}<input id="global-search" type="search" placeholder="Bir isim, bir hikâye, bir diyar…" aria-label="Atlas içinde ara" autocomplete="off"><button data-close aria-label="Aramayı kapat"><kbd>ESC</kbd></button></div><div class="search-caption" aria-live="polite"></div><div class="search-results" role="listbox" aria-label="Arama sonuçları"></div><div class="search-footer"><span>↑ ↓ gezin <span>↵ aç</span></span><span>INORAXIUM ARŞİVİ</span></div>`,
    "search-dialog",
  );
  const input = dialog.querySelector("input"),
    results = dialog.querySelector(".search-results"),
    caption = dialog.querySelector(".search-caption");
  let matches = [],
    selected = 0;
  const updateSelection = () => {
    results.querySelectorAll("a").forEach((anchor, j) => {
      anchor.classList.toggle("selected", j === selected);
      anchor.setAttribute("aria-selected", String(j === selected));
    });
    const anchor = results.children[selected];
    if (anchor) {
      input.setAttribute("aria-activedescendant", anchor.id);
      anchor.scrollIntoView({ block: "nearest" });
    }
  };
  const update = () => {
    const query = fold(input.value.trim());
    matches = query
      ? data.pages
          .map((page) => {
            const title = fold(page.title),
              haystack = fold(`${page.tags.join(" ")} ${page.search}`);
            return {
              page,
              score:
                title === query
                  ? 100
                  : title.startsWith(query)
                    ? 80
                    : title.includes(query)
                      ? 60
                      : haystack.includes(query)
                        ? 20
                        : 0,
            };
          })
          .filter((result) => result.score)
          .sort(
            (a, b) =>
              b.score - a.score || a.page.title.localeCompare(b.page.title),
          )
          .map((result) => result.page)
      : [...new Set([...recent, ...data.config.featured])]
          .map((id) => pages.get(id))
          .filter(Boolean);
    selected = 0;
    caption.textContent = query
      ? `${matches.length} sayfa bulundu`
      : "YOLCULUĞUNA BAŞLA";
    results.innerHTML =
      matches
        .slice(0, 30)
        .map(
          (page, j) =>
            `<a id="search-result-${j}" role="option" href="${pageUrl(page.id)}">${pageImage(page) ? `<img src="${e(pageImage(page))}" alt="">` : `<span class="search-icon">${i(page.type === "canvas" ? "layers" : "book-open")}</span>`}<div><strong>${e(page.title)}</strong><p>${e(query ? snippet(page.search, input.value) : collection(page)?.title || "Evren notları")}</p></div>${i("arrow-up-right")}</a>`,
        )
        .join("") ||
      '<div class="search-empty">Bu isimde bir iz bulamadık. Başka bir kelime dene.</div>';
    icons();
    updateSelection();
  };
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-controls", "search-results");
  input.setAttribute("aria-expanded", "true");
  input.setAttribute("aria-autocomplete", "list");
  results.id = "search-results";
  input.addEventListener("input", update);
  input.addEventListener("keydown", (event) => {
    if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      selected = Math.min(
        Math.min(matches.length, 30) - 1,
        Math.max(0, selected + (event.key === "ArrowDown" ? 1 : -1)),
      );
      updateSelection();
    } else if (event.key === "Enter" && matches[selected]) {
      const url = pageUrl(matches[selected].id);
      closeDialog();
      location.hash = url;
    }
  });
  results.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeDialog();
  });
  update();
  input.focus();
}
function snippet(text, query) {
  const index = fold(text).indexOf(fold(query.trim()));
  const start = Math.max(0, index - 35);
  return `${start ? "…" : ""}${text.slice(start, start + 100)}${text.length > start + 100 ? "…" : ""}`;
}

document.addEventListener("click", async (event) => {
  const skip = event.target.closest(".skip-link");
  if (skip) {
    event.preventDefault();
    document.querySelector("#main")?.focus();
    return;
  }
  const localAnchor = event.target.closest('.prose a[href^="#"]');
  if (localAnchor && !localAnchor.getAttribute("href").startsWith("#/")) {
    const target = document.getElementById(
      localAnchor.getAttribute("href").slice(1),
    );
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ block: "start" });
      return;
    }
  }
  if (event.target.closest(".missing-link")) {
    event.preventDefault();
    notify("Bu sayfa mevcut değil veya görüntüleme iznin yok.");
    return;
  }
  const button = event.target.closest("[data-action]");
  if (!button) {
    const spoiler = event.target.closest(".spoiler");
    if (spoiler) {
      const shown = spoiler.getAttribute("aria-expanded") === "true";
      spoiler.setAttribute("aria-expanded", String(!shown));
      spoiler.setAttribute(
        "aria-label",
        shown ? "Gizli metni göster" : "Metni gizle",
      );
    }
    const image = event.target.closest(".prose .content-image");
    if (image)
      openDialog(
        `<button class="lightbox-close icon-button" data-close aria-label="Görseli kapat">${i("x")}</button><img src="${e(image.src)}" alt="${e(image.alt)}"><p>${e(image.alt)}</p>`,
        "lightbox-dialog",
      );
    return;
  }
  const action = button.dataset.action;
  if (action === "login" || action === "logout") {
    try {
      if (action === "login") await login();
      else await logout();
    } catch (error) {
      notify("Giriş işlemi tamamlanamadı: " + error.code);
    }
    return;
  }
  if (action === "permissions") {
    await permissionDialog(pages.get(button.dataset.id));
    return;
  }
  if (action === "search") openSearch();
  else if (action === "menu") document.body.classList.toggle("menu-open");
  else if (action === "close-menu") document.body.classList.remove("menu-open");
  else if (action === "theme") {
    const theme =
      document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    saveStore("theme", theme);
    button.innerHTML = i(theme === "light" ? "moon" : "sun");
    icons();
  } else if (action === "random") {
    const candidates = data.pages.filter(
      (p) => p.body.trim() && p.id !== current.id,
    );
    if (candidates.length)
      location.hash = pageUrl(
        candidates[Math.floor(Math.random() * candidates.length)].id,
      );
  } else if (action === "bookmark") {
    const id = button.dataset.id,
      exists = bookmarks.includes(id);
    bookmarks = exists ? bookmarks.filter((p) => p !== id) : [...bookmarks, id];
    saveStore("bookmarks", bookmarks);
    button.classList.toggle("saved", !exists);
    button.setAttribute("aria-pressed", String(!exists));
    button.setAttribute(
      "aria-label",
      exists ? "Sayfayı kaydet" : "Kaydedilenlerden çıkar",
    );
    document.querySelector("#bookmark-count").textContent = bookmarks.length;
    notify(exists ? "Sayfa kaydedilenlerden çıkarıldı." : "Sayfa kaydedildi.");
  } else if (action === "copy") {
    try {
      await navigator.clipboard.writeText(location.href);
      notify("Bağlantı kopyalandı.");
    } catch {
      openDialog(
        `<div class="copy-dialog"><h2>Sayfanın bağlantısı</h2><input readonly value="${e(location.href)}" aria-label="Kopyalanacak bağlantı"><button class="button-primary" data-close>Kapat</button></div>`,
      );
      const input = document.querySelector(".copy-dialog input");
      input.select();
    }
  } else if (action === "lightbox")
    openDialog(
      `<button class="lightbox-close icon-button" data-close aria-label="Görseli kapat">${i("x")}</button><img src="${e(button.dataset.src)}" alt="${e(button.dataset.label)}"><p>${e(button.dataset.label)}</p>`,
      "lightbox-dialog",
    );
});
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    if (data) openSearch();
  }
  if (event.key === "Escape") document.body.classList.remove("menu-open");
});

let hoverTimer;
document.addEventListener("pointerover", (event) => {
  const anchor = event.target.closest("a[data-page]");
  if (
    !anchor ||
    !window.matchMedia("(hover:hover)").matches ||
    anchor.closest(".board-container") ||
    anchor.contains(event.relatedTarget)
  )
    return;
  const page = pages?.get(anchor.dataset.page);
  if (!page) return;
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => {
    if (!anchor.isConnected) return;
    document.querySelector(".hover-preview")?.remove();
    const preview = document.createElement("div");
    preview.className = "hover-preview";
    preview.setAttribute("role", "tooltip");
    preview.innerHTML = `${pageImage(page) ? `<img src="${e(pageImage(page))}" alt="">` : ""}<div><small>${e(collection(page)?.title || "EVREN NOTLARI")}</small><strong>${e(page.title)}</strong><p>${e(page.excerpt || "Hikâyesi henüz yazılmadı.")}</p></div>`;
    document.body.append(preview);
    const rect = anchor.getBoundingClientRect();
    preview.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - 332))}px`;
    preview.style.top = `${Math.max(12, Math.min(rect.bottom + 10, innerHeight - preview.offsetHeight - 12))}px`;
  }, 450);
});
document.addEventListener("pointerout", (event) => {
  const anchor = event.target.closest("a[data-page]");
  if (anchor && !anchor.contains(event.relatedTarget)) {
    clearTimeout(hoverTimer);
    document.querySelector(".hover-preview")?.remove();
  }
});
window.addEventListener("hashchange", () => {
  if (data) navigate();
});
window.addEventListener(
  "scroll",
  () => document.querySelector(".hover-preview")?.remove(),
  { passive: true },
);

async function permissionDialog(page) {
  if (!access.dm || !page) return;
  try {
    const users = await registeredUsers();
    if (!access.dm) return;
    const dialog = openDialog(
      `<form class="permission-form"><div class="eyebrow">DM · SAYFA ERİŞİMİ</div><h2>${e(page.title)}</h2><label>Görünürlük<select name="visibility"><option value="dm">DM — Yalnızca DM</option><option value="public">Public — Herkes</option><option value="users">Seçili kullanıcılar ve DM</option></select></label><fieldset><legend>Kayıtlı kullanıcılar</legend>${users.map((user) => `<label class="user-choice"><input type="checkbox" name="reader" value="${e(user.uid)}" ${page.access.readerUids.includes(user.uid) ? "checked" : ""}><span>${e(user.displayName)}<small>${e(user.email)}</small></span></label>`).join("") || "<p>Oyuncular ilk Google girişlerinden sonra burada görünür.</p>"}</fieldset><p>Yeni sayfalar daima DM olarak eklenir. Gömmeler, bağlı sayfalara erişim vermez.</p><div role="status" class="permission-status"></div><div class="permission-actions"><button type="button" data-close>Vazgeç</button><button type="submit" class="button-primary">Kaydet</button></div></form>`,
      "permission-dialog",
    );
    const form = dialog.querySelector("form"),
      select = form.elements.visibility,
      fieldset = form.querySelector("fieldset");
    select.value = page.access.visibility;
    const refresh = () => {
      fieldset.disabled = select.value !== "users";
    };
    select.addEventListener("change", refresh);
    refresh();
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submit = form.querySelector("[type=submit]");
      submit.disabled = true;
      try {
        await saveAccess(
          page.access.key,
          select.value,
          [...form.querySelectorAll("[name=reader]:checked")].map(
            (el) => el.value,
          ),
        );
        closeDialog();
        notify("Erişim ayarları güncellendi.");
      } catch (error) {
        form.querySelector(".permission-status").textContent =
          "Kaydedilemedi: " + error.code;
        submit.disabled = false;
      }
    });
  } catch (error) {
    notify("Kullanıcı listesi alınamadı: " + error.code);
  }
}
try {
  const response = await fetch(`${import.meta.env.BASE_URL}shell.json`);
  if (!response.ok) throw new Error("Shell could not be loaded");
  const config = await response.json();
  connectAccess(config, (atlas) => {
    data = atlas;
    pages = new Map(data.pages.map((page) => [page.id, page]));
    markdown = createMarkdown(data);
    current = null;
    navigate();
  });
} catch (error) {
  console.error(error);
  app.innerHTML =
    '<div class="boot error"><h1>Atlas açılamadı.</h1><p>Sayfayı yenileyerek tekrar dene.</p></div>';
}
