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
