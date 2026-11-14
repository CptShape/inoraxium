import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://example.com/inoraxium/",
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.ResizeObserver = class {
  observe() {}
  disconnect() {}
};
globalThis.requestAnimationFrame = (fn) => fn();
const { createMarkdown, pageUrl } = await import("../src/markdown.js");
const { mountBoard } = await import("../src/canvas.js");
const data = {
  files: [
    "Gods/Zeus.md",
    "Gods/Hera.md",
    "images/portrait.png",
    "World.canvas",
  ],
  pages: [
    {
      id: "Gods/Zeus.md",
      title: "Zeus",
      type: "page",
      meta: {},
      images: [],
      body: "# Bio\nHello [[Hera]].\n\n## Family\nFamily paragraph.\n\n## Powers\nThunder.",
    },
    {
      id: "Gods/Hera.md",
      title: "Hera",
      type: "page",
      meta: {},
      images: [],
      body: "# Queen\n![[Zeus]]",
    },
    {
      id: "World.canvas",
      title: "World",
      type: "canvas",
      meta: {},
      images: [],
      body: "",
    },
  ],
  assets: {
    "images/portrait.png": {
      src: "vault/media/portrait.webp",
      thumb: "vault/media/portrait-thumb.webp",
    },
  },
};
const md = createMarkdown(data);
test('authenticated blob image URLs survive sanitization without allowing scripts', () => {
  const protectedData = {...data, assets: {'images/portrait.png': {src:'blob:https://example.com/authorized',thumb:'blob:https://example.com/thumb'}}};
  const html = createMarkdown(protectedData).render('![[portrait.png]]', 'Gods/Zeus.md').html;
  assert.ok(html.includes('src="blob:https://example.com/authorized"'));
});

test("wiki aliases and heading links keep Pages-safe URLs", () => {
  const { html } = md.render(
    "[[Zeus#Bio|The king]] / [[#Family]] / [[Missing]]",
    "Gods/Hera.md",
  );
  const root = document.createElement("div");
  root.innerHTML = html;
  const links = [...root.querySelectorAll("a")];
  assert.equal(links[0].getAttribute("href"), pageUrl("Gods/Zeus.md", "Bio"));
  assert.equal(links[0].textContent, "The king");
  assert.equal(
    links[1].getAttribute("href"),
    pageUrl("Gods/Hera.md", "Family"),
  );
  assert.equal(links[2].className, "missing-link");
});

test("embeds resolve images and sections while circular references stop", () => {
  const html = md.render(
    "![[portrait.png|300]]\n\n![[Zeus#Family]]",
    "World.canvas",
  ).html;
  const root = document.createElement("div");
  root.innerHTML = html;
  assert.equal(
    root.querySelector("img").getAttribute("src"),
    "vault/media/portrait.webp",
  );
  assert.equal(root.querySelector("img").getAttribute("width"), "300");
  assert.ok(html.includes("Family paragraph."));
  assert.ok(!html.includes("Thunder."));
  const circular = md.render("![[Hera]]", "Gods/Zeus.md").html;
  assert.ok(circular.length < 5000);
});

test("duplicate headings get distinct anchors, spoilers and footnotes render", () => {
  const { html, headings } = md.render(
    "# Bio\n\n# Bio\n\n||secret||\n\nA note[^1].\n\n[^1]: note text",
    "Gods/Zeus.md",
  );
  assert.deepEqual(
    headings.map((h) => h.id),
    ["bio", "bio-1"],
  );
  assert.ok(html.includes('class="spoiler"'));
  assert.ok(html.includes('aria-expanded="false"'));
  assert.ok(html.includes("footnotes"));
});

test("untrusted HTML and unsafe link protocols cannot execute", () => {
  const html = md.render(
    '<script>alert(1)</script><img src="x" onerror="alert(1)"><iframe src="https://evil.test"></iframe>\n\n[click](javascript:alert%281%29)\n\n<a href="javascript:alert(1)">bad</a>',
  ).html;
  assert.ok(!html.includes("<script"));
  assert.ok(!html.includes("onerror"));
  assert.ok(!html.includes("<iframe"));
  assert.ok(!html.includes("javascript:"));
});

test("raw HTML vault paths resolve like Markdown paths", () => {
  const html = md.render(
    '<img src="portrait.png" alt="portrait"><a href="Hera.md">Queen</a>',
    "Gods/Zeus.md",
  ).html;
  assert.ok(html.includes('src="vault/media/portrait.webp"'));
  assert.ok(html.includes(pageUrl("Gods/Hera.md")));
});

test("canvas renders cards, groups, escaped labels and directed edges with working controls", () => {
  const element = document.createElement("div");
  document.body.append(element);
  const canvas = {
    nodes: [
      {
        id: "group",
        type: "group",
        label: "<img onerror=x>",
        x: -100,
        y: -100,
        width: 800,
        height: 500,
        color: "3",
      },
      {
        id: "a",
        type: "text",
        text: "[[Zeus]]",
        x: 0,
        y: 0,
        width: 250,
        height: 200,
      },
      {
        id: "b",
        type: "file",
        file: "Gods/Hera.md",
        x: 400,
        y: 0,
        width: 250,
        height: 250,
      },
      {
        id: "c",
        type: "file",
        file: "images/portrait.png",
        x: 0,
        y: 350,
        width: 250,
        height: 400,
      },
      {
        id: "d",
        type: "link",
        url: "javascript:alert(1)",
        x: 400,
        y: 350,
        width: 250,
        height: 200,
      },
    ],
    edges: [
      {
        fromNode: "a",
        toNode: "b",
        label: "Family",
        fromSide: "right",
        toSide: "left",
        fromEnd: "arrow",
        toEnd: "arrow",
        color: "3",
      },
    ],
  };
  const before = JSON.stringify(canvas);
  const cleanup = mountBoard(element, canvas, {
    ...md,
    pages: new Map(data.pages.map((p) => [p.id, p])),
    from: "World.canvas",
  });
  assert.equal(element.querySelectorAll(".board-node").length, 5);
  assert.equal(element.querySelectorAll(".board-page-title").length, 1);
  assert.equal(
    element.querySelector(".board-image").getAttribute("src"),
    "vault/media/portrait.webp",
  );
  assert.equal(
    element.querySelector(".group-label").textContent,
    "<img onerror=x>",
  );
  assert.equal(
    element.querySelector(".board-edge>path").getAttribute("d"),
    "M250 100 L400 125",
  );
  assert.equal(
    element.querySelector(".board-edge>path").getAttribute("marker-end"),
    "url(#arrow-end)",
  );
  assert.equal(element.querySelectorAll('a[href^="javascript"]').length, 0);
  const scale = element.querySelector("output").textContent;
  element.querySelector('[data-board="in"]').click();
  assert.notEqual(element.querySelector("output").textContent, scale);
  assert.equal(
    JSON.stringify(canvas),
    before,
    "viewer must not mutate canvas data",
  );
  cleanup();
  element.remove();
});

test("every generated real page renders, every declared asset exists, and all resolved graph edges are reciprocal", async (t) => {
  const manifestFile = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../.private-build/vault/index.json",
  );
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      t.skip("Run npm run build first to include generated-vault checks.");
      return;
    }
    throw error;
  }
  const renderer = createMarkdown(manifest);
  const pageMap = new Map(manifest.pages.map((p) => [p.id, p]));
  for (const page of manifest.pages) {
    const { html } = renderer.render(page.body, page.id);
    assert.ok(typeof html === "string", page.id);
    for (const target of page.links)
      assert.ok(
        pageMap.get(target)?.backlinks.includes(page.id),
        `${page.id} → ${target}`,
      );
    for (const image of page.images)
      assert.ok(manifest.assets[image.file], `${page.id}: ${image.file}`);
  }
  assert.equal(
    manifest.pages.some((p) => p.id === "README.md"),
    false,
  );
  for (const asset of Object.values(manifest.assets))
    for (const file of [asset.src, asset.thumb])
      await readFile(path.resolve(path.dirname(manifestFile), "..", file));
  assert.ok(!manifest.warnings.some((w) => w.kind === "image"));
});

test("public hash image URLs work in wiki and HTML images", () => {
 const url = `media/${"c".repeat(32)}.webp`;
 const renderer = createMarkdown({...data, assets: {"images/portrait.png": {src:url,thumb:url}}});
 for (const source of ["![[portrait.png]]", '<img src="portrait.png">']) assert.ok(renderer.render(source,"Gods/Zeus.md").html.includes(`src="${url}"`));
});
