import esbuild from "esbuild";

await esbuild.build({
  entryPoints: [
    "./src/client/index.tsx",
    "monaco-editor/esm/vs/language/typescript/ts.worker",
    "monaco-editor/esm/vs/editor/editor.worker.js",
    "monaco-editor/esm/vs/language/json/json.worker",
    "monaco-editor/esm/vs/language/css/css.worker",
    "monaco-editor/esm/vs/language/html/html.worker"
  ],
  loader: {
    ".ttf": "file"
  },
  splitting: false,
  bundle: true,
  format: "iife",
  platform: "browser",
  outdir: "public/dist"
});
