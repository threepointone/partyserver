import { execSync } from "node:child_process";
import { build } from "tsup";

await build({
  entry: [
    "src/index.ts",
    "src/react.ts",
    "src/ws.ts",
    "src/use-ws.ts",
    "src/event-target-polyfill.ts"
  ],
  splitting: true,
  sourcemap: true,
  clean: true,
  external: ["cloudflare:workers", "partyserver", "react"],
  format: ["esm", "cjs"],
  dts: true
});

// then run prettier on the generated files
execSync("prettier --write ./dist/**/*.d.ts");
execSync("prettier --write ./dist/**/*.d.mts");
execSync("prettier --write ./dist/**/*.js");
execSync("prettier --write ./dist/**/*.mjs");

process.exit(0);
