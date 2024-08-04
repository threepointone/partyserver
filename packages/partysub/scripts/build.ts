import { $ } from "bun";
import { build } from "tsup";

await build({
  entry: ["src/server/index.ts", "src/client/index.ts", "src/client/react.tsx"],
  splitting: true,
  sourcemap: true,
  clean: true,
  external: ["cloudflare:workers", "partyserver", "react"],
  format: "esm",
  dts: true
});

// then run prettier on the generated .d.ts files
await $`prettier --write ./dist/**/*.d.ts`;

process.exit(0);
