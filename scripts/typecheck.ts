import { execSync } from "node:child_process";
import fg from "fast-glob";

const tsconfigs: string[] = [];

for await (const file of await fg.glob("**/tsconfig.json")) {
  if (file.includes("node_modules")) continue;
  tsconfigs.push(file);
}

console.log(`Typechecking ${tsconfigs.length} projects...`);

const failed = (
  await Promise.allSettled(
    tsconfigs.map((tsconfig) => execSync(`tsc -p ${tsconfig}`))
  )
).filter((r) => r.status === "rejected");

if (failed.length > 0) {
  console.error("Some projects failed to typecheck!");
  process.exit(1);
}

console.log("All projects typecheck successfully!");
