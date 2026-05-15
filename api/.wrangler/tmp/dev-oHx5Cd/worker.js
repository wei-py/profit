var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
async function signToken(secret, payload) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      hash: "SHA-256",
      name: "HMAC"
    },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const sigHex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${payload}.${sigHex}`;
}
__name(signToken, "signToken");
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
    status
  });
}
__name(json, "json");
async function handleActivate(request, env) {
  const { code, fingerprint } = await request.json();
  if (!code || !fingerprint) {
    return json(
      {
        error: "\u7F3A\u5C11 code \u6216 fingerprint",
        success: false
      },
      400
    );
  }
  const trimmed = code.trim();
  if (trimmed.length < 8) {
    return json(
      {
        error: "\u6FC0\u6D3B\u7801\u683C\u5F0F\u65E0\u6548",
        success: false
      },
      400
    );
  }
  const act = await env.DB.prepare(
    "SELECT id, status, max_devices, expires_at FROM activations WHERE code = ?"
  ).bind(trimmed).first();
  if (!act) {
    return json({
      error: "\u6FC0\u6D3B\u7801\u4E0D\u5B58\u5728",
      success: false
    });
  }
  if (act.status !== "active") {
    if (act.status === "revoked") {
      return json({
        error: "\u6FC0\u6D3B\u7801\u5DF2\u88AB\u64A4\u9500",
        success: false
      });
    }
    return json({
      error: "\u6FC0\u6D3B\u7801\u5DF2\u5931\u6548",
      success: false
    });
  }
  if (act.expires_at && new Date(act.expires_at) < /* @__PURE__ */ new Date()) {
    return json({
      error: "\u6FC0\u6D3B\u7801\u5DF2\u8FC7\u671F",
      success: false
    });
  }
  const existing = await env.DB.prepare(
    "SELECT fingerprint, id FROM devices WHERE activation_id = ?"
  ).bind(act.id).all();
  let deviceRecord = existing.results.find((d) => d.fingerprint === fingerprint);
  if (deviceRecord) {
    await env.DB.prepare("UPDATE devices SET last_seen_at = datetime('now') WHERE id = ?").bind(deviceRecord.id).run();
  } else {
    if (existing.results.length >= act.max_devices) {
      return json({
        error: `\u8BE5\u6FC0\u6D3B\u7801\u5DF2\u7ED1\u5B9A ${act.max_devices} \u53F0\u8BBE\u5907`,
        success: false
      });
    }
    const result = await env.DB.prepare(
      "INSERT INTO devices (activation_id, fingerprint) VALUES (?, ?)"
    ).bind(act.id, fingerprint).run();
    deviceRecord = {
      fingerprint,
      id: result.meta.last_row_id
    };
  }
  const secret = env.ACTIVATION_SECRET || "dev-secret-change-me";
  const payload = JSON.stringify({
    code: trimmed,
    fp: fingerprint,
    iat: Date.now()
  });
  const token = await signToken(secret, payload);
  return json({
    expires_at: act.expires_at,
    max_devices: act.max_devices,
    success: true,
    token
  });
}
__name(handleActivate, "handleActivate");
async function handleValidate(request, env) {
  const { code, fingerprint } = await request.json();
  if (!code || !fingerprint) {
    return json(
      {
        error: "\u7F3A\u5C11 code \u6216 fingerprint",
        success: false
      },
      400
    );
  }
  const act = await env.DB.prepare(
    "SELECT id, status, max_devices, expires_at FROM activations WHERE code = ?"
  ).bind(code.trim()).first();
  if (!act) {
    return json({
      error: "\u6FC0\u6D3B\u7801\u4E0D\u5B58\u5728",
      success: false
    });
  }
  if (act.status !== "active") {
    return json({
      error: `\u6FC0\u6D3B\u7801\u72B6\u6001: ${act.status}`,
      success: false
    });
  }
  if (act.expires_at && new Date(act.expires_at) < /* @__PURE__ */ new Date()) {
    return json({
      error: "\u6FC0\u6D3B\u7801\u5DF2\u8FC7\u671F",
      success: false
    });
  }
  const device = await env.DB.prepare(
    "SELECT id FROM devices WHERE activation_id = ? AND fingerprint = ?"
  ).bind(act.id, fingerprint).first();
  if (!device) {
    return json({
      error: "\u8BBE\u5907\u672A\u7ED1\u5B9A",
      success: false
    });
  }
  await env.DB.prepare("UPDATE devices SET last_seen_at = datetime('now') WHERE id = ?").bind(device.id).run();
  const secret = env.ACTIVATION_SECRET || "dev-secret-change-me";
  const payload = JSON.stringify({
    code: code.trim(),
    fp: fingerprint,
    iat: Date.now()
  });
  const token = await signToken(secret, payload);
  return json({
    expires_at: act.expires_at,
    max_devices: act.max_devices,
    success: true,
    token
  });
}
__name(handleValidate, "handleValidate");
function checkAdmin(request, env) {
  const secret = env.ADMIN_SECRET || "1dd87b72-fc38-4058-77f2aa-a4bb9b";
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return token === secret;
}
__name(checkAdmin, "checkAdmin");
function genCode() {
  const raw = crypto.getRandomValues(new Uint8Array(6));
  const hex = Array.from(raw).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `PFT-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}
__name(genCode, "genCode");
async function handleAdminCreate(request, env) {
  if (!checkAdmin(request, env))
    return json({ error: "\u672A\u6388\u6743" }, 401);
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
      max_devices
    });
  }
  return json({
    created,
    success: true
  });
}
__name(handleAdminCreate, "handleAdminCreate");
async function handleAdminDelete(request, env) {
  if (!checkAdmin(request, env))
    return json({ error: "\u672A\u6388\u6743" }, 401);
  const { code } = await request.json();
  const act = await env.DB.prepare("SELECT id FROM activations WHERE code = ?").bind(code).first();
  if (!act) {
    return json({
      error: "\u6FC0\u6D3B\u7801\u4E0D\u5B58\u5728",
      success: false
    });
  }
  const { results } = await env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM devices WHERE activation_id = ?"
  ).bind(act.id).all();
  if (results[0].cnt > 0) {
    await env.DB.prepare("UPDATE activations SET status='revoked' WHERE id = ?").bind(act.id).run();
    return json({
      action: "revoked",
      reason: `\u5DF2\u7ED1\u5B9A ${results[0].cnt} \u53F0\u8BBE\u5907`,
      success: true
    });
  }
  await env.DB.prepare("DELETE FROM activations WHERE id = ?").bind(act.id).run();
  return json({
    action: "deleted",
    success: true
  });
}
__name(handleAdminDelete, "handleAdminDelete");
async function handleAdminList(request, env) {
  if (!checkAdmin(request, env))
    return json({ error: "\u672A\u6388\u6743" }, 401);
  const filter = new URL(request.url).searchParams.get("filter") || "all";
  let where = "";
  let having = "";
  if (filter === "actived") {
    where = "WHERE a.status = 'active'";
    having = "HAVING COUNT(d.id) > 0";
  } else if (filter === "inactive") {
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
     ORDER BY a.created_at DESC`
  ).all();
  return json({
    codes: results,
    success: true
  });
}
__name(handleAdminList, "handleAdminList");
async function handleAdminCheck(request, env) {
  if (!checkAdmin(request, env))
    return json({ error: "\u672A\u6388\u6743" }, 401);
  const { code } = await request.json();
  const act = await env.DB.prepare(
    `SELECT a.code, a.status, a.max_devices, a.remark, a.created_at, a.expires_at,
            COUNT(d.id) AS used_cnt,
            a.max_devices - COUNT(d.id) AS remaining
     FROM activations a
     LEFT JOIN devices d ON d.activation_id = a.id
     WHERE a.code = ?
     GROUP BY a.id`
  ).bind(code).first();
  if (!act) {
    return json({
      error: "\u6FC0\u6D3B\u7801\u4E0D\u5B58\u5728",
      success: false
    });
  }
  const { results: devices } = await env.DB.prepare(
    `SELECT d.fingerprint, d.bound_at, d.last_seen_at
     FROM devices d JOIN activations a ON a.id = d.activation_id
     WHERE a.code = ? ORDER BY d.bound_at`
  ).bind(code).all();
  return json({
    code: act,
    devices,
    success: true
  });
}
__name(handleAdminCheck, "handleAdminCheck");
async function handleAdminRemark(request, env) {
  if (!checkAdmin(request, env))
    return json({ error: "\u672A\u6388\u6743" }, 401);
  const { code, remark } = await request.json();
  await env.DB.prepare("UPDATE activations SET remark = ? WHERE code = ?").bind(remark || "", code).run();
  return json({ success: true });
}
__name(handleAdminRemark, "handleAdminRemark");
async function handleAdminTemplate(request, env) {
  if (!checkAdmin(request, env))
    return json({ error: "\u672A\u6388\u6743" }, 401);
  const { action, value } = await request.json();
  if (action === "get") {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'remark_template'").first();
    return json({ success: true, value: row?.value || "" });
  }
  if (action === "save") {
    await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('remark_template', ?)").bind(value || "").run();
    return json({ success: true });
  }
  return json({ error: "\u65E0\u6548\u64CD\u4F5C" }, 400);
}
__name(handleAdminTemplate, "handleAdminTemplate");
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Origin": "*"
        },
        status: 204
      });
    }
    const cors = { "Access-Control-Allow-Origin": "*" };
    try {
      if (url.pathname === "/api/activate" && request.method === "POST") {
        const res = await handleActivate(request, env);
        return new Response(res.body, {
          headers: {
            ...Object.fromEntries(res.headers),
            ...cors
          },
          status: res.status
        });
      }
      if (url.pathname === "/api/validate" && request.method === "POST") {
        const res = await handleValidate(request, env);
        return new Response(res.body, {
          headers: {
            ...Object.fromEntries(res.headers),
            ...cors
          },
          status: res.status
        });
      }
      if (url.pathname === "/api/admin/create" && request.method === "POST") {
        const res = await handleAdminCreate(request, env);
        return new Response(res.body, {
          headers: {
            ...Object.fromEntries(res.headers),
            ...cors
          },
          status: res.status
        });
      }
      if (url.pathname === "/api/admin/delete" && request.method === "POST") {
        const res = await handleAdminDelete(request, env);
        return new Response(res.body, {
          headers: {
            ...Object.fromEntries(res.headers),
            ...cors
          },
          status: res.status
        });
      }
      if (url.pathname === "/api/admin/list" && request.method === "POST") {
        const res = await handleAdminList(request, env);
        return new Response(res.body, {
          headers: {
            ...Object.fromEntries(res.headers),
            ...cors
          },
          status: res.status
        });
      }
      if (url.pathname === "/api/admin/check" && request.method === "POST") {
        const res = await handleAdminCheck(request, env);
        return new Response(res.body, {
          headers: {
            ...Object.fromEntries(res.headers),
            ...cors
          },
          status: res.status
        });
      }
      if (url.pathname === "/api/admin/remark" && request.method === "POST") {
        const res = await handleAdminRemark(request, env);
        return new Response(res.body, {
          headers: {
            ...Object.fromEntries(res.headers),
            ...cors
          },
          status: res.status
        });
      }
      if (url.pathname === "/api/admin/template" && request.method === "POST") {
        const res = await handleAdminTemplate(request, env);
        return new Response(res.body, {
          headers: {
            ...Object.fromEntries(res.headers),
            ...cors
          },
          status: res.status
        });
      }
      return json({ error: "Not Found" }, 404);
    } catch (e) {
      return json(
        {
          error: e.message || "\u5185\u90E8\u9519\u8BEF",
          success: false
        },
        500
      );
    }
  }
};

// node_modules/.pnpm/wrangler@4.92.0/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/.pnpm/wrangler@4.92.0/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-a8lm7s/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// node_modules/.pnpm/wrangler@4.92.0/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-a8lm7s/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
