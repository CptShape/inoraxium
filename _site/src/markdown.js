import { Marked } from "marked";
import markedFootnote from "marked-footnote";
import GithubSlugger, { slug } from "github-slugger";
import DOMPurify from "dompurify";
import { createResolver } from "../lib/resolve.mjs";

export const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
export const pageUrl = (id, section = "") =>
  `#/page/${encodeURIComponent(id)}${section ? `?section=${encodeURIComponent(section)}` : ""}`;
export const safeExternal = (value) => {
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:"].includes(url.protocol)
      ? url.href
      : null;
  } catch {
    return null;
  }
};
export const headingId = (value) =>
  slug(
    String(value)
      .replace(
        /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
        (_, target, alias) => alias || target,
      )
      .replace(/<[^>]+>/g, "")
      .replace(/[*_`]/g, "")
      .trim(),
  );

export function createMarkdown(data) {
  const resolve = createResolver(data.files, data.pages);
  const pages = new Map(data.pages.map((page) => [page.id, page]));
  const asset = (ref, from = "", thumbnail = false) => {
    const file = resolve(ref, from);
    const entry = data.assets[file];
    return entry ? (thumbnail ? entry.thumb : entry.src) : safeExternal(ref);
  };
  function render(source, from = "", depth = 0) {
    const headings = [];
    const slugger = new GithubSlugger();
    const wiki = (raw, embed = false) => {
      const [reference, ...aliases] = raw.split("|");
      const [targetName, ...sections] = reference.trim().split("#");
      const section = sections.join("#");
      const label = aliases.join("|").trim() || targetName.trim() || section;
      const target = resolve(reference.trim(), from);
      const targetPage = pages.get(target);
      if (embed && targetPage) {
        if (depth >= 3 || target === from)
          return `<a class="embed-link" data-page="${escapeHtml(target)}" href="${pageUrl(target, section)}">${escapeHtml(targetPage.title)} ↗</a>`;
        if (targetPage.type === "canvas")
          return `<a class="embed-link" data-page="${escapeHtml(target)}" href="${pageUrl(target)}">◈ ${escapeHtml(targetPage.title)} — Canvas'ı aç ↗</a>`;
        let body = targetPage.body;
        if (section) {
          const lines = body.split("\n");
          const start = lines.findIndex(
            (line) =>
              /^#{1,6}\s/.test(line) &&
              headingId(line.replace(/^#+\s*/, "")) === headingId(section),
          );
          if (start >= 0) {
            const level = lines[start].match(/^#+/)[0].length;
            let end = start + 1;
            while (
              end < lines.length &&
              !new RegExp(`^#{1,${level}}\\s`).test(lines[end])
            )
              end++;
            body = lines.slice(start, end).join("\n");
          }
        }
        return `<span class="page-embed"><a class="embed-title" data-page="${escapeHtml(target)}" href="${pageUrl(target, section)}">${escapeHtml(targetPage.title)} ↗</a><span class="embed-body">${render(body, target, depth + 1).html}</span></span>`;
      }
      if (embed && target) {
        const src = asset(target, from);
        if (/\.(mp4|webm)$/i.test(target))
          return `<video controls preload="metadata" src="${escapeHtml(src)}"></video>`;
        if (/\.(mp3|ogg|wav)$/i.test(target))
          return `<audio controls preload="metadata" src="${escapeHtml(src)}"></audio>`;
        if (/\.pdf$/i.test(target))
          return `<a href="${escapeHtml(src)}" target="_blank" rel="noopener">${escapeHtml(label)} ↗</a>`;
        const size = aliases[0]?.trim().match(/^(\d+)(?:x(\d+))?$/);
        return `<img loading="lazy" class="content-image" src="${escapeHtml(src)}" alt="${escapeHtml(size ? targetName : label)}" ${size ? `width="${Number(size[1])}" ${size[2] ? `height="${Number(size[2])}"` : ""}` : ""}>`;
      }
      if (targetPage)
        return `<a class="wiki-link" data-page="${escapeHtml(target)}" href="${pageUrl(target, section)}">${escapeHtml(label)}</a>`;
      if (target && data.assets[target])
        return `<a href="${escapeHtml(asset(target, from))}" target="_blank" rel="noopener">${escapeHtml(label)} ↗</a>`;
      return `<a class="missing-link" href="#/missing/${encodeURIComponent(targetName.trim())}" title="Bu sayfa henüz vault içinde yok">${escapeHtml(label)}</a>`;
    };
    const marked = new Marked({ gfm: true, breaks: true });
    marked.use(markedFootnote());
    marked.use({
      extensions: [
        {
          name: "wikiembed",
          level: "block",
          start: (source) => source.indexOf("![["),
          tokenizer(source) {
            const match = /^!\[\[([^\]\n]+)\]\](?:\s*\n|$)/.exec(source);
            if (match)
              return { type: "wikiembed", raw: match[0], ref: match[1] };
          },
          renderer(token) {
            return `${wiki(token.ref, true)}\n`;
          },
        },
        {
          name: "wikilink",
          level: "inline",
          start: (source) => source.search(/!?\[\[/),
          tokenizer(source) {
            const match = /^(!?)\[\[([^\]\n]+)\]\]/.exec(source);
            if (match)
              return {
                type: "wikilink",
                raw: match[0],
                ref: match[2],
                embed: Boolean(match[1]),
              };
          },
          renderer(token) {
            return wiki(token.ref, token.embed);
          },
        },
        {
          name: "spoiler",
          level: "inline",
          start: (source) => source.indexOf("||"),
          tokenizer(source) {
            const match = /^\|\|([^\n]+?)\|\|/.exec(source);
            if (match)
              return { type: "spoiler", raw: match[0], text: match[1] };
          },
          renderer(token) {
            return `<button type="button" class="spoiler" aria-expanded="false" aria-label="Gizli metni göster">${escapeHtml(token.text)}</button>`;
          },
        },
      ],
      renderer: {
        heading(token) {
          const text = this.parser.parseInline(token.tokens);
          const plain = text.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&");
          const id = slugger.slug(plain);
          headings.push({ id, text: plain, depth: token.depth });
          return `<h${token.depth} id="${escapeHtml(id)}">${text}<a class="heading-anchor" href="${pageUrl(from, id)}" aria-label="Bu başlığın bağlantısı">#</a></h${token.depth}>`;
        },
        link(token) {
          const text = this.parser.parseInline(token.tokens);
          if (token.href.startsWith("#"))
            return `<a href="${pageUrl(from, token.href.slice(1))}">${text}</a>`;
          const resolved = resolve(token.href, from);
          if (pages.has(resolved))
            return `<a class="wiki-link" data-page="${escapeHtml(resolved)}" href="${pageUrl(resolved, token.href.split("#")[1] || "")}">${text}</a>`;
          const url = asset(token.href, from) || safeExternal(token.href);
          return url
            ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${text}</a>`
            : `<span class="missing-link">${text}</span>`;
        },
        image(token) {
          const url = asset(token.href, from);
          return url
            ? `<img class="content-image" src="${escapeHtml(url)}" alt="${escapeHtml(token.text)}" ${token.title ? `title="${escapeHtml(token.title)}"` : ""} loading="lazy">`
            : `<span class="missing-media">Görsel bulunamadı: ${escapeHtml(token.text || token.href)}</span>`;
        },
      },
    });
    const html = DOMPurify.sanitize(marked.parse(String(source)), {
      ADD_TAGS: ["video", "audio"],
      ALLOWED_URI_REGEXP:
        /^(?:(?:https?|mailto|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      ADD_ATTR: ["controls", "preload", "target"],
      FORBID_TAGS: ["iframe", "form", "input", "script", "style"],
      FORBID_ATTR: ["srcdoc"],
    });
    const template = document.createElement("template");
    template.innerHTML = html;
    // Resolve vault paths in user-authored HTML as well as Markdown syntax.
    for (const element of template.content.querySelectorAll(
      "img[src],video[src],audio[src],source[src]",
    )) {
      const src = element.getAttribute("src");
      if (!(src.startsWith("vault/media/") || src.startsWith("blob:"))) {
        const resolved = asset(src, from);
        if (resolved) element.setAttribute("src", resolved);
      }
    }
    for (const anchor of template.content.querySelectorAll("a[href]")) {
      const href = anchor.getAttribute("href");
      if (href.startsWith("#") || href.startsWith("vault/media/")) continue;
      const target = resolve(href, from);
      if (pages.has(target)) {
        anchor.setAttribute("href", pageUrl(target, href.split("#")[1] || ""));
        anchor.dataset.page = target;
      }
    }
    return { html: template.innerHTML, headings };
  }
  return { render, resolve, asset };
}
