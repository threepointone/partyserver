import esbuild from "esbuild";
import { tailwindPlugin } from "esbuild-plugin-tailwindcss";

await esbuild.build({
  entryPoints: ["./src/client/index.tsx"],
  bundle: true,
  plugins: [tailwindPlugin()],
  format: "esm",
  platform: "browser",
  outdir: "public/dist"
});
