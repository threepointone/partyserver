import * as fs from "node:fs";

import { $ } from "bun";

try {
  console.log("Getting current git hash...");
  const stdout = (await $`git rev-parse --short HEAD`).text();

  for (const path of [
    "./packages/partyserver/package.json",
    "./packages/y-partyserver/package.json",
    "./packages/partysub/package.json",
    "./packages/partyfn/package.json",
    "./packages/partysync/package.json",
    "./packages/partywhen/package.json",
    "./packages/partytracks/package.json"
  ]) {
    const packageJson = JSON.parse(fs.readFileSync(path, "utf-8"));
    packageJson.version = `0.0.0-${stdout.trim()}`;
    fs.writeFileSync(path, `${JSON.stringify(packageJson, null, 2)}\n`);
  }
} catch (error) {
  console.error(error);
  process.exit(1);
}
