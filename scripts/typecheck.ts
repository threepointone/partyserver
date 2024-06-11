import { $, Glob } from "bun";

const glob = new Glob("**/tsconfig.json");

const files: string[] = [];

for await (const file of glob.scan(".")) {
  if (file.includes("node_modules")) continue;
  files.push(file);
}

console.log(`Typechecking ${files.length} projects...`);

const result = await Promise.allSettled(
  files.map((file) => $`bunx tsc -p ${file}`)
);

if (result.filter((r) => r.status === "rejected").length > 0) {
  console.error("Some projects failed to typecheck!");
  process.exit(1);
}

console.log("All projects typecheck successfully!");
