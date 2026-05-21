const { createReadStream } = require("node:fs");
const fs = require("node:fs");
const path = require("node:path");
const dayjs = require("dayjs");

const root = path.resolve(__dirname, "..");

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

function findFiles(dir, pattern) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => pattern.test(f)).map((f) => path.join(dir, f));
}

function pickVersioned(files, version) {
  return files.find(f => path.basename(f).includes(version)) || files[0] || null;
}

function readSig(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf-8").trim();
}

function readLocalVersionTemplate() {
  const versionPath = path.join(root, "public/version.json");
  if (!fs.existsSync(versionPath))
    return {};
  try {
    return JSON.parse(fs.readFileSync(versionPath, "utf-8"));
  }
  catch {
    return {};
  }
}

async function apiPost(apiBase, secret, urlPath, body) {
  const headers = { Authorization: `Bearer ${secret}` };
  if (!(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }
  const resp = await fetch(`${apiBase}${urlPath}`, { method: "POST", headers, body });
  return resp.json();
}

async function uploadFile(apiBase, secret, filePath, remotePath, overwrite, makePublic) {
  const form = new FormData();
  const buf = fs.readFileSync(filePath);
  form.append("file", new Blob([buf]), path.basename(filePath));
  form.append("path", remotePath);
  if (overwrite) form.append("overwrite", "true");
  if (makePublic) form.append("public", "true");

  const resp = await fetch(`${apiBase}/api/admin/files/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
    body: form,
  });
  const data = await resp.json();
  if (!data.success) throw new Error(`upload failed ${filePath}: ${data.error}`);
  return data.file;
}

async function uploadPlatform(apiBase, secret, label, latestPath, archivePath, manualFile, updaterFile) {
  console.log(`\n=== ${label} ===`);
  const sameFile = manualFile && updaterFile && path.resolve(manualFile) === path.resolve(updaterFile);

  if (manualFile) {
    console.log(`  uploading manual: ${path.basename(manualFile)} → ${latestPath}`);
    await uploadFile(apiBase, secret, manualFile, latestPath, true, true);
  }
  if (updaterFile && !sameFile) {
    console.log(`  uploading updater: ${path.basename(updaterFile)} → ${latestPath}`);
    await uploadFile(apiBase, secret, updaterFile, latestPath, true, true);
  }

  if (manualFile) {
    console.log(`  archiving manual: ${archivePath}`);
    await uploadFile(apiBase, secret, manualFile, archivePath, false, true);
  }
  if (updaterFile && !sameFile) {
    console.log(`  archiving updater: ${archivePath}`);
    await uploadFile(apiBase, secret, updaterFile, archivePath, false, true);
  }

  const manualName = manualFile ? path.basename(manualFile) : null;
  const updaterName = updaterFile ? path.basename(updaterFile) : null;

  return {
    manualUrl: manualName ? `${apiBase}/api/files/${encodeURIComponent(latestPath + "/" + manualName)}` : null,
    updaterUrl: updaterName ? `${apiBase}/api/files/${encodeURIComponent(latestPath + "/" + updaterName)}` : null,
  };
}

async function main() {
  loadEnv(path.join(root, ".env.release"));

  const apiBase = process.env.ADMIN_API_BASE || "https://profit-admin.xu-wei.space";
  const secret = process.env.ADMIN_SECRET || "";
  if (!secret) {
    console.error("missing ADMIN_SECRET in .env.release");
    process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8"));
  const version = pkg.version;
  const localVersionTemplate = readLocalVersionTemplate();

  const now = dayjs();
  const ts = now.format("YYYY-MM-DD_HH-mm-ss");
  const isoDate = now.toISOString();

  const bundleDir = path.join(root, "src-tauri/target/release/bundle");

  const macDmg = pickVersioned(findFiles(path.join(bundleDir, "dmg"), /\.dmg$/), version);
  const macTarGz = findFiles(path.join(bundleDir, "macos"), /\.app\.tar\.gz$/)[0] || null;
  const macSig = findFiles(path.join(bundleDir, "macos"), /\.app\.tar\.gz\.sig$/)[0] || null;

  const winExe = pickVersioned(findFiles(path.join(bundleDir, "nsis"), /\.exe$/), version);
  const winExeSig = pickVersioned(findFiles(path.join(bundleDir, "nsis"), /\.exe\.sig$/), version);
  const winNsisZip = pickVersioned(findFiles(path.join(bundleDir, "nsis"), /\.nsis\.zip$/), version);
  const winNsisSig = pickVersioned(findFiles(path.join(bundleDir, "nsis"), /\.nsis\.zip\.sig$/), version);
  const useWinNsisZip = winNsisZip && winNsisSig;
  const useWinExe = winExe && winExeSig;
  const winUpdater = useWinNsisZip ? winNsisZip : (useWinExe ? winExe : null);
  const winSig = useWinNsisZip ? winNsisSig : (useWinExe ? winExeSig : null);

  console.log("\n=== artifacts ===");
  console.log(`mac dmg: ${macDmg || "not found"}`);
  console.log(`mac updater: ${macTarGz || "not found"}`);
  console.log(`mac sig: ${macSig || "not found"}`);
  console.log(`win exe: ${winExe || "not found"}`);
  console.log(`win updater: ${winUpdater || "not found"}`);
  console.log(`win sig: ${winSig || "not found"}`);

  const macLatest = "releases/mac";
  const macArchive = `releases/archive/${ts}_mac`;
  const winLatest = "releases/windows";
  const winArchive = `releases/archive/${ts}_windows`;

  let macUrls = null;
  let winUrls = null;

  if (macDmg || macTarGz) {
    macUrls = await uploadPlatform(apiBase, secret, "macOS", macLatest, macArchive, macDmg, macTarGz);
  }
  if (winExe || winUpdater) {
    winUrls = await uploadPlatform(apiBase, secret, "Windows", winLatest, winArchive, winExe, winUpdater);
  }

  if (!macUrls && !winUrls) {
    console.error("no release artifacts found for any platform, refusing to upload empty version.json");
    process.exit(1);
  }

  const macSignature = readSig(macSig);
  const winSignature = readSig(winSig);

  const versionJson = {
    version,
    force: localVersionTemplate.force ?? false,
    notes: localVersionTemplate.notes || "",
    pub_date: isoDate,
    manual: {},
    platforms: {},
  };

  if (macUrls) {
    if (macUrls.manualUrl) {
      versionJson.manual["darwin-aarch64"] = { url: macUrls.manualUrl };
    }
    if (macUrls.updaterUrl && macSignature) {
      versionJson.platforms["darwin-aarch64"] = {
        signature: macSignature,
        url: macUrls.updaterUrl,
      };
    }
  }

  if (winUrls) {
    if (winUrls.manualUrl) {
      versionJson.manual["windows-x86_64"] = { url: winUrls.manualUrl };
    }
    if (winUrls.updaterUrl && winSignature) {
      versionJson.platforms["windows-x86_64"] = {
        signature: winSignature,
        url: winUrls.updaterUrl,
      };
    }
  }

  const localVersionPath = path.join(root, "public/version.json");
  fs.writeFileSync(localVersionPath, JSON.stringify(versionJson, null, 2) + "\n", "utf-8");
  console.log("\n  ✓  public/version.json generated locally (template + last release snapshot)");

  const versionForm = new FormData();
  versionForm.append("file", new Blob([JSON.stringify(versionJson, null, 2)]), "version.json");
  versionForm.append("path", "releases");
  versionForm.append("overwrite", "true");
  versionForm.append("public", "true");
  const versionResp = await fetch(`${apiBase}/api/admin/files/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
    body: versionForm,
  });
  const versionData = await versionResp.json();
  if (versionData.success) {
    console.log(`  ✓  version.json uploaded → ${apiBase}/api/files/releases/version.json`);
  } else {
    console.error(`  ✗  version.json upload failed: ${versionData.error}`);
  }

  console.log("\n=== DONE ===");
  console.log(`version: ${version}`);
  console.log(`mac:  ${macUrls ? "uploaded" : "skipped"}`);
  console.log(`win:  ${winUrls ? "uploaded" : "skipped"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
