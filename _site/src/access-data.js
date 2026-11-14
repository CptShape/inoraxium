export function visibleAtlas(config, docs, assets = {}) {
  const pages = docs.map((doc) => ({
    ...doc.page,
    access: {
      key: doc.key,
      visibility: doc.visibility,
      readerUids: doc.readerUids,
    },
  }));
  const ids = new Set(pages.map((p) => p.id));
  for (const page of pages) {
    page.links = page.links.filter((id) => ids.has(id));
    page.backlinks = page.backlinks.filter((id) => ids.has(id));
  }
  for (const page of pages)
    page.backlinks = pages
      .filter((p) => p.links.includes(page.id))
      .map((p) => p.id);
  const featured = [...pages]
    .sort((a, b) => b.words - a.words)
    .slice(0, 3)
    .map((p) => p.id);
  return {
    config: {
      ...config,
      featured,
      heroPage: pages.find((p) => p.images.length)?.id,
    },
    pages,
    assets,
    files: [...ids, ...Object.keys(assets)],
    warnings: [],
    stats: {
      pages: pages.filter((p) => p.type === "page").length,
      canvases: pages.filter((p) => p.type === "canvas").length,
      images: Object.keys(assets).length,
      links: pages.reduce((n, p) => n + p.links.length, 0),
    },
  };
}
