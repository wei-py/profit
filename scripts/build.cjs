const { execSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

// 1. sync version
execSync("node scripts/sync-version.cjs", { cwd: root, stdio: "inherit" });

// 2. read version for DMG filename
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8"));
const version = pkg.version;

// 3. unmount any existing profit DMG volumes
try {
  execSync("hdiutil detach /Volumes/profit", { stdio: "ignore" });
  console.log("  ✓  unmounted previous DMG volume");
}
catch { /* no volume mounted */ }

// 4. clean old temp DMG files
const macosDir = path.join(root, "src-tauri/target/release/bundle/macos");
try {
  const oldFiles = fs.readdirSync(macosDir).filter(f => f.startsWith("rw."));
  for (const f of oldFiles) {
    fs.unlinkSync(path.join(macosDir, f));
    console.log(`  ✓  cleaned old temp DMG: ${f}`);
  }
}
catch { /* no macos dir */ }

// 5. load private key if exists
const keyPath = path.join(root, "src-tauri/profit-updater.key");
const env = { ...process.env };
if (fs.existsSync(keyPath)) {
  env.TAURI_SIGNING_PRIVATE_KEY = fs.readFileSync(keyPath, "utf-8").trim();
  env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "";
  console.log("  ✓  updater private key loaded");
}

// 6. run tauri build
const args = process.argv.slice(2);
const buildResult = spawnSync("npx", ["tauri", "build", ...args], {
  cwd: root,
  env,
  stdio: "inherit",
});

// 7. fallback: if no final .dmg was produced but rw.*.dmg exists, convert it
const dmgDir = path.join(root, "src-tauri/target/release/bundle/dmg");
try {
  const dmgFiles = fs.readdirSync(dmgDir).filter(f => f.endsWith(".dmg"));
  if (dmgFiles.length === 0) {
    const rwFiles = fs.readdirSync(macosDir).filter(f => f.startsWith("rw.") && f.endsWith(".dmg"));
    if (rwFiles.length > 0) {
      const rwPath = path.join(macosDir, rwFiles[0]);
      const finalName = `profit_${version}_aarch64.dmg`;
      const finalPath = path.join(dmgDir, finalName);
      console.log(`  …  converting temp DMG → ${finalName}`);
      execSync(`hdiutil convert "${rwPath}" -format UDZO -o "${finalPath}"`, { stdio: "inherit" });
      fs.unlinkSync(rwPath);
      console.log(`  ✓  ${finalName}`);
    }
  }
}
catch { /* ignore */ }

process.exit(buildResult.status);
