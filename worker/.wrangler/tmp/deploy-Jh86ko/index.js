var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
async function signToken(secret, payload) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );
  const sigHex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${payload}.${sigHex}`;
}
__name(signToken, "signToken");
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
__name(json, "json");
async function handleActivate(request, env) {
  const { code, fingerprint } = await request.json();
  if (!code || !fingerprint) {
    return json({ success: false, error: "\u7F3A\u5C11 code \u6216 fingerprint" }, 400);
  }
  const trimmed = code.trim();
  if (trimmed.length < 8) {
    return json({ success: false, error: "\u6FC0\u6D3B\u7801\u683C\u5F0F\u65E0\u6548" }, 400);
  }
  const act = await env.DB.prepare(
    "SELECT id, status, max_devices, expires_at FROM activations WHERE code = ?"
  ).bind(trimmed).first();
  if (!act) {
    return json({ success: false, error: "\u6FC0\u6D3B\u7801\u4E0D\u5B58\u5728" });
  }
  if (act.status !== "active") {
    if (act.status === "revoked") {
      return json({ success: false, error: "\u6FC0\u6D3B\u7801\u5DF2\u88AB\u64A4\u9500" });
    }
    return json({ success: false, error: "\u6FC0\u6D3B\u7801\u5DF2\u5931\u6548" });
  }
  if (act.expires_at && new Date(act.expires_at) < /* @__PURE__ */ new Date()) {
    return json({ success: false, error: "\u6FC0\u6D3B\u7801\u5DF2\u8FC7\u671F" });
  }
  const existing = await env.DB.prepare(
    "SELECT fingerprint, id FROM devices WHERE activation_id = ?"
  ).bind(act.id).all();
  let deviceRecord = existing.results.find((d) => d.fingerprint === fingerprint);
  if (deviceRecord) {
    await env.DB.prepare(
      "UPDATE devices SET last_seen_at = datetime('now') WHERE id = ?"
    ).bind(deviceRecord.id).run();
  } else {
    if (existing.results.length >= act.max_devices) {
      return json({ success: false, error: `\u8BE5\u6FC0\u6D3B\u7801\u5DF2\u7ED1\u5B9A ${act.max_devices} \u53F0\u8BBE\u5907` });
    }
    const result = await env.DB.prepare(
      "INSERT INTO devices (activation_id, fingerprint) VALUES (?, ?)"
    ).bind(act.id, fingerprint).run();
    deviceRecord = { fingerprint, id: result.meta.last_row_id };
  }
  const secret = env.ACTIVATION_SECRET || "dev-secret-change-me";
  const payload = JSON.stringify({
    code: trimmed,
    fp: fingerprint,
    iat: Date.now()
  });
  const token = await signToken(secret, payload);
  return json({
    success: true,
    token,
    max_devices: act.max_devices,
    expires_at: act.expires_at
  });
}
__name(handleActivate, "handleActivate");
async function handleValidate(request, env) {
  const { code, fingerprint } = await request.json();
  if (!code || !fingerprint) {
    return json({ success: false, error: "\u7F3A\u5C11 code \u6216 fingerprint" }, 400);
  }
  const act = await env.DB.prepare(
    "SELECT id, status, max_devices, expires_at FROM activations WHERE code = ?"
  ).bind(code.trim()).first();
  if (!act) {
    return json({ success: false, error: "\u6FC0\u6D3B\u7801\u4E0D\u5B58\u5728" });
  }
  if (act.status !== "active") {
    return json({ success: false, error: `\u6FC0\u6D3B\u7801\u72B6\u6001: ${act.status}` });
  }
  if (act.expires_at && new Date(act.expires_at) < /* @__PURE__ */ new Date()) {
    return json({ success: false, error: "\u6FC0\u6D3B\u7801\u5DF2\u8FC7\u671F" });
  }
  const device = await env.DB.prepare(
    "SELECT id FROM devices WHERE activation_id = ? AND fingerprint = ?"
  ).bind(act.id, fingerprint).first();
  if (!device) {
    return json({ success: false, error: "\u8BBE\u5907\u672A\u7ED1\u5B9A" });
  }
  await env.DB.prepare(
    "UPDATE devices SET last_seen_at = datetime('now') WHERE id = ?"
  ).bind(device.id).run();
  const secret = env.ACTIVATION_SECRET || "dev-secret-change-me";
  const payload = JSON.stringify({
    code: code.trim(),
    fp: fingerprint,
    iat: Date.now()
  });
  const token = await signToken(secret, payload);
  return json({
    success: true,
    token,
    max_devices: act.max_devices,
    expires_at: act.expires_at
  });
}
__name(handleValidate, "handleValidate");
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }
    const cors = { "Access-Control-Allow-Origin": "*" };
    try {
      if (url.pathname === "/api/activate" && request.method === "POST") {
        const res = await handleActivate(request, env);
        return new Response(res.body, { status: res.status, headers: { ...Object.fromEntries(res.headers), ...cors } });
      }
      if (url.pathname === "/api/validate" && request.method === "POST") {
        const res = await handleValidate(request, env);
        return new Response(res.body, { status: res.status, headers: { ...Object.fromEntries(res.headers), ...cors } });
      }
      return json({ error: "Not Found" }, 404);
    } catch (e) {
      return json({ success: false, error: e.message || "\u5185\u90E8\u9519\u8BEF" }, 500);
    }
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
