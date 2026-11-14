import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { marked } from "marked";
import {
  parseMarkdown,
  plainText,
  titleFromPath,
  wikiTargets,
} from "../lib/content.mjs";
import { createResolver } from "../lib/resolve.mjs";

export const vaultRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const output = path.join(vaultRoot, "_site/public/vault");
const cache = path.join(vaultRoot, "_site/.image-cache");
const mediaExt = /\.(png|jpe?g|webp|gif|svg|avif|pdf|mp3|mp4|ogg|wav|webm)$/i;
const stringLeaves = (value) =>
  typeof value === "string"
    ? [value]
    : value && typeof value === "object"
      ? Object.values(value).flatMap(stringLeaves)
      : [];

export async function buildVault() {
  const config = JSON.parse(
    await fs.readFile(path.join(vaultRoot, "_site/site.config.json"), "utf8"),
  );
  const files = [];
  async function walk(directory, prefix = "") {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (
        entry.name.startsWith(".") ||
        entry.name.startsWith("_") ||
        ["node_modules", "dist", "test-results", "playwright-report"].includes(
          entry.name,
        )
      )
        continue;
      const relative = `${prefix}${entry.name}`;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory())
        await walk(path.join(directory, entry.name), `${relative}/`);
      else if (/\.(md|canvas)$/i.test(relative) || mediaExt.test(relative))
        files.push(relative);
    }
  }
  await walk(vaultRoot);
  files.sort();
  const pages = [];
  for (const id of files.filter(
    (file) =>
      /\.(md|canvas)$/i.test(file) &&
      !config.exclude.some(
        (folder) => file === folder || file.startsWith(`${folder}/`),
      ),
  )) {
    const source = await fs.readFile(path.join(vaultRoot, id), "utf8");
    const type = /\.canvas$/i.test(id) ? "canvas" : "page";
    const parsed =
      type === "page" ? parseMarkdown(source, id) : { meta: {}, body: "" };
    const canvas = type === "canvas" ? JSON.parse(source) : null;
    if (
      canvas &&
      ((!Array.isArray(canvas.nodes) && canvas.nodes !== undefined) ||
        (!Array.isArray(canvas.edges) && canvas.edges !== undefined))
    )
      throw new Error(`Invalid canvas: ${id}`);
    const tags = (
      Array.isArray(parsed.meta.tags)
        ? parsed.meta.tags
        : String(parsed.meta.tags || "").split(",")
    )
      .map(String)
      .map((t) => t.trim())
      .filter((t) => t && !["add", "your", "tags"].includes(t));
    const text = plainText(parsed.body);
    pages.push({
      id,
      type,
      title: String(parsed.meta.title || titleFromPath(id)),
      meta: parsed.meta,
      tags,
      body: parsed.body,
      canvas,
      excerpt: text.slice(0, 210),
      search: text,
      words: text.split(/\s+/).filter(Boolean).length,
      collection:
        config.collections.find((c) => id.startsWith(c.prefix))?.id || "other",
      links: [],
      backlinks: [],
      images: [],
    });
  }
  const publishedFiles = [
    ...pages.map((p) => p.id),
    ...files.filter((file) => mediaExt.test(file)),
  ];
  const resolve = createResolver(publishedFiles, pages);
  const pageMap = new Map(pages.map((page) => [page.id, page]));
  const warnings = [];
  const referencedImages = new Set();
  for (const page of pages) {
    const refs = wikiTargets(
      `${page.body}\n${stringLeaves(page.meta).join("\n")}`,
    );
    marked.walkTokens(marked.lexer(page.body), (token) => {
      if (
        ["link", "image"].includes(token.type) &&
        token.href &&
        !/^(?:[a-z]+:|\/\/)/i.test(token.href)
      )
        refs.push({ target: token.href, embed: token.type === "image" });
    });
    for (const node of page.canvas?.nodes || []) {
      if (node.type === "file") refs.push({ target: node.file, embed: true });
      if (node.background) refs.push({ target: node.background, embed: true });
      if (node.text) refs.push(...wikiTargets(node.text));
    }
    for (const ref of refs) {
      const target = resolve(ref.target, page.id);
      if (target && pageMap.has(target) && target !== page.id)
        page.links.push(target);
      else if (target && mediaExt.test(target)) referencedImages.add(target);
      else if (!target)
        warnings.push({ page: page.id, target: ref.target, kind: "link" });
    }
    const images = page.meta.image || page.meta.images || [];
    const list =
      typeof images === "string"
        ? [images]
        : Array.isArray(images)
          ? images
          : [];
    for (const item of list) {
      const ref = Array.isArray(item)
        ? item[0]
        : typeof item === "object"
          ? item.file || item.src
          : item;
      if (!ref) continue;
      const target = resolve(ref, page.id);
      if (target && mediaExt.test(target)) {
        page.images.push({
          file: target,
          label: String(
            Array.isArray(item) ? item[1] || page.title : page.title,
          ),
        });
        referencedImages.add(target);
      } else warnings.push({ page: page.id, target: ref, kind: "image" });
    }
    page.links = [...new Set(page.links)];
  }
  for (const page of pages)
    for (const target of page.links)
      pageMap.get(target).backlinks.push(page.id);
  await fs.mkdir(path.join(output, "media"), { recursive: true });
  await fs.mkdir(cache, { recursive: true });
  const assets = {};
  let imageCount = 0;
  for (const file of files.filter((file) => mediaExt.test(file))) {
    const source = path.join(vaultRoot, file);
    const stat = await fs.stat(source);
    const key = createHash("sha256")
      .update(`${file}:${stat.size}:${stat.mtimeMs}`)
      .digest("hex")
      .slice(0, 16);
    const raster = /\.(png|jpe?g|webp|avif)$/i.test(file);
    const name = `${key}${raster ? ".webp" : path.extname(file).toLowerCase()}`;
    const destination = path.join(output, "media", name);
    if (raster) {
      const cached = path.join(cache, name);
      const thumb = `${key}-thumb.webp`;
      try {
        await fs.access(cached);
      } catch {
        await sharp(source, { limitInputPixels: 200_000_000 })
          .rotate()
          .resize({
            width: 1800,
            height: 2200,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 86 })
          .toFile(cached);
      }
      try {
        await fs.access(path.join(cache, thumb));
      } catch {
        await sharp(source)
          .rotate()
          .resize({
            width: 640,
            height: 800,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 80 })
          .toFile(path.join(cache, thumb));
      }
      await fs.copyFile(cached, destination);
      await fs.copyFile(
        path.join(cache, thumb),
        path.join(output, "media", thumb),
      );
      assets[file] = {
        src: `vault/media/${name}`,
        thumb: `vault/media/${thumb}`,
      };
      imageCount++;
    } else {
      await fs.copyFile(source, destination);
      assets[file] = {
        src: `vault/media/${name}`,
        thumb: `vault/media/${name}`,
      };
    }
  }
  const uniqueWarnings = [
    ...new Map(
      warnings.map((w) => [`${w.page}:${w.kind}:${w.target}`, w]),
    ).values(),
  ];
  const result = {
    config,
    pages,
    assets,
    files: publishedFiles,
    warnings: uniqueWarnings,
    stats: {
      pages: pages.filter((p) => p.type === "page").length,
      canvases: pages.filter((p) => p.type === "canvas").length,
      images: imageCount,
      links: pages.reduce((sum, page) => sum + page.links.length, 0),
    },
  };
  // Remove obsolete generated assets only inside the verified generated-media directory.
  const keep = new Set(
    Object.values(assets).flatMap((asset) => [
      path.basename(asset.src),
      path.basename(asset.thumb),
    ]),
  );
  for (const name of await fs.readdir(path.join(output, "media")))
    if (!keep.has(name)) await fs.unlink(path.join(output, "media", name));
  await fs.writeFile(path.join(output, "index.json"), JSON.stringify(result));
  console.log(
    `Vault: ${result.stats.pages} pages, ${result.stats.canvases} canvases, ${imageCount} images, ${result.stats.links} links. ${uniqueWarnings.length} unresolved source references.`,
  );
  return result;
}
