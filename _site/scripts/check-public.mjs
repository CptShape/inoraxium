import fs from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";
async function scan(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const name = path.join(dir, entry.name);
    if (entry.isDirectory()) await scan(name);
    else {
      assert.ok(
        !/\.(md|canvas|png|jpe?g|webp|pdf)$/i.test(name),
        `Private file in build: ${name}`,
      );
      const text = await fs.readFile(name, "utf8");
      assert.ok(!text.includes('"body":"'), `Vault data in build: ${name}`);
      assert.ok(!name.includes("vault/"), "Vault directory in build");
    }
  }
}
await scan("dist");
console.log(
  "Public build contains only the application shell; no vault pages or media.",
);
