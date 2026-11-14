import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { parseMarkdown } from "../lib/content.mjs";
import { createResolver } from "../lib/resolve.mjs";
import { vaultRoot } from "../scripts/vault.mjs";

test("Chronicler flow YAML accepts unquoted wikilinks and keeps quoted prose intact", () => {
  const source =
    '---\nAffiliations: [ [[Cain]] , [[Asmodeus]] , [[Minerva]] ]\nBirth: ["Father: [[Zeus]]", "Mother: Leto"]\nTitles: [Witch of Greed]\n---\n\n# A page\n';
  const { meta, body } = parseMarkdown(source);
  assert.deepEqual(meta.Affiliations, [
    "[[Cain]]",
    "[[Asmodeus]]",
    "[[Minerva]]",
  ]);
  assert.equal(meta.Birth[0], "Father: [[Zeus]]");
  assert.equal(body, "\n# A page\n");
});

test("invalid YAML stops a build rather than silently losing an infobox", () => {
  assert.throws(
    () => parseMarkdown("---\ntitle: [broken\n---\ncontent", "bad.md"),
    /bad.md/,
  );
});

test("all real vault Markdown can be parsed without modifying sources", async () => {
  let count = 0;
  async function walk(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      if (
        entry.name.startsWith(".") ||
        entry.name.startsWith("_") ||
        ["node_modules", "dist", "test-results"].includes(entry.name)
      )
        continue;
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (/\.md$/i.test(entry.name) && entry.name !== "README.md") {
        const source = await readFile(file, "utf8");
        assert.doesNotThrow(() => parseMarkdown(source, file));
        count++;
      }
    }
  }
  await walk(vaultRoot);
  assert.ok(count > 0, "The vault must contain at least one Markdown page");
});

test("resolver handles relative paths, encoded Turkish names, aliases and duplicate basenames", () => {
  const files = [
    "Gods/Zeus.md",
    "Gods/Athena.md",
    "Other/Zeus.md",
    "Şehirler/Bilgelik Şehri.md",
    "images/Zeus.png",
    "Board.CANVAS",
  ];
  const resolve = createResolver(files, [
    { id: files[0], title: "Zeus", meta: { aliases: ["Thunder King"] } },
  ]);
  assert.equal(resolve("Zeus", "Gods/Athena.md"), "Gods/Zeus.md");
  assert.equal(resolve("Zeus", "Other/Entry.md"), "Other/Zeus.md");
  assert.equal(resolve("../Other/Zeus.md", "Gods/Athena.md"), "Other/Zeus.md");
  assert.equal(resolve("/Gods/Zeus", "Other/Entry.md"), "Gods/Zeus.md");
  assert.equal(resolve("Thunder King"), "Gods/Zeus.md");
  assert.equal(
    resolve("%C5%9Eehirler/Bilgelik%20%C5%9Eehri.md"),
    "Şehirler/Bilgelik Şehri.md",
  );
  assert.equal(resolve("zeus.PNG"), "images/Zeus.png");
  assert.equal(resolve("Board.canvas"), "Board.CANVAS");
  assert.equal(resolve("#Bio", "Gods/Zeus.md"), "Gods/Zeus.md");
  assert.equal(resolve("Missing page"), null);
  assert.equal(resolve("https://example.com"), null);
});
