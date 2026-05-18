function getApiBase() {
  return localStorage.getItem("admin-api-base") || import.meta.env.VITE_API_BASE || "";
}

function getHeaders() {
  const secret = localStorage.getItem("admin-secret") || "";
  return {
    "Authorization": `Bearer ${secret}`,
    "Content-Type": "application/json",
  };
}

async function request(path, body) {
  const resp = await fetch(`${getApiBase()}${path}`, {
    body: JSON.stringify(body),
    headers: getHeaders(),
    method: "POST",
  });
  return resp.json();
}

export async function listCodes(filter = "all") {
  const resp = await fetch(`${getApiBase()}/api/admin/list?filter=${filter}`, {
    headers: getHeaders(),
    method: "POST",
  });
  return resp.json();
}

export function createCodes({ count = 1, expires_in, max_devices = 1, remark }) {
  return request("/api/admin/create", { count, expires_in, max_devices, remark });
}

export function deleteCode(code) {
  return request("/api/admin/delete", { code });
}

export function updateCode(code, updates) {
  return request("/api/admin/update", { code, ...updates });
}

export function checkCode(code) {
  return request("/api/admin/check", { code });
}

export function updateRemark(code, remark) {
  return request("/api/admin/remark", { code, remark });
}

export function getTemplate() {
  return request("/api/admin/template", { action: "get" });
}

export function saveTemplate(value) {
  return request("/api/admin/template", { action: "save", value });
}

// ===== 文件管理 =====

export async function listFiles(filePath) {
  const resp = await fetch(`${getApiBase()}/api/admin/files/list`, {
    body: JSON.stringify({ path: filePath || "" }),
    headers: getHeaders(),
    method: "POST",
  });
  return resp.json();
}

export function createFolder(name, parentPath) {
  return request("/api/admin/files/folder", { name, path: parentPath || "" });
}

export async function uploadFile(file, filePath, overwrite = false) {
  const formData = new FormData();
  formData.append("file", file);
  if (filePath) {
    formData.append("path", filePath);
  }
  if (overwrite) {
    formData.append("overwrite", "true");
  }

  const resp = await fetch(`${getApiBase()}/api/admin/files/upload`, {
    body: formData,
    headers: { Authorization: getHeaders().Authorization },
    method: "POST",
  });
  return resp.json();
}

export function renameFile(id, name) {
  return request("/api/admin/files/rename", { id, name });
}

export function toggleFilePublic(id) {
  return request("/api/admin/files/toggle-public", { id });
}

export function deleteFile(id) {
  return request("/api/admin/files/delete", { id });
}

export function getFileDownloadUrl(r2Key) {
  return `${getApiBase()}/api/files/${encodeURI(r2Key)}`;
}

export async function downloadFile(id, filename) {
  const resp = await fetch(`${getApiBase()}/api/admin/files/download`, {
    body: JSON.stringify({ id }),
    headers: getHeaders(),
    method: "POST",
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "下载失败" }));
    return { error: err.error, success: false };
  }
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return { success: true };
}
