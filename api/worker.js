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

  const { count = 1, expires_in, max_devices = 1, remark } = await request.json().catch(() => ({}));
  const created = [];

  for (let i = 0; i < Math.min(count, 100); i++) {
    const code = genCode();
    let cols = "code, max_devices, remark";
    let vals = `'${code}', ${max_devices}, '${(remark || "").replace(/'/g, "''")}'`;
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

async function handleAdminUpdate(request, env) {
  if (!checkAdmin(request, env))
    return json({ error: "未授权" }, 401);
  const { code, expires_at, max_devices, new_code, status } = await request.json();

  const act = await env.DB.prepare("SELECT id FROM activations WHERE code = ?").bind(code).first();
  if (!act) {
    return json({ error: "激活码不存在", success: false });
  }

  if (new_code && new_code !== code) {
    const existing = await env.DB.prepare("SELECT id FROM activations WHERE code = ?")
      .bind(new_code)
      .first();
    if (existing) {
      return json({ error: "新激活码已存在", success: false });
    }
  }

  const sets = [];
  const params = [];

  if (new_code !== undefined) {
    sets.push("code = ?");
    params.push(new_code);
  }
  if (status !== undefined) {
    sets.push("status = ?");
    params.push(status);
  }
  if (max_devices !== undefined) {
    sets.push("max_devices = ?");
    params.push(max_devices);
  }
  if (expires_at !== undefined) {
    sets.push("expires_at = ?");
    params.push(expires_at || null);
  }

  if (sets.length === 0) {
    return json({ error: "没有需要更新的字段", success: false });
  }

  params.push(act.id);
  await env.DB.prepare(`UPDATE activations SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...params)
    .run();

  return json({ success: true });
}

async function handleAdminList(request, env) {
  if (!checkAdmin(request, env))
    return json({ error: "未授权" }, 401);
  const filter = new URL(request.url).searchParams.get("filter") || "all";

  let where = "";
  let having = "";
  if (filter === "actived") {
    where = "WHERE a.status = 'active'";
    having = "HAVING COUNT(d.id) > 0";
  }
  else if (filter === "inactive") {
    where = "WHERE a.status = 'active'";
    having = "HAVING COUNT(d.id) = 0";
  }

  const { results } = await env.DB.prepare(
    `SELECT a.code, a.status, a.max_devices, a.remark, a.created_at, a.expires_at,
            COUNT(d.id) AS used_cnt,
            a.max_devices - COUNT(d.id) AS remaining
     FROM activations a
     LEFT JOIN devices d ON d.activation_id = a.id
     ${where}
     GROUP BY a.id
     ${having}
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
    `SELECT a.code, a.status, a.max_devices, a.remark, a.created_at, a.expires_at,
            COUNT(d.id) AS used_cnt,
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

async function handleAdminRemark(request, env) {
  if (!checkAdmin(request, env))
    return json({ error: "未授权" }, 401);
  const { code, remark } = await request.json();

  await env.DB.prepare("UPDATE activations SET remark = ? WHERE code = ?")
    .bind(remark || "", code)
    .run();

  return json({ success: true });
}

async function handleAdminTemplate(request, env) {
  if (!checkAdmin(request, env))
    return json({ error: "未授权" }, 401);
  const { action, value } = await request.json();

  if (action === "get") {
    const row = await env.DB.prepare(
      "SELECT value FROM settings WHERE key = 'remark_template'",
    ).first();
    return json({ success: true, value: row?.value || "" });
  }
  if (action === "save") {
    await env.DB.prepare(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('remark_template', ?)",
    )
      .bind(value || "")
      .run();
    return json({ success: true });
  }
  return json({ error: "无效操作" }, 400);
}

// ===== 文件管理 =====

function uuid() {
  return crypto.randomUUID();
}

function normalizeFileSegment(name) {
  return String(name || "").trim().replace(/[\\/\u0000-\u001F\u007F]/g, "_");
}

async function resolveFolderId(env, pathStr) {
  if (!pathStr) return null;
  const segs = (pathStr || "").split("/").filter(Boolean);
  let parentId = null;
  for (const seg of segs) {
    const folder = parentId
      ? await env.DB.prepare(
        "SELECT id FROM files WHERE parent_id = ? AND name = ? AND type = 'folder'",
      )
        .bind(parentId, seg)
        .first()
      : await env.DB.prepare(
        "SELECT id FROM files WHERE parent_id IS NULL AND name = ? AND type = 'folder'",
      )
        .bind(seg)
        .first();
    if (!folder) return null;
    parentId = folder.id;
  }
  return parentId;
}

async function ensureFolderPath(env, pathStr) {
  if (!pathStr) return null;
  const segs = (pathStr || "").split("/").filter(Boolean);
  let parentId = null;
  for (const seg of segs) {
    const safe = normalizeFileSegment(seg);
    const folder = parentId
      ? await env.DB.prepare(
        "SELECT id FROM files WHERE parent_id = ? AND name = ? AND type = 'folder'",
      )
        .bind(parentId, safe)
        .first()
      : await env.DB.prepare(
        "SELECT id FROM files WHERE parent_id IS NULL AND name = ? AND type = 'folder'",
      )
        .bind(safe)
        .first();
    if (folder) {
      parentId = folder.id;
    }
    else {
      const id = uuid();
      await env.DB.prepare("INSERT INTO files (id, name, parent_id, type) VALUES (?, ?, ?, 'folder')")
        .bind(id, safe, parentId)
        .run();
      parentId = id;
    }
  }
  return parentId;
}

async function getFolderPath(env, folderId) {
  const parts = [];
  let currentId = folderId || null;

  while (currentId) {
    const folder = await env.DB.prepare(
      "SELECT id, name, parent_id FROM files WHERE id = ? AND type = 'folder'",
    )
      .bind(currentId)
      .first();
    if (!folder) break;
    parts.unshift(normalizeFileSegment(folder.name));
    currentId = folder.parent_id || null;
  }

  return parts.join("/");
}

async function buildR2Key(env, parentId, filename) {
  const safeName = normalizeFileSegment(filename);
  const folderPath = await getFolderPath(env, parentId);
  return folderPath ? `${folderPath}/${safeName}` : safeName;
}

async function moveR2Object(env, oldKey, newKey, mimeType) {
  if (!oldKey || oldKey === newKey) return;
  const obj = await env.FILES.get(oldKey);
  if (!obj) return;
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  await env.FILES.put(newKey, obj.body, {
    httpMetadata: { contentType: headers.get("content-type") || mimeType || "application/octet-stream" },
  });
  await env.FILES.delete(oldKey);
}

async function handleFilesList(request, env) {
  if (!checkAdmin(request, env))
    return json({ error: "未授权" }, 401);
  const { path: pathStr, parent_id } = await request.json().catch(() => ({}));
  const pid = pathStr ? await resolveFolderId(env, pathStr) : (parent_id || null);

  let query;
  let params;
  if (pid) {
    query = "SELECT * FROM files WHERE parent_id = ? ORDER BY type, name";
    params = [pid];
  }
  else {
    query = "SELECT * FROM files WHERE parent_id IS NULL ORDER BY type, name";
    params = [];
  }

  const { results } = await env.DB.prepare(query)
    .bind(...params)
    .all();
  return json({ items: results, path: pathStr || "", success: true });
}

async function handleFilesFolder(request, env) {
  if (!checkAdmin(request, env))
    return json({ error: "未授权" }, 401);
  const { name, parent_id, path: parentPath } = await request.json();

  const trimmed = normalizeFileSegment(name);
  if (!trimmed)
    return json({ error: "文件夹名不能为空" }, 400);

  const pid = parentPath ? await resolveFolderId(env, parentPath) : (parent_id || null);

  const existing = pid
    ? await env.DB.prepare(
        "SELECT id FROM files WHERE parent_id = ? AND name = ? AND type = 'folder'",
      )
        .bind(pid, trimmed)
        .first()
    : await env.DB.prepare(
        "SELECT id FROM files WHERE parent_id IS NULL AND name = ? AND type = 'folder'",
      )
        .bind(trimmed)
        .first();

  if (existing)
    return json({ error: "同名文件夹已存在", success: false }, 409);

  const id = uuid();
  await env.DB.prepare("INSERT INTO files (id, name, parent_id, type) VALUES (?, ?, ?, 'folder')")
    .bind(id, trimmed, pid)
    .run();

  return json({ id, name: trimmed, success: true });
}

async function handleFilesUpload(request, env) {
  if (!checkAdmin(request, env))
    return json({ error: "未授权" }, 401);

  const formData = await request.formData();
  const file = formData.get("file");
  const pathStr = formData.get("path") || "";
  const parentId = formData.get("parent_id") || null;
  const overwrite = formData.get("overwrite") === "true";

  if (!file || !file.name)
    return json({ error: "未选择文件" }, 400);

  const fileName = normalizeFileSegment(file.name);
  if (!fileName)
    return json({ error: "文件名不能为空" }, 400);

  // resolve parent folder from path, create intermediate folders if needed
  const pid = pathStr ? await ensureFolderPath(env, pathStr) : parentId;

  // 检查同名文件
  const existing = pid
    ? await env.DB.prepare(
        "SELECT id, r2_key FROM files WHERE parent_id = ? AND name = ? AND type = 'file'",
      )
        .bind(pid, fileName)
        .first()
    : await env.DB.prepare(
        "SELECT id, r2_key FROM files WHERE parent_id IS NULL AND name = ? AND type = 'file'",
      )
        .bind(fileName)
        .first();

  if (existing && !overwrite) {
    return json(
      {
        conflict: true,
        existing: { id: existing.id, name: fileName },
        success: false,
      },
      409,
    );
  }

  const mimeType = file.type || "application/octet-stream";
  const r2Key = pathStr ? `${pathStr}/${fileName}` : fileName;

  if (existing && overwrite) {
    // 覆盖时复用已有 r2_key，保证公开链接不变
    const r2Key = existing.r2_key;
    await env.FILES.put(r2Key, file.stream(), {
      httpMetadata: { contentType: mimeType },
    });
    await env.DB.prepare(
      "UPDATE files SET size = ?, mime_type = ?, updated_at = datetime('now') WHERE id = ?",
    )
      .bind(file.size, mimeType, existing.id)
      .run();
    return json({
      file: {
        id: existing.id,
        mime_type: mimeType,
        name: fileName,
        r2_key: r2Key,
        size: file.size,
      },
      success: true,
    });
  }

  await env.FILES.put(r2Key, file.stream(), {
    httpMetadata: { contentType: mimeType },
  });

  const fileId = uuid();
  await env.DB.prepare(
    "INSERT INTO files (id, name, parent_id, type, size, mime_type, r2_key) VALUES (?, ?, ?, 'file', ?, ?, ?)",
  )
    .bind(fileId, fileName, pid, file.size, mimeType, r2Key)
    .run();

  return json({
    file: { id: fileId, mime_type: mimeType, name: fileName, r2_key: r2Key, size: file.size },
    success: true,
  });
}

async function handleFilesRename(request, env) {
  if (!checkAdmin(request, env))
    return json({ error: "未授权" }, 401);
  const { id, name } = await request.json();

  const trimmed = normalizeFileSegment(name);
  if (!id || !trimmed)
    return json({ error: "参数无效" }, 400);

  const item = await env.DB.prepare("SELECT id, parent_id, type, r2_key, mime_type FROM files WHERE id = ?")
    .bind(id)
    .first();
  if (!item)
    return json({ error: "文件不存在" }, 404);

  const existing = item.parent_id
    ? await env.DB.prepare(
        "SELECT id FROM files WHERE parent_id = ? AND name = ? AND type = ? AND id != ?",
      )
        .bind(item.parent_id, trimmed, item.type, id)
        .first()
    : await env.DB.prepare(
        "SELECT id FROM files WHERE parent_id IS NULL AND name = ? AND type = ? AND id != ?",
      )
        .bind(trimmed, item.type, id)
        .first();

  if (existing)
    return json({ error: "同名已存在", success: false }, 409);

  if (item.type === "file") {
    const nextKey = await buildR2Key(env, item.parent_id, trimmed);
    await moveR2Object(env, item.r2_key, nextKey, item.mime_type);
    await env.DB.prepare("UPDATE files SET name = ?, r2_key = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(trimmed, nextKey, id)
      .run();
  }
  else {
    await env.DB.prepare("UPDATE files SET name = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(trimmed, id)
      .run();

    const { results: descendants } = await env.DB.prepare(`
      WITH RECURSIVE children AS (
        SELECT id, parent_id, type, name, r2_key, mime_type FROM files WHERE parent_id = ?
        UNION ALL
        SELECT f.id, f.parent_id, f.type, f.name, f.r2_key, f.mime_type FROM files f JOIN children c ON f.parent_id = c.id
      )
      SELECT * FROM children WHERE type = 'file'
    `)
      .bind(id)
      .all();

    for (const file of descendants) {
      const nextKey = await buildR2Key(env, file.parent_id, file.name);
      await moveR2Object(env, file.r2_key, nextKey, file.mime_type);
      await env.DB.prepare("UPDATE files SET r2_key = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(nextKey, file.id)
        .run();
    }
  }

  return json({ name: trimmed, success: true });
}

async function handleFilesTogglePublic(request, env) {
  if (!checkAdmin(request, env))
    return json({ error: "未授权" }, 401);
  const { id } = await request.json();

  const item = await env.DB.prepare("SELECT id, type, is_public, r2_key FROM files WHERE id = ?")
    .bind(id)
    .first();
  if (!item)
    return json({ error: "文件不存在" }, 404);
  if (item.type !== "file")
    return json({ error: "仅文件可设置公开" }, 400);

  const newState = item.is_public ? 0 : 1;
  await env.DB.prepare("UPDATE files SET is_public = ? WHERE id = ?").bind(newState, id).run();

  const publicUrl = newState ? `${new URL(request.url).origin}/api/files/${encodeURI(item.r2_key)}` : null;

  return json({ is_public: newState === 1, success: true, url: publicUrl });
}

async function handleFilesDelete(request, env) {
  if (!checkAdmin(request, env))
    return json({ error: "未授权" }, 401);
  const { id } = await request.json();

  const item = await env.DB.prepare("SELECT id, type FROM files WHERE id = ?").bind(id).first();
  if (!item)
    return json({ error: "文件不存在" }, 404);

  const { results: descendants } = await env.DB.prepare(`
    WITH RECURSIVE children AS (
      SELECT id, type, r2_key FROM files WHERE id = ?
      UNION ALL
      SELECT f.id, f.type, f.r2_key FROM files f JOIN children c ON f.parent_id = c.id
    )
    SELECT * FROM children
  `)
    .bind(id)
    .all();

  for (const node of descendants) {
    if (node.type === "file" && node.r2_key) {
      await env.FILES.delete(node.r2_key);
    }
  }

  for (const node of descendants) {
    await env.DB.prepare("DELETE FROM files WHERE id = ?").bind(node.id).run();
  }

  return json({ deleted: descendants.length, success: true });
}

async function handleFileDownload(request, env) {
  const r2Key = decodeURIComponent(request.url.split("/api/files/")[1] || "");
  if (!r2Key)
    return new Response("Not Found", { status: 404 });

  const item = await env.DB.prepare("SELECT is_public, name, mime_type FROM files WHERE r2_key = ?")
    .bind(r2Key)
    .first();
  if (!item || !item.is_public)
    return new Response("Forbidden", { status: 403 });

  const obj = await env.FILES.get(r2Key);
  if (!obj)
    return new Response("Not Found", { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("Content-Disposition", `inline; filename="${encodeURIComponent(item.name)}"`);
  headers.set("Access-Control-Allow-Origin", "*");

  return new Response(obj.body, { headers });
}

async function handleFilesDownload(request, env) {
  if (!checkAdmin(request, env))
    return json({ error: "未授权" }, 401);
  const { id } = await request.json();
  if (!id)
    return json({ error: "缺少 id" }, 400);

  const item = await env.DB.prepare(
    "SELECT name, r2_key, mime_type FROM files WHERE id = ? AND type = 'file'",
  )
    .bind(id)
    .first();
  if (!item)
    return new Response("Not Found", { status: 404 });

  const obj = await env.FILES.get(item.r2_key);
  if (!obj)
    return new Response("Not Found", { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("Content-Disposition", `attachment; filename="${encodeURIComponent(item.name)}"`);
  headers.set("Access-Control-Allow-Origin", "*");

  return new Response(obj.body, { headers });
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
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
      if (url.pathname === "/api/admin/update" && request.method === "POST") {
        const res = await handleAdminUpdate(request, env);
        return new Response(res.body, {
          headers: { ...Object.fromEntries(res.headers), ...cors },
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
      if (url.pathname === "/api/admin/remark" && request.method === "POST") {
        const res = await handleAdminRemark(request, env);
        return new Response(res.body, {
          headers: {
            ...Object.fromEntries(res.headers),
            ...cors,
          },
          status: res.status,
        });
      }
      if (url.pathname === "/api/admin/template" && request.method === "POST") {
        const res = await handleAdminTemplate(request, env);
        return new Response(res.body, {
          headers: {
            ...Object.fromEntries(res.headers),
            ...cors,
          },
          status: res.status,
        });
      }
      // 文件管理
      if (url.pathname === "/api/admin/files/list" && request.method === "POST") {
        const res = await handleFilesList(request, env);
        return new Response(res.body, {
          headers: { ...Object.fromEntries(res.headers), ...cors },
          status: res.status,
        });
      }
      if (url.pathname === "/api/admin/files/folder" && request.method === "POST") {
        const res = await handleFilesFolder(request, env);
        return new Response(res.body, {
          headers: { ...Object.fromEntries(res.headers), ...cors },
          status: res.status,
        });
      }
      if (url.pathname === "/api/admin/files/upload" && request.method === "POST") {
        const res = await handleFilesUpload(request, env);
        return new Response(res.body, {
          headers: { ...Object.fromEntries(res.headers), ...cors },
          status: res.status,
        });
      }
      if (url.pathname === "/api/admin/files/rename" && request.method === "POST") {
        const res = await handleFilesRename(request, env);
        return new Response(res.body, {
          headers: { ...Object.fromEntries(res.headers), ...cors },
          status: res.status,
        });
      }
      if (url.pathname === "/api/admin/files/toggle-public" && request.method === "POST") {
        const res = await handleFilesTogglePublic(request, env);
        return new Response(res.body, {
          headers: { ...Object.fromEntries(res.headers), ...cors },
          status: res.status,
        });
      }
      if (url.pathname === "/api/admin/files/delete" && request.method === "POST") {
        const res = await handleFilesDelete(request, env);
        return new Response(res.body, {
          headers: { ...Object.fromEntries(res.headers), ...cors },
          status: res.status,
        });
      }
      if (url.pathname.startsWith("/api/files/") && request.method === "GET") {
        return handleFileDownload(request, env);
      }
      if (url.pathname === "/api/admin/files/download" && request.method === "POST") {
        return handleFilesDownload(request, env);
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
