import test from "node:test";
import assert from "node:assert/strict";
import { visibleAtlas } from "../src/access-data.js";
test("an empty authorized snapshot reveals no pages or filenames", () => {
  const data = visibleAtlas({ collections: [] }, []);
  assert.deepEqual(data.pages, []);
  assert.deepEqual(data.files, []);
  assert.equal(data.stats.pages, 0);
});
test("search, graph and backlinks contain only currently authorized documents", () => {
  const page = {
    id: "public.md",
    images: [],
    words: 2,
    type: "page",
    links: ["secret.md"],
    backlinks: ["secret.md"],
    body: "[[secret]]",
  };
  const data = visibleAtlas({ collections: [] }, [
    { key: "p", page, visibility: "public", readerUids: [] },
  ]);
  assert.deepEqual(data.pages[0].links, []);
  assert.deepEqual(data.pages[0].backlinks, []);
  assert.deepEqual(data.files, ["public.md"]);
});
