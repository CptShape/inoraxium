import test from "node:test";
import assert from "node:assert/strict";
import { buildFolders, folderItems, folderUrl } from "../lib/explorer.mjs";
const page = (id) => ({
  id,
  title: id.split("/").pop().replace(".md", ""),
  tags: [],
  words: 50,
  type: "page",
});
const pages = [
  "main.md",
  "Mythology/Gods/Zeus.md",
  "Mythology/Gods/Hera.md",
  "Mythology/Titans/Kronos.md",
  "Mythology2/Other.md",
  "Şehirler/Bilgelik Şehri.md",
  "__proto__/safe.md",
].map(page);
test("folders preserve hierarchy, direct files, and authorized descendant counts", () => {
  const { root, byPath } = buildFolders(pages);
  assert.equal(root.total, 7);
  assert.equal(root.pages.length, 1);
  assert.equal(byPath.get("Mythology").total, 3);
  assert.equal(byPath.get("Mythology").pages.length, 0);
  assert.equal(byPath.get("__proto__").pages.length, 1);
});
test("scoped search respects folder boundaries and Turkish characters", () => {
  const { root, byPath } = buildFolders(pages);
  assert.equal(folderItems(byPath.get("Mythology"), pages, "Other").length, 0);
  assert.equal(
    folderItems(root, pages, "bilgelik sehri")[0].name,
    "Bilgelik Şehri",
  );
  assert.equal(
    folderItems(byPath.get("Mythology"), pages, "Zeus")[0].page.id,
    "Mythology/Gods/Zeus.md",
  );
});
test("empty and unauthorized folders are absent; folders sort before files", () => {
  const { root, byPath } = buildFolders([page("visible.md")]);
  assert.equal(byPath.has("Mythology"), false);
  assert.equal(folderItems(root, [page("visible.md")], "missing").length, 0);
  const tree = buildFolders(pages);
  assert.equal(folderItems(tree.root, pages, "", "za")[0].kind, "folder");
  assert.equal(folderUrl("Mythology/Gods"), "#/files/Mythology%2FGods");
});
