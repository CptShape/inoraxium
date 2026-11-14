import { escapeHtml as e, pageUrl, safeExternal } from "./markdown.js";

const palette = {
  1: "#d97878",
  2: "#d9a06a",
  3: "#d3ba72",
  4: "#83b59b",
  5: "#7abacb",
  6: "#ab91cb",
};
const color = (value) =>
  palette[value] || (/^#[0-9a-f]{6}$/i.test(value || "") ? value : "#8994a7");
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
export function mountBoard(
  element,
  { nodes = [], edges = [] },
  { render, asset, resolve, pages, from = "" },
) {
  let disposed = false;
  const safeNodes = nodes.map((node) => ({
    ...node,
    x: num(node.x),
    y: num(node.y),
    width: Math.max(80, num(node.width)),
    height: Math.max(60, num(node.height)),
  }));
  const nodeMap = new Map(safeNodes.map((node) => [node.id, node]));
  const point = (node, side) =>
    side === "top"
      ? [node.x + node.width / 2, node.y]
      : side === "bottom"
        ? [node.x + node.width / 2, node.y + node.height]
        : side === "left"
          ? [node.x, node.y + node.height / 2]
          : [node.x + node.width, node.y + node.height / 2];
  const edgeHtml = edges
    .map((edge) => {
      const a = nodeMap.get(edge.fromNode),
        b = nodeMap.get(edge.toNode);
      if (!a || !b) return "";
      const [x1, y1] = point(a, edge.fromSide || "right"),
        [x2, y2] = point(b, edge.toSide || "left");
      return `<g class="board-edge" style="color:${color(edge.color)}"><path d="M${x1} ${y1} L${x2} ${y2}" ${edge.fromEnd === "arrow" ? 'marker-start="url(#arrow-start)"' : ""} ${edge.toEnd !== "none" ? 'marker-end="url(#arrow-end)"' : ""}/>${edge.label ? `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 10}" text-anchor="middle">${e(edge.label)}</text>` : ""}</g>`;
    })
    .join("");
  const nodeHtml = safeNodes
    .map((node) => {
      let content = "";
      if (node.type === "text")
        content = `<div class="prose">${render(node.text || "", from).html}</div>`;
      else if (node.type === "file") {
        const id = resolve(node.file, from),
          page = pages.get(id),
          src = asset(node.file, from);
        if (page)
          content = `<a class="board-page-title" data-page="${e(id)}" href="${pageUrl(id, node.subpath?.replace(/^#/, "") || "")}">${e(page.title)} ↗</a><div class="prose">${page.images[0] ? `<img class="board-portrait" src="${e(asset(page.images[0].file, id, true))}" alt="${e(page.title)}">` : ""}${render(page.body, id, 2).html}</div>`;
        else if (src && /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(node.file))
          content = `<img class="board-image" src="${e(src)}" alt="${e(node.file)}" draggable="false">`;
        else if (src && /\.(mp4|webm)$/i.test(node.file))
          content = `<video controls src="${e(src)}"></video>`;
        else if (src)
          content = `<a href="${e(src)}" target="_blank" rel="noopener">${e(node.file)} ↗</a>`;
        else
          content = `<span class="missing-media">Dosya bulunamadı: ${e(node.file)}</span>`;
      } else if (node.type === "link") {
        const url = safeExternal(node.url);
        content = url
          ? `<div class="board-link"><span>DIŞ BAĞLANTI</span><a href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(node.url)} ↗</a></div>`
          : "<p>Bağlantı kullanılamıyor.</p>";
      } else if (node.type === "group") {
        const background = node.background && asset(node.background, from);
        content = `${background ? `<img class="board-background ${["cover", "ratio", "repeat"].includes(node.backgroundStyle) ? node.backgroundStyle : "cover"}" src="${e(background)}" alt="">` : ""}<span class="group-label">${e(node.label || "")}</span>`;
      }
      return `<section class="board-node ${node.type === "group" ? "board-group" : ""}" aria-label="${e(node.label || node.file || "Canvas kartı")}" style="left:${node.x}px;top:${node.y}px;width:${node.width}px;height:${node.height}px;--node-color:${color(node.color)}">${content}</section>`;
    })
    .join("");
  element.innerHTML = `<div class="board-viewport" tabindex="0" aria-label="Canvas. Kaydırarak yakınlaştırın, boş alanı sürükleyerek gezinin. Artı ve eksi tuşlarıyla yakınlaştırın, 0 ile sığdırın."><div class="board-world"><svg class="board-lines"><defs><marker id="arrow-end" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="context-stroke"/></marker><marker id="arrow-start" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M10 0L0 5L10 10Z" fill="context-stroke"/></marker></defs>${edgeHtml}</svg>${nodeHtml}</div>${!nodes.length ? '<div class="board-empty">Bu canvas henüz boş.</div>' : ""}</div><div class="board-controls"><button data-board="out" aria-label="Uzaklaştır">−</button><output class="board-scale">100%</output><button data-board="in" aria-label="Yakınlaştır">+</button><span></span><button data-board="fit" aria-label="Tümünü sığdır">⤢</button></div><div class="board-hint">SÜRÜKLE · KEŞFET · YAKINLAŞTIR</div>`;
  const viewport = element.querySelector(".board-viewport"),
    world = element.querySelector(".board-world"),
    output = element.querySelector("output");
  let x = 0,
    y = 0,
    scale = 1;
  const update = () => {
    world.style.transform = `translate(${x}px,${y}px) scale(${scale})`;
    output.textContent = `${Math.round(scale * 100)}%`;
  };
  const zoom = (
    factor,
    cx = viewport.clientWidth / 2,
    cy = viewport.clientHeight / 2,
  ) => {
    const next = Math.min(2.5, Math.max(0.08, scale * factor));
    x = cx - ((cx - x) * next) / scale;
    y = cy - ((cy - y) * next) / scale;
    scale = next;
    update();
  };
  const fit = () => {
    if (!safeNodes.length) return;
    const minX = Math.min(...safeNodes.map((n) => n.x)),
      minY = Math.min(...safeNodes.map((n) => n.y));
    const maxX = Math.max(...safeNodes.map((n) => n.x + n.width)),
      maxY = Math.max(...safeNodes.map((n) => n.y + n.height));
    scale = Math.min(
      1.1,
      Math.max(
        0.08,
        Math.min(
          (viewport.clientWidth - 100) / (maxX - minX),
          (viewport.clientHeight - 100) / (maxY - minY),
        ),
      ),
    );
    x = (viewport.clientWidth - (maxX - minX) * scale) / 2 - minX * scale;
    y = (viewport.clientHeight - (maxY - minY) * scale) / 2 - minY * scale;
    update();
  };
  viewport.addEventListener(
    "wheel",
    (event) => {
      // Let readers scroll long cards without moving the whole board.
      if (
        event.target.closest(".board-node") &&
        !event.ctrlKey &&
        !event.metaKey
      )
        return;
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      zoom(
        Math.exp(-event.deltaY * 0.0015),
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
    },
    { passive: false },
  );
  const pointers = new Map();
  let pinch = null;
  viewport.addEventListener("pointerdown", (event) => {
    if (
      event.target.closest("a,button,video,audio") ||
      (event.target.closest(".board-node") && event.pointerType !== "touch")
    )
      return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add("is-panning");
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });
  viewport.addEventListener("pointermove", (event) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()],
        distance = Math.hypot(a.x - b.x, a.y - b.y),
        rect = viewport.getBoundingClientRect();
      if (pinch)
        zoom(
          distance / pinch,
          (a.x + b.x) / 2 - rect.left,
          (a.y + b.y) / 2 - rect.top,
        );
      pinch = distance;
    } else {
      x += event.clientX - previous.x;
      y += event.clientY - previous.y;
      update();
    }
  });
  for (const eventName of ["pointerup", "pointercancel"])
    viewport.addEventListener(eventName, (event) => {
      pointers.delete(event.pointerId);
      pinch = null;
      if (!pointers.size) viewport.classList.remove("is-panning");
    });
  element
    .querySelector(".board-controls")
    .addEventListener("click", (event) => {
      const action = event.target.closest("button")?.dataset.board;
      if (action === "fit") fit();
      else if (action) zoom(action === "in" ? 1.25 : 0.8);
    });
  viewport.addEventListener("keydown", (event) => {
    if (event.target.closest(".board-node")) return;
    if (event.key === "+" || event.key === "=") zoom(1.2);
    else if (event.key === "-") zoom(0.8);
    else if (event.key === "0") fit();
    else if (event.key.startsWith("Arrow")) {
      event.preventDefault();
      x +=
        event.key === "ArrowLeft" ? 50 : event.key === "ArrowRight" ? -50 : 0;
      y += event.key === "ArrowUp" ? 50 : event.key === "ArrowDown" ? -50 : 0;
      update();
    }
  });
  const observer = new ResizeObserver(() => {
    if (!disposed) fit();
  });
  observer.observe(viewport);
  requestAnimationFrame(fit);
  return () => {
    disposed = true;
    observer.disconnect();
  };
}
