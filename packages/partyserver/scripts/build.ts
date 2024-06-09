import { execSync } from "child_process";

import { build } from "tsup";

await build({
  entry: ["src/index.ts"],
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ["cloudflare:workers"],
  format: "esm",
  dts: true
});

// then run prettier on the generateed .d.ts files
execSync("npx prettier --write dist/*.d.ts");

process.exit(0);
