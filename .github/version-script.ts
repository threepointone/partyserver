import * as fs from "node:fs";
import { execSync } from "node:child_process";
try {
  console.log("Getting current git hash...");
  const stdout = execSync("git rev-parse --short HEAD").toString();

  for (const path of [
    "./packages/partyserver/package.json",
    "./packages/y-partyserver/package.json",
    "./packages/partysub/package.json",
    "./packages/partyfn/package.json",
    "./packages/partysync/package.json",
    "./packages/partywhen/package.json",
    "./packages/partytracks/package.json",
    "./packages/hono-party/package.json"
  ]) {
    const packageJson = JSON.parse(fs.readFileSync(path, "utf-8"));
    packageJson.version = `0.0.0-${stdout.trim()}`;
    fs.writeFileSync(path, `${JSON.stringify(packageJson, null, 2)}\n`);
  }
} catch (error) {
  console.error(error);
  process.exit(1);
}
