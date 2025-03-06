import { execSync } from "node:child_process";
import { build } from "tsup";

await build({
  entry: ["src/index.ts"],
  splitting: true,
  sourcemap: true,
  clean: true,
  external: ["cloudflare:workers", "partyserver", "react", "nanoid", "hono"],
  format: "esm",
  dts: true
});

// then run prettier on the generated .d.ts files
execSync("prettier --write ./dist/**/*.d.ts");

process.exit(0);
