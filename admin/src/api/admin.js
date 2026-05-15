const API_BASE = "https://profit-api.xu-wei.space";

function getHeaders() {
  const secret = localStorage.getItem("admin-secret") || "";
  return {
    "Authorization": `Bearer ${secret}`,
    "Content-Type": "application/json",
  };
}

async function request(path, body) {
  const resp = await fetch(`${API_BASE}${path}`, {
    body: JSON.stringify(body),
    headers: getHeaders(),
    method: "POST",
  });
  return resp.json();
}

export async function listCodes(filter = "all") {
  const resp = await fetch(`${API_BASE}/api/admin/list?filter=${filter}`, {
    headers: getHeaders(),
    method: "POST",
  });
  return resp.json();
}

export function createCodes({ count = 1, expires_in, max_devices = 1 }) {
  return request("/api/admin/create", { count, expires_in, max_devices });
}

export function deleteCode(code) {
  return request("/api/admin/delete", { code });
}

export function checkCode(code) {
  return request("/api/admin/check", { code });
}
