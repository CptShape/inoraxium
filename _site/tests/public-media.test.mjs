import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { publicMediaPaths, publicAssets } from "../lib/public-media.mjs";
test("public media URLs contain opaque hashes, not source filenames or page IDs", () => {
  const key = "a".repeat(32);
  assert.deepEqual(
    publicMediaPaths({
      src: `vault/media/${key}.webp`,
      thumb: `vault/media/${key}-thumb.webp`,
    }),
    { src: `media/${key}.webp`, thumb: `media/${key}-thumb.webp` },
  );
});
test("only authorized documents supply URL mappings; old Storage paths are ignored", () => {
  const asset = {
    src: `media/${"b".repeat(32)}.webp`,
    thumb: `media/${"b".repeat(32)}-thumb.webp`,
  };
  assert.deepEqual(publicAssets([]), {});
  assert.deepEqual(publicAssets([{ assets: { "portrait.png": asset } }]), {
    "portrait.png": asset,
  });
  assert.deepEqual(
    publicAssets([
      {
        assets: {
          "old.png": {
            src: "page-media/private/old.webp",
            thumb: "https://example.com/file",
          },
        },
      },
    ]),
    {},
  );
});
test("the build publishes unlisted media, with no vault index or media listing", async (t) => {
  let entries;
  try {
    entries = await fs.readdir("dist/media");
  } catch (error) {
    if (error.code === "ENOENT") {
      t.skip("Run npm run build first");
      return;
    }
    throw error;
  }
  assert.ok(entries.length > 0);
  assert.ok(
    entries.every((name) => /^[a-f0-9]{32}(?:-thumb)?\.[a-z0-9]+$/.test(name)),
  );
  await assert.rejects(fs.access("dist/vault/index.json"));
  await assert.rejects(fs.access("dist/media/index.json"));
});
