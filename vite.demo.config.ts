import path from "node:path";
import type { UserConfigExport } from "vite";

const ROOT_DIR = __dirname;

const demoConfig: UserConfigExport = {
  root: path.resolve(ROOT_DIR, "demo"),
  base: "./",
  server: {
    port: 4173,
    fs: {
      allow: [ROOT_DIR],
    },
  },
  resolve: {
    alias: {
      "@src": path.resolve(ROOT_DIR, "src"),
    },
  },
  build: {
    outDir: path.resolve(ROOT_DIR, "demo", "dist"),
    emptyOutDir: true,
  },
};

export default demoConfig;
