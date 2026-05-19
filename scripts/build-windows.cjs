const { execSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

// 1. sync version
execSync("node scripts/sync-version.cjs", { cwd: root, stdio: "inherit" });

// 2. load private key if exists
const keyPath = path.join(root, "src-tauri/profit-updater.key");
const env = { ...process.env };
if (fs.existsSync(keyPath)) {
  env.TAURI_SIGNING_PRIVATE_KEY = fs.readFileSync(keyPath, "utf-8").trim();
  env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "";
  console.log("  ✓  updater private key loaded");
}

// 3. run tauri build for NSIS
const buildResult = spawnSync("npx", ["tauri", "build", "--bundles", "nsis"], {
  cwd: root,
  env,
  stdio: "inherit",
});

if (buildResult.status !== 0) {
  console.error("tauri build failed");
  process.exit(buildResult.status);
}

// 4. verify output artifacts exist
function findFilesRecursive(dir, pattern) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  function walk(d) {
    try {
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) { walk(full); }
        else if (pattern.test(e.name)) { results.push(full); }
      }
    } catch { /* skip */ }
  }
  walk(dir);
  return results;
}

const targetDir = path.join(root, "src-tauri/target");

const exes = findFilesRecursive(targetDir, /\.exe$/);
const nsisZips = findFilesRecursive(targetDir, /\.nsis\.zip$/);
const sigs = findFilesRecursive(targetDir, /\.nsis\.zip\.sig$/);

console.log(`\n  .exe files found: ${exes.length}`);
console.log(`  .nsis.zip files found: ${nsisZips.length}`);
console.log(`  .nsis.zip.sig files found: ${sigs.length}`);

if (exes.length === 0) {
  console.error("no .exe found under src-tauri/target");
  console.error("listing target directory:");
  try {
    function listAll(d, indent = "") {
      try {
        const entries = fs.readdirSync(d, { withFileTypes: true });
        for (const e of entries) {
          const full = path.join(d, e.name);
          console.error(indent + (e.isDirectory() ? `[${e.name}]` : e.name));
          if (e.isDirectory()) listAll(full, indent + "  ");
        }
      } catch { /* skip */ }
    }
    listAll(targetDir);
  } catch { /* skip */ }
  process.exit(1);
}

if (nsisZips.length === 0) {
  console.error("no .nsis.zip found under src-tauri/target");
  process.exit(1);
}

if (sigs.length === 0) {
  console.error("no .nsis.zip.sig found under src-tauri/target");
  process.exit(1);
}

console.log("  ✓  all Windows artifacts verified");
