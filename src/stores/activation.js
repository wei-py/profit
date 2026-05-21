import { Store } from "@tauri-apps/plugin-store";
import dayjs from "dayjs";
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { activateCode, validateCode } from "@/services/activation";

const STORE_PATH = "activation.json";
const CACHE_KEY = "activation";
// 离线宽限期 7 天
const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export const useActivationStore = defineStore("activation", () => {
  // 'unactivated' | 'activated' | 'expired' | 'checking'
  const status = ref("checking");
  const code = ref("");
  const token = ref("");
  const error = ref("");
  const lastVerifiedAt = ref(0);

  const isActivated = computed(() => status.value === "activated");

  /** 从本地持久化存储加载缓存 */
  async function loadCache() {
    try {
      const store = await Store.load(STORE_PATH);
      const cached = await store.get(CACHE_KEY);
      if (cached) {
        code.value = cached.code || "";
        token.value = cached.token || "";
        lastVerifiedAt.value = cached.lastVerifiedAt || 0;
        return true;
      }
    }
    catch {
      // 首次运行，无缓存
    }
    return false;
  }

  /** 写入本地持久化存储 */
  async function saveCache() {
    try {
      const store = await Store.load(STORE_PATH);
      await store.set(CACHE_KEY, {
        code: code.value,
        lastVerifiedAt: lastVerifiedAt.value,
        token: token.value,
      });
      await store.save();
    }
    catch {
      // 静默失败
    }
  }

  /** 应用启动时调用：先读缓存，再在线校验 */
  async function checkActivation() {
    status.value = "checking";
    error.value = "";

    const hasCache = await loadCache();

    if (hasCache && code.value) {
      // 有缓存：先判断离线宽限期是否生效
      const elapsed = dayjs().valueOf() - lastVerifiedAt.value;
      if (elapsed < OFFLINE_GRACE_MS) {
        // 在宽限期内，直接放行
        status.value = "activated";
        // 后台尝试刷新（不阻塞）
        tryOnlineValidate();
        return true;
      }

      // 超出宽限期，强制在线校验
      const ok = await tryOnlineValidate();
      if (ok)
        return true;
    }

    // 无缓存或校验失败 → 需要激活
    status.value = "unactivated";
    return false;
  }

  /** 后台在线校验，不改变 status（由调用方决定） */
  async function tryOnlineValidate() {
    if (!code.value)
      return false;
    try {
      const resp = await validateCode(code.value);
      if (resp.success) {
        token.value = resp.token || "";
        lastVerifiedAt.value = dayjs().valueOf();
        await saveCache();
        if (status.value !== "activated") {
          status.value = "activated";
        }
        return true;
      }
      else {
        error.value = resp.error || "验证失败";
        if (resp.error?.includes("撤销") || resp.error?.includes("过期")) {
          status.value = "expired";
        }
        return false;
      }
    }
    catch {
      return false;
    }
  }

  /** 用户输入激活码进行首次激活 */
  async function activate(inputCode) {
    status.value = "checking";
    error.value = "";

    try {
      const resp = await activateCode(inputCode);
      if (resp.success) {
        code.value = inputCode;
        token.value = resp.token || "";
        lastVerifiedAt.value = dayjs().valueOf();
        await saveCache();
        status.value = "activated";
        return {
          code: inputCode,
          expires_at: resp.expires_at,
          max_devices: resp.max_devices,
          success: true,
          token: resp.token,
        };
      }
      else {
        error.value = resp.error || "激活失败";
        status.value = "unactivated";
        return {
          error: resp.error,
          success: false,
        };
      }
    }
    catch (e) {
      error.value = e.message || "网络错误";
      status.value = "unactivated";
      return {
        error: e.message,
        success: false,
      };
    }
  }

  /** 清除激活状态 */
  async function deactivate() {
    code.value = "";
    token.value = "";
    lastVerifiedAt.value = 0;
    status.value = "unactivated";
    error.value = "";
    try {
      const store = await Store.load(STORE_PATH);
      await store.delete(CACHE_KEY);
      await store.save();
    }
    catch {
      // 静默
    }
  }

  return {
    activate,
    checkActivation,
    code,
    deactivate,
    error,
    isActivated,
    lastVerifiedAt,
    loadCache,
    saveCache,
    status,
  };
});
