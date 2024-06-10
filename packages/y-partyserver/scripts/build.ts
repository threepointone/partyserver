import { execSync } from "child_process";

import { build } from "tsup";

await build({
  entry: [
    "src/server/index.ts",
    "src/provider/index.ts",
    "src/provider/react.tsx"
  ],
  splitting: true,
  sourcemap: true,
  clean: true,
  external: ["cloudflare:workers", "partyserver", "react"],
  format: "esm",
  dts: true
});

// then run prettier on the generateed .d.ts files
execSync("npx prettier --write dist/**/*.d.ts");

process.exit(0);
