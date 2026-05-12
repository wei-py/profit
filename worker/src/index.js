/** Profit 激活验证 API 部署于 Cloudflare Workers，D1 存储激活码与设备绑定 */

// 用 HMAC-SHA256 签发设备令牌
async function signToken(secret, payload) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      hash: "SHA-256",
      name: "HMAC",
    },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const sigHex = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
  return `${payload}.${sigHex}`;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

// ===== 端点 =====

async function handleActivate(request, env) {
  const { code, fingerprint } = await request.json();
  if (!code || !fingerprint) {
    return json(
      {
        error: "缺少 code 或 fingerprint",
        success: false,
      },
      400,
    );
  }

  const trimmed = code.trim();
  if (trimmed.length < 8) {
    return json(
      {
        error: "激活码格式无效",
        success: false,
      },
      400,
    );
  }

  // 查激活码
  const act = await env.DB.prepare(
    "SELECT id, status, max_devices, expires_at FROM activations WHERE code = ?",
  )
    .bind(trimmed)
    .first();

  if (!act) {
    return json({
      error: "激活码不存在",
      success: false,
    });
  }

  if (act.status !== "active") {
    if (act.status === "revoked") {
      return json({
        error: "激活码已被撤销",
        success: false,
      });
    }
    return json({
      error: "激活码已失效",
      success: false,
    });
  }

  if (act.expires_at && new Date(act.expires_at) < new Date()) {
    return json({
      error: "激活码已过期",
      success: false,
    });
  }

  // 查已有设备绑定数
  const existing = await env.DB.prepare(
    "SELECT fingerprint, id FROM devices WHERE activation_id = ?",
  )
    .bind(act.id)
    .all();

  let deviceRecord = existing.results.find(d => d.fingerprint === fingerprint);

  if (deviceRecord) {
    // 已绑定设备 — 刷新 last_seen_at
    await env.DB.prepare("UPDATE devices SET last_seen_at = datetime('now') WHERE id = ?")
      .bind(deviceRecord.id)
      .run();
  }
  else {
    // 检查是否超出设备数
    if (existing.results.length >= act.max_devices) {
      return json({
        error: `该激活码已绑定 ${act.max_devices} 台设备`,
        success: false,
      });
    }
    // 绑定新设备
    const result = await env.DB.prepare(
      "INSERT INTO devices (activation_id, fingerprint) VALUES (?, ?)",
    )
      .bind(act.id, fingerprint)
      .run();
    deviceRecord = {
      fingerprint,
      id: result.meta.last_row_id,
    };
  }

  // 签发令牌（1 小时有效期，在线时每次校验刷新）
  const secret = env.ACTIVATION_SECRET || "dev-secret-change-me";
  const payload = JSON.stringify({
    code: trimmed,
    fp: fingerprint,
    iat: Date.now(),
  });
  const token = await signToken(secret, payload);

  return json({
    expires_at: act.expires_at,
    max_devices: act.max_devices,
    success: true,
    token,
  });
}

async function handleValidate(request, env) {
  const { code, fingerprint } = await request.json();
  if (!code || !fingerprint) {
    return json(
      {
        error: "缺少 code 或 fingerprint",
        success: false,
      },
      400,
    );
  }

  const act = await env.DB.prepare(
    "SELECT id, status, max_devices, expires_at FROM activations WHERE code = ?",
  )
    .bind(code.trim())
    .first();

  if (!act) {
    return json({
      error: "激活码不存在",
      success: false,
    });
  }

  if (act.status !== "active") {
    return json({
      error: `激活码状态: ${act.status}`,
      success: false,
    });
  }

  if (act.expires_at && new Date(act.expires_at) < new Date()) {
    return json({
      error: "激活码已过期",
      success: false,
    });
  }

  const device = await env.DB.prepare(
    "SELECT id FROM devices WHERE activation_id = ? AND fingerprint = ?",
  )
    .bind(act.id, fingerprint)
    .first();

  if (!device) {
    return json({
      error: "设备未绑定",
      success: false,
    });
  }

  // 刷新心跳
  await env.DB.prepare("UPDATE devices SET last_seen_at = datetime('now') WHERE id = ?")
    .bind(device.id)
    .run();

  const secret = env.ACTIVATION_SECRET || "dev-secret-change-me";
  const payload = JSON.stringify({
    code: code.trim(),
    fp: fingerprint,
    iat: Date.now(),
  });
  const token = await signToken(secret, payload);

  return json({
    expires_at: act.expires_at,
    max_devices: act.max_devices,
    success: true,
    token,
  });
}

// ===== 管理端点（受 ADMIN_SECRET 保护）=====

function checkAdmin(request, env) {
  const secret = env.ADMIN_SECRET || "1dd87b72-fc38-4058-77f2aa-a4bb9b";
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return token === secret;
}

function genCode() {
  const raw = crypto.getRandomValues(new Uint8Array(6));
  const hex = Array.from(raw)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `PFT-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

async function handleAdminCreate(request, env) {
  if (!checkAdmin(request, env))
    return json({ error: "未授权" }, 401);

  const { count = 1, expires_in, max_devices = 1 } = await request.json().catch(() => ({}));
  const created = [];

  for (let i = 0; i < Math.min(count, 100); i++) {
    const code = genCode();
    let cols = "code, max_devices";
    let vals = `'${code}', ${max_devices}`;
    let expiresVal = null;
    if (expires_in) {
      const m = expires_in.match(/^(\d+)([dmy])$/);
      let days = 365;
      if (m) {
        const num = Number.parseInt(m[1], 10);
        if (m[2] === "d")
          days = num;
        else if (m[2] === "m")
          days = num * 30;
        else if (m[2] === "y")
          days = num * 365;
      }
      cols += ", expires_at";
      expiresVal = `datetime('now', '+${days} days')`;
      vals += `, ${expiresVal}`;
    }
    await env.DB.prepare(`INSERT INTO activations (${cols}) VALUES (${vals})`).run();
    created.push({
      code,
      expires_in: expires_in || null,
      max_devices,
    });
  }

  return json({
    created,
    success: true,
  });
}

async function handleAdminDelete(request, env) {
  if (!checkAdmin(request, env))
    return json({ error: "未授权" }, 401);
  const { code } = await request.json();

  const act = await env.DB.prepare("SELECT id FROM activations WHERE code = ?").bind(code).first();
  if (!act) {
    return json({
      error: "激活码不存在",
      success: false,
    });
  }

  const { results } = await env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM devices WHERE activation_id = ?",
  )
    .bind(act.id)
    .all();
  if (results[0].cnt > 0) {
    await env.DB.prepare("UPDATE activations SET status='revoked' WHERE id = ?").bind(act.id).run();
    return json({
      action: "revoked",
      reason: `已绑定 ${results[0].cnt} 台设备`,
      success: true,
    });
  }
  await env.DB.prepare("DELETE FROM activations WHERE id = ?").bind(act.id).run();
  return json({
    action: "deleted",
    success: true,
  });
}

async function handleAdminList(request, env) {
  if (!checkAdmin(request, env))
    return json({ error: "未授权" }, 401);
  const filter = new URL(request.url).searchParams.get("filter") || "all";

  let where = "";
  if (filter === "actived")
    where = "WHERE a.status = 'active' HAVING COUNT(d.id) > 0";
  else if (filter === "inactive")
    where = "WHERE a.status = 'active' HAVING COUNT(d.id) = 0";

  const { results } = await env.DB.prepare(
    `SELECT a.code, a.status, a.max_devices, a.created_at, a.expires_at,
            COUNT(d.id) AS used,
            a.max_devices - COUNT(d.id) AS remaining
     FROM activations a
     LEFT JOIN devices d ON d.activation_id = a.id
     ${where}
     GROUP BY a.id
     ORDER BY a.created_at DESC`,
  ).all();

  return json({
    codes: results,
    success: true,
  });
}

async function handleAdminCheck(request, env) {
  if (!checkAdmin(request, env))
    return json({ error: "未授权" }, 401);
  const { code } = await request.json();

  const act = await env.DB.prepare(
    `SELECT a.code, a.status, a.max_devices, a.created_at, a.expires_at,
            COUNT(d.id) AS used,
            a.max_devices - COUNT(d.id) AS remaining
     FROM activations a
     LEFT JOIN devices d ON d.activation_id = a.id
     WHERE a.code = ?
     GROUP BY a.id`,
  )
    .bind(code)
    .first();

  if (!act) {
    return json({
      error: "激活码不存在",
      success: false,
    });
  }

  const { results: devices } = await env.DB.prepare(
    `SELECT d.fingerprint, d.bound_at, d.last_seen_at
     FROM devices d JOIN activations a ON a.id = d.activation_id
     WHERE a.code = ? ORDER BY d.bound_at`,
  )
    .bind(code)
    .all();

  return json({
    code: act,
    devices,
    success: true,
  });
}

// ===== 入口 =====

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS 预检
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Origin": "*",
        },
        status: 204,
      });
    }

    const cors = { "Access-Control-Allow-Origin": "*" };

    try {
      if (url.pathname === "/api/activate" && request.method === "POST") {
        const res = await handleActivate(request, env);
        return new Response(res.body, {
          headers: {
            ...Object.fromEntries(res.headers),
            ...cors,
          },
          status: res.status,
        });
      }
      if (url.pathname === "/api/validate" && request.method === "POST") {
        const res = await handleValidate(request, env);
        return new Response(res.body, {
          headers: {
            ...Object.fromEntries(res.headers),
            ...cors,
          },
          status: res.status,
        });
      }
      // 管理端点
      if (url.pathname === "/api/admin/create" && request.method === "POST") {
        const res = await handleAdminCreate(request, env);
        return new Response(res.body, {
          headers: {
            ...Object.fromEntries(res.headers),
            ...cors,
          },
          status: res.status,
        });
      }
      if (url.pathname === "/api/admin/delete" && request.method === "POST") {
        const res = await handleAdminDelete(request, env);
        return new Response(res.body, {
          headers: {
            ...Object.fromEntries(res.headers),
            ...cors,
          },
          status: res.status,
        });
      }
      if (url.pathname === "/api/admin/list" && request.method === "POST") {
        const res = await handleAdminList(request, env);
        return new Response(res.body, {
          headers: {
            ...Object.fromEntries(res.headers),
            ...cors,
          },
          status: res.status,
        });
      }
      if (url.pathname === "/api/admin/check" && request.method === "POST") {
        const res = await handleAdminCheck(request, env);
        return new Response(res.body, {
          headers: {
            ...Object.fromEntries(res.headers),
            ...cors,
          },
          status: res.status,
        });
      }
      return json({ error: "Not Found" }, 404);
    }
    catch (e) {
      return json(
        {
          error: e.message || "内部错误",
          success: false,
        },
        500,
      );
    }
  },
};
