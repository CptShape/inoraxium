export const normalize = (value) =>
  String(value).normalize("NFC").toLowerCase().replaceAll("\\", "/");
const cleanPath = (value) => {
  const parts = [];
  for (const part of value.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
};
export function createResolver(files, pages = []) {
  const exact = new Map(files.map((file) => [normalize(file), file]));
  const names = new Map();
  const add = (name, file) => {
    const key = normalize(name);
    names.set(key, [...new Set([...(names.get(key) || []), file])]);
  };
  for (const file of files) {
    add(file.split("/").pop(), file);
    add(file.replace(/\.(md|canvas)$/i, ""), file);
    if (/\.(md|canvas)$/i.test(file))
      add(
        file
          .split("/")
          .pop()
          .replace(/\.(md|canvas)$/i, ""),
        file,
      );
  }
  for (const page of pages)
    for (const alias of [
      page.title,
      ...(Array.isArray(page.meta?.aliases)
        ? page.meta.aliases
        : page.meta?.aliases
          ? [page.meta.aliases]
          : []),
    ])
      add(alias, page.id);
  return (raw, from = "") => {
    let target = String(raw).trim().split("#")[0].replaceAll("\\", "/");
    try {
      target = decodeURIComponent(target);
    } catch {
      /* literal */
    }
    if (!target) return from || null;
    if (/^(?:[a-z]+:|\/\/)/i.test(target)) return null;
    const folder = from.slice(0, Math.max(0, from.lastIndexOf("/") + 1));
    const relative = cleanPath(`${folder}${target}`);
    const rooted = cleanPath(target);
    for (const base of target.startsWith("/") ? [rooted] : [relative, rooted])
      for (const candidate of [base, `${base}.md`, `${base}.canvas`])
        if (exact.has(normalize(candidate)))
          return exact.get(normalize(candidate));
    const candidates =
      names.get(normalize(target)) ||
      names.get(normalize(target.replace(/\.(md|canvas)$/i, ""))) ||
      [];
    const closeness = (file) => {
      const a = from.split("/"),
        b = file.split("/");
      let count = 0;
      while (
        count < Math.min(a.length, b.length) - 1 &&
        normalize(a[count]) === normalize(b[count])
      )
        count++;
      return count;
    };
    return (
      [...candidates].sort(
        (a, b) => closeness(b) - closeness(a) || a.localeCompare(b),
      )[0] || null
    );
  };
}
