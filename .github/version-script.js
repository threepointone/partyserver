const fs = require("fs");
const { exec } = require("child_process");

try {
  exec("git rev-parse --short HEAD", (err, stdout) => {
    if (err) {
      console.log(err);
      process.exit(1);
    }
    for (const path of ["./packages/partyflare/package.json"]) {
      const packageJson = JSON.parse(fs.readFileSync(path));
      packageJson.version = "0.0.0-" + stdout.trim();
      fs.writeFileSync(path, JSON.stringify(packageJson, null, 2) + "\n");
    }
  });
} catch (error) {
  console.error(error);
  process.exit(1);
}
