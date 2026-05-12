import { appDataDir, join } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { exists, mkdir, readFile, remove, writeFile } from "@tauri-apps/plugin-fs";
import { ref } from "vue";

const imageDir = ref("");
const initialized = ref(false);
const dataUrlCache = new Map();

function isURL(str) {
  return /^https?:\/\//i.test(str);
}

function extFromPath(path) {
  const idx = path.lastIndexOf(".");
  return idx > -1 ? path.slice(idx + 1).toLowerCase() : "png";
}

function mimeFromExt(ext) {
  const map = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    svg: "image/svg+xml",
    ico: "image/x-icon",
  };
  return map[ext] || "image/png";
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function initImageDir() {
  if (initialized.value) return;
  const dir = await join(await appDataDir(), "images");
  imageDir.value = dir;
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
  initialized.value = true;
}

async function pickImages() {
  await initImageDir();
  const selected = await open({
    title: "选择图片",
    filters: [
      {
        name: "图片",
        extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico"],
      },
    ],
    multiple: true,
  });
  if (!selected) return [];
  const paths = Array.isArray(selected) ? selected : [selected];
  return paths.map((p) => (typeof p === "string" ? p : p.path));
}

async function addImages(sourcePaths) {
  await initImageDir();
  const newPaths = [];
  for (const src of sourcePaths) {
    const fileName = `${uid()}.${extFromPath(src)}`;
    const dest = await join(imageDir.value, fileName);
    const bytes = await readFile(src);
    await writeFile(dest, bytes);
    newPaths.push(dest);
  }
  return newPaths;
}

async function readLocalImageAsDataUrl(imagePath) {
  if (dataUrlCache.has(imagePath)) {
    return dataUrlCache.get(imagePath);
  }
  try {
    const bytes = await readFile(imagePath);
    const ext = extFromPath(imagePath);
    const mime = mimeFromExt(ext);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const dataUrl = `data:${mime};base64,${btoa(binary)}`;
    dataUrlCache.set(imagePath, dataUrl);
    return dataUrl;
  } catch {
    return "";
  }
}

async function removeLocalImage(imagePath) {
  dataUrlCache.delete(imagePath);
  try {
    await remove(imagePath);
  } catch {
    // ignore if file doesn't exist
  }
}

async function getImageUrls(imagesString) {
  if (!imagesString || typeof imagesString !== "string") return [];
  const parts = imagesString
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const result = [];
  for (const p of parts) {
    if (isURL(p)) {
      result.push(p);
    } else {
      const dataUrl = await readLocalImageAsDataUrl(p);
      if (dataUrl) result.push(dataUrl);
    }
  }
  return result;
}

function clearCache() {
  dataUrlCache.clear();
}

export function useImageHost() {
  return {
    initImageDir,
    pickImages,
    addImages,
    readLocalImageAsDataUrl,
    removeLocalImage,
    getImageUrls,
    clearCache,
    isURL,
  };
}
