// Int-Messager v4.11.5a — semantic theme audit.

import fs from "node:fs";
import process from "node:process";

const app = fs.readFileSync("client/src/App.jsx", "utf8");
const imports = [...app.matchAll(/import\s+["'](.+?\.css)["'];/g)].map((match) => match[1]);

const authority = "./styles/theme-authority-v4115.css";

if (!imports.includes(authority)) {
  process.stderr.write("Missing theme authority import.\n");
  process.exitCode = 1;
}

if (imports[imports.length - 1] !== authority) {
  process.stderr.write(
    `Theme authority must be last. Last CSS import is ${imports[imports.length - 1]}\n`
  );
  process.exitCode = 1;
}

if (app.includes('className="wa-icon-btn wa-close-chat-btn"')) {
  process.stderr.write("Header close-chat X is still present.\n");
  process.exitCode = 1;
}

if (!process.exitCode) {
  process.stdout.write("v4.11.5 theme audit: OK\n");
  process.stdout.write("Theme authority is the final global stylesheet.\n");
  process.stdout.write("Header X / Close chat button removed.\n");
}
