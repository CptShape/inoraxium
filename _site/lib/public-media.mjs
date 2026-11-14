// Only opaque asset names are published. This is an unlisted URL, not authorization.
export const mediaName = (source) => String(source).split("/").pop();
export function publicMediaPaths(asset) {
  return {
    src: `media/${mediaName(asset.src)}`,
    thumb: `media/${mediaName(asset.thumb)}`,
  };
}
export function publicAssets(documents) {
  const assets = {};
  for (const document of documents)
    for (const [file, asset] of Object.entries(document.assets || {})) {
      // Reject obsolete Firebase Storage paths and unexpected remote URLs.
      if (
        [asset.src, asset.thumb].every((value) =>
          /^media\/[a-f0-9]{32}(?:-thumb)?\.[a-z0-9]+$/.test(value || ""),
        )
      )
        assets[file] = asset;
    }
  return assets;
}
