import { defineConfig } from "vite";
import { buildVault, vaultRoot } from "./_site/scripts/vault.mjs";
import path from "node:path";

export default defineConfig({
  root: "_site",
  base: "./",
  build: { outDir: "../dist", emptyOutDir: true },
  plugins: [
    {
      name: "inoraxium-vault",
      async buildStart() {
        await buildVault();
      },
      configureServer(server) {
        server.watcher.add(vaultRoot);
        let timer;
        let queue = Promise.resolve();
        server.watcher.on("all", (event, file) => {
          const relative = path.relative(vaultRoot, file).replaceAll("\\", "/");
          if (
            relative.startsWith(".") ||
            relative.startsWith("_") ||
            relative.startsWith("node_modules/") ||
            relative.startsWith("dist/") ||
            !/\.(md|canvas|png|jpg|jpeg|webp|gif|svg|avif|pdf|mp3|mp4|ogg|wav)$/i.test(
              relative,
            )
          )
            return;
          if (!["add", "change", "unlink"].includes(event)) return;
          clearTimeout(timer);
          timer = setTimeout(() => {
            queue = queue
              .then(buildVault)
              .then(() => server.ws.send({ type: "full-reload" }))
              .catch((error) => server.config.logger.error(error.message));
          }, 350);
        });
      },
    },
  ],
});
