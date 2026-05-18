const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

const pkgPath = path.join(root, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
const version = pkg.version;

function replaceVersion(filePath, pattern, replacement) {
  const content = fs.readFileSync(filePath, "utf-8");
  if (!pattern.test(content)) {
    console.log(`  skip ${path.relative(root, filePath)} (pattern not found)`);
    return;
  }
  const updated = content.replace(pattern, replacement);
  fs.writeFileSync(filePath, updated, "utf-8");
  console.log(`  ✓  ${path.relative(root, filePath)} → ${version}`);
}

// src-tauri/tauri.conf.json
replaceVersion(
  path.join(root, "src-tauri/tauri.conf.json"),
  /"version":\s*"[^"]*"/,
  `"version": "${version}"`,
);

// src-tauri/Cargo.toml
replaceVersion(
  path.join(root, "src-tauri/Cargo.toml"),
  /^version\s*=\s*"[^"]*"/m,
  `version = "${version}"`,
);

// public/version.json
replaceVersion(
  path.join(root, "public/version.json"),
  /"version":\s*"[^"]*"/,
  `"version": "${version}"`,
);

console.log(`\nversion synced to: ${version}`);
