/** 图片本地存储服务。 Tauri: 保存到 app 数据目录下的 images 文件夹。 Web: 仅保存 base64，不写文件。 */

import dayjs from "dayjs";

let imageDir = "";

async function getImageDir() {
  if (imageDir)
    return imageDir;
  try {
    const { appDataDir } = await import("@tauri-apps/api/path");
    const { exists, mkdir } = await import("@tauri-apps/plugin-fs");
    const base = await appDataDir();
    const dir = `${base}images`;
    if (!(await exists(dir)))
      await mkdir(dir, { recursive: true });
    imageDir = dir;
    return dir;
  }
  catch {
    imageDir = "";
    return "";
  }
}

/** 保存 base64 图片到本地，返回文件路径。 Web 环境返回空字符串。 */
export async function saveImage(base64) {
  if (!base64 || !base64.startsWith("data:image/"))
    return "";
  const dir = await getImageDir();
  if (!dir)
    return "";

  try {
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const ext = base64.includes("image/png")
      ? "png"
      : base64.includes("image/jpeg")
        ? "jpg"
        : "png";
    const b64 = base64.split(",")[1];
    const id = `${dayjs().valueOf()}_${Math.random().toString(36).slice(2, 8)}`;
    const filename = `${id}.${ext}`;
    const filepath = `${dir}/${filename}`;

    const binary = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    await writeFile(filepath, binary);
    return filepath;
  }
  catch {
    return "";
  }
}

/** 从本地路径读取图片，返回 base64 data URL（仅用于应用内预览）。 */
export async function loadImageAsBase64(filepath) {
  const bytes = await readImageBytes(filepath);
  if (!bytes)
    return "";
  const ext = filepath.endsWith(".jpg") || filepath.endsWith(".jpeg") ? "jpeg" : "png";
  const b64 = btoa(String.fromCharCode(...bytes));
  return `data:image/${ext};base64,${b64}`;
}

/** 读取图片文件的原始字节（ExcelJS 嵌入用）。 */
export async function readImageBytes(filepath) {
  if (!filepath)
    return null;
  try {
    const { readFile } = await import("@tauri-apps/plugin-fs");
    return await readFile(filepath);
  }
  catch {
    return null;
  }
}

/** 获取 Tauri asset URL 用于直接显示图片（不经过 base64）。 */
export async function getImageUrl(filepath) {
  if (!filepath)
    return "";
  try {
    const { convertFileSrc } = await import("@tauri-apps/api/core");
    return convertFileSrc(filepath);
  }
  catch {
    return "";
  }
}
