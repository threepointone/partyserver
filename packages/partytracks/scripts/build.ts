import { build } from "tsup";

await build({
  entry: ["src/client/index.ts", "src/react/index.ts", "src/server/index.ts"],
  splitting: true,
  sourcemap: true,
  clean: true,
  noExternal: ["cookie", "jose", "tiny-invariant"],
  external: ["react"],
  format: "esm",
  dts: true
});

process.exit(0);
