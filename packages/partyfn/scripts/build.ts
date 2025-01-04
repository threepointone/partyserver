import { $ } from "bun";
import { build } from "tsup";

await build({
  entry: ["src/index.ts"],
  splitting: true,
  sourcemap: true,
  clean: true,
  external: ["cloudflare:workers", "partyserver", "react", "nanoid"],
  format: "esm",
  dts: true
});

// then run prettier on the generated .d.ts files
await $`prettier --write ./dist/**/*.d.ts`;

process.exit(0);
