const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const clientRoot = path.join(root, "client");
const nodeCommand = process.execPath;

function exitFromResult(label, result) {
  if (result.error) {
    console.error(`${label} could not start:`, result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`\n${label} failed.`);
    process.exit(result.status || 1);
  }
}

function runNode(label, args, cwd = root) {
  console.log(`\n=== ${label} ===`);

  const result = spawnSync(nodeCommand, args, {
    cwd,
    stdio: "inherit",
    shell: false,
  });

  exitFromResult(label, result);
}

function runNpm(label, args, cwd = root) {
  console.log(`\n=== ${label} ===`);

  // On Windows, directly spawning npm.cmd can fail with EINVAL on some
  // Node/npm combinations. Running npm through the system shell avoids that.
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: true,
  });

  exitFromResult(label, result);
}

runNode("Server syntax check", ["--check", "server.js"]);
runNpm("ESLint", ["run", "lint"]);
runNpm("Client production build", ["run", "build"], clientRoot);

console.log("\nAll validation checks passed.");
