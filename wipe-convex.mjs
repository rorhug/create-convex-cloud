import { createInterface } from "readline/promises";
import { spawnSync } from "child_process";
import { randomInt } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.argv.includes("--prod");
const isHelp = process.argv.includes("--help") || process.argv.includes("-h");

if (isHelp) {
  console.log(`Usage:
  node wipe-convex.mjs
  node wipe-convex.mjs --prod

Behavior:
  - Dev: requires typing YES
  - Prod: requires typing YES and solving an addition challenge

Examples:
  npm run wipe:convex
  npm run wipe:convex:prod`);
  process.exit(0);
}

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error("This script requires an interactive terminal.");
  process.exit(1);
}

function createEmptyZip(zipPath) {
  const result = spawnSync(
    "python3",
    [
      "-c",
      [
        "import sys, zipfile",
        "zipfile.ZipFile(sys.argv[1], 'w').close()",
      ].join("; "),
      zipPath,
    ],
    { stdio: "inherit" },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error("Failed to create empty ZIP file.");
  }
}

async function confirmDangerousOperation() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const target = isProd ? "production" : "development";
    console.log(`About to delete all data from the ${target} Convex deployment.`);
    console.log("This uses `npx convex import --replace-all` with an empty ZIP.");
    console.log("This action is destructive.");

    const confirmation = await rl.question("Type YES to continue: ");
    if (confirmation !== "YES") {
      throw new Error("Confirmation failed. Aborting.");
    }

    if (isProd) {
      const a = randomInt(111, 1000);
      const b = randomInt(111, 1000);
      const answer = await rl.question(`Production safeguard: what is ${a} + ${b}? `);
      if (Number.parseInt(answer, 10) !== a + b) {
        throw new Error("Addition check failed. Aborting.");
      }
    }
  } finally {
    rl.close();
  }
}

async function main() {
  await confirmDangerousOperation();

  const zipPath = path.join(os.tmpdir(), `convex-empty-${Date.now()}.zip`);
  createEmptyZip(zipPath);

  const args = ["convex", "import", "--replace-all", "-y"];
  if (isProd) {
    args.push("--prod");
  }
  args.push(zipPath);

  try {
    const result = spawnSync("npx", args, {
      cwd: __dirname,
      stdio: "inherit",
    });

    if (result.error) {
      throw result.error;
    }

    process.exit(result.status ?? 1);
  } finally {
    fs.rmSync(zipPath, { force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
