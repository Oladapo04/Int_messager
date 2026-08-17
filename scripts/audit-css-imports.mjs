// Int-Messager v4.11.5a — CSS import audit.
// Run from the project root: node scripts/audit-css-imports.mjs

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const appPath = path.resolve("client/src/App.jsx");
const source = fs.readFileSync(appPath, "utf8");
const imports = [...source.matchAll(/import\s+["'](.+?\.css)["'];/g)].map((match) => match[1]);

const retired = [
  "./styles/dark-mode-v491.css",
  "./styles/dark-mode-visibility-v4113.css",
  "./styles/dark-mode-contrast-v4114.css",
  "./styles/dark-mode-critical-text-v4115.css",
  "./styles/dark-mode-settings-chat-v4116.css",
  "./styles/admin-dashboard-v490.css",
  "./styles/admin-dashboard-v493.css",
];

process.stdout.write(`Global CSS imports: ${imports.length}\n`);
for (const file of imports) {
  process.stdout.write(`  ${file}\n`);
}

const stillGlobal = retired.filter((file) => imports.includes(file));

if (stillGlobal.length) {
  process.stderr.write("\nRetired/globalized CSS still imported:\n");
  for (const file of stillGlobal) {
    process.stderr.write(`  ${file}\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write("\nCSS architecture check: OK\n");
  process.stdout.write("Retired dark-mode layers are gone from App.jsx.\n");
  process.stdout.write("Admin Dashboard CSS is no longer part of the initial App CSS graph.\n");
}
