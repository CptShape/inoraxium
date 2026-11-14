import { defineConfig } from "vite";
import fs from "node:fs/promises";
import path from "node:path";
import { buildVault, vaultRoot } from "./_site/scripts/vault.mjs";
import { publicMediaPaths } from "./_site/lib/public-media.mjs";
let vault;
async function shell() {
  const c = JSON.parse(await fs.readFile("_site/site.config.json", "utf8"));
  return JSON.stringify({
    title: c.title,
    subtitle: c.subtitle,
    collections: c.collections.map(
      ({ id, title, prefix, icon, description }) => ({
        id,
        title,
        prefix,
        icon,
        description,
      }),
    ),
  });
}
export default defineConfig({
  root: "_site",
  base: "./",
  publicDir: false,
  envDir: "..",
  server: {
    fs: {
      deny: [
        "**/.private-build/**",
        "**/.env*",
        "**/*service-account*.json",
        "**/public/vault/**",
      ],
    },
  },
  build: { outDir: "../dist", emptyOutDir: true },
  plugins: [
    {
      name: "public-shell-only",
      async buildStart() {
        vault = await buildVault();
      },
      async generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "shell.json",
          source: await shell(),
        });
        const emitted = new Set();
        for (const asset of Object.values(vault.assets))
          for (const [kind, fileName] of Object.entries(
            publicMediaPaths(asset),
          )) {
            if (emitted.has(fileName)) continue;
            emitted.add(fileName);
            this.emitFile({
              type: "asset",
              fileName,
              source: await fs.readFile(
                path.join(vaultRoot, ".private-build", asset[kind]),
              ),
            });
          }
      },
      configureServer(server) {
        server.middlewares.use("/media", async (req, res) => {
          const name = (req.url || "").slice(1).split("?")[0];
          if (!/^[a-f0-9]{32}(?:-thumb)?\.[a-z0-9]+$/.test(name)) {
            res.statusCode = 404;
            res.end();
            return;
          }
          try {
            const buffer = await fs.readFile(
              path.join(vaultRoot, ".private-build/vault/media", name),
            );
            const types = {
              webp: "image/webp",
              png: "image/png",
              jpg: "image/jpeg",
              gif: "image/gif",
              svg: "image/svg+xml",
              pdf: "application/pdf",
              mp3: "audio/mpeg",
              mp4: "video/mp4",
              webm: "video/webm",
              ogg: "audio/ogg",
              wav: "audio/wav",
            };
            res.setHeader(
              "Content-Type",
              types[name.split(".").pop()] || "application/octet-stream",
            );
            res.setHeader("X-Content-Type-Options", "nosniff");
            res.end(buffer);
          } catch {
            res.statusCode = 404;
            res.end();
          }
        });
        server.middlewares.use("/shell.json", async (req, res) => {
          res.setHeader("Content-Type", "application/json");
          res.end(await shell());
        });
      },
    },
  ],
});
