import { defineConfig } from "tsup";

const baseConfig = {
  entry: { "dataone-notifications": "src/client.ts" },
  sourcemap: true,
  splitting: false,
  bundle: true,
  outDir: "dist",
  platform: "browser",
  clean: true,
};

export default defineConfig([
  // ESM build (ky external)
  {
    ...baseConfig,
    format: ["esm"],
    dts: {
      entry: { "dataone-notifications": "src/client.ts" },
      format: "both",
    },
    target: "es2020",
    external: ["ky"],
    minify: false,
    outExtension: () => ({ js: ".mjs" }),
  },
  // UMD build (ky bundled)
  {
    ...baseConfig,

    format: ["iife"],
    globalName: "DataONENotifications",
    target: "es2017",
    minify: true,
    noExternal: ["ky"],
    outExtension: () => ({ js: ".bundle.umd.js" }),
    // allow loading as an AMD module, e.g. with RequireJS OR in a <script> tag
    // where the NotificationClient is then available as
    // window.DataONENotifications.NotificationClient
    footer: {
      js: `
(function () {
  if (typeof define === "function" && define.amd) {
    var _mod = DataONENotifications;
    define(function () { return _mod; });
    // Clean up the global to avoid pollution
    try { delete globalThis.DataONENotifications; }
    catch (e) { globalThis.DataONENotifications = undefined; }
  }
})();
`,
    },
  },
]);
