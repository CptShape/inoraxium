import path from "node:path";
import { parseDocument } from "yaml";

export const titleFromPath = (file) =>
  path.posix.basename(file).replace(/\.(md|canvas)$/i, "");
export const plainText = (text) =>
  String(text)
    .replace(/!\[\[[^\]]+\]\]/g, "")
    .replace(
      /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
      (_, target, label) => label || target,
    )
    .replace(/<[^>]*>/g, "")
    .replace(/[#*_`>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// Chronicler permits unquoted [[wikilinks]] in flow-style YAML arrays.
// Quote only those outside YAML strings, without changing the source Markdown.
export function quoteWikiYaml(source) {
  let result = "",
    quote = "",
    escaped = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quote) {
      result += char;
      if (char === quote && !escaped) {
        if (quote === "'" && source[i + 1] === "'") {
          result += source[++i];
          continue;
        }
        quote = "";
      }
      escaped = char === "\\" && !escaped;
    } else if (
      (char === '"' || char === "'") &&
      (i === 0 || /[\s\[:,{]/.test(source[i - 1]))
    ) {
      quote = char;
      result += char;
    } else if (source.startsWith("[[", i)) {
      const end = source.indexOf("]]", i + 2);
      if (end >= 0) {
        result += JSON.stringify(source.slice(i, end + 2));
        i = end + 1;
      } else result += char;
    } else result += char;
  }
  return result;
}

export function parseMarkdown(source, file = "") {
  const clean = source.replace(/^\uFEFF/, "");
  const match = clean.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return { meta: {}, body: source, warnings: [] };
  const doc = parseDocument(quoteWikiYaml(match[1]), { uniqueKeys: true });
  const warnings = doc.errors.map((error) => `${file}: ${error.message}`);
  if (warnings.length) throw new Error(warnings.join("\n"));
  const meta = doc.toJS();
  return {
    meta: meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {},
    body: clean.slice(match[0].length),
    warnings,
  };
}

export function wikiTargets(text) {
  return [...String(text).matchAll(/(!?)\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)].map(
    (match) => ({ embed: Boolean(match[1]), target: match[2].trim() }),
  );
}
