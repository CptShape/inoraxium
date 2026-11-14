export const folderUrl = (path) =>
  `#/files${path ? `/${encodeURIComponent(path)}` : ""}`;
export function buildFolders(pages) {
  const root = {
    name: "Atlas",
    path: "",
    folders: new Map(),
    pages: [],
    total: 0,
  };
  const byPath = new Map([["", root]]);
  for (const page of pages) {
    const parts = page.id.split("/");
    parts.pop();
    let node = root;
    node.total++;
    for (const part of parts) {
      const path = node.path ? `${node.path}/${part}` : part;
      if (!node.folders.has(part)) {
        const child = {
          name: part,
          path,
          folders: new Map(),
          pages: [],
          total: 0,
        };
        node.folders.set(part, child);
        byPath.set(path, child);
      }
      node = node.folders.get(part);
      node.total++;
    }
    node.pages.push(page);
  }
  return { root, byPath };
}
export const searchText = (value) =>
  String(value)
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replaceAll("ı", "i");
export function folderItems(node, pages, term = "", sort = "az") {
  const query = searchText(term.trim());
  let items = query
    ? pages
        .filter(
          (p) =>
            (!node.path || p.id.startsWith(`${node.path}/`)) &&
            searchText(`${p.title} ${p.id} ${p.tags.join(" ")}`).includes(
              query,
            ),
        )
        .map((page) => ({ kind: "page", name: page.title, page }))
    : [...node.folders.values()]
        .map((folder) => ({ kind: "folder", name: folder.name, folder }))
        .concat(
          node.pages.map((page) => ({ kind: "page", name: page.title, page })),
        );
  return items.sort(
    (a, b) =>
      (a.kind === "folder" ? -1 : 1) - (b.kind === "folder" ? -1 : 1) ||
      (sort === "za" ? -1 : 1) *
        a.name.localeCompare(b.name, "tr", { numeric: true }),
  );
}
