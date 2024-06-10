import { execSync } from "child_process";
import * as fs from "fs";

try {
  const stdout = execSync("git rev-parse --short HEAD", { encoding: "utf-8" });

  for (const path of [
    "./packages/partyserver/package.json",
    "./packages/y-partyserver/package.json"
  ]) {
    const packageJson = JSON.parse(fs.readFileSync(path, "utf-8"));
    packageJson.version = "0.0.0-" + stdout.trim();
    fs.writeFileSync(path, JSON.stringify(packageJson, null, 2) + "\n");
  }
} catch (error) {
  console.error(error);
  process.exit(1);
}
