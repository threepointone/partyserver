/** @type {import('@remix-run/dev').AppConfig} */

export default {
  ignoredRouteFiles: ["**/.*"],
  server: "./app/server.ts",
  serverConditions: ["workerd", "worker", "browser"],
  serverMainFields: ["workerd", "browser", "module", "main"],
  serverMinify: false,
  serverModuleFormat: "esm",
  serverPlatform: "neutral",
  future: {
    v3_fetcherPersist: true,
    v3_relativeSplatPath: true,
    v3_throwAbortReason: true
  },
  assetsBuildDirectory: "public/dist",
  serverBuildPath: "dist/index.js",
  publicPath: "/dist/",
  dev: {
    port: 8002
  }
};
