import fs from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";
async function scan(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const name = path.join(dir, entry.name);
    if (entry.isDirectory()) await scan(name);
    else {
      const relative = path.relative("dist", name).replaceAll("\\", "/");
      if (relative.startsWith("media/")) {
        assert.match(
          relative,
          /^media\/[a-f0-9]{32}(?:-thumb)?\.(webp|gif|svg|avif|png|jpg|jpeg|pdf|mp3|mp4|ogg|wav|webm)$/,
        );
        continue;
      }
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
  "Public build contains the application shell and unlisted public media; no vault page documents.",
);
