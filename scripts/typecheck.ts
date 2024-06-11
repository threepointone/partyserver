import { $, Glob } from "bun";

const tsconfigs: string[] = [];

for await (const file of new Glob("**/tsconfig.json").scan(".")) {
  if (file.includes("node_modules")) continue;
  tsconfigs.push(file);
}

console.log(`Typechecking ${tsconfigs.length} projects...`);

const failed = (
  await Promise.allSettled(tsconfigs.map((tsconfig) => $`tsc -p ${tsconfig}`))
).filter((r) => r.status === "rejected");

if (failed.length > 0) {
  console.error("Some projects failed to typecheck!");
  process.exit(1);
}

console.log("All projects typecheck successfully!");
