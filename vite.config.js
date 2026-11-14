import { defineConfig } from "vite";
import fs from "node:fs/promises";
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
      async generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "shell.json",
          source: await shell(),
        });
      },
      configureServer(server) {
        server.middlewares.use("/shell.json", async (req, res) => {
          res.setHeader("Content-Type", "application/json");
          res.end(await shell());
        });
      },
    },
  ],
});
