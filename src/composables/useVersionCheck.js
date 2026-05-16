import { ref } from "vue";

/** 当前应用版本，构建时从 package.json 注入 */
const CURRENT_VERSION = "0.1.0";

/** 远程 version.json 公开链接 */
const VERSION_URL = "https://profit-admin.xu-wei.space/api/files/8b6b9353-6f1a-4996-9803-8ff67f56b774-version.json";

/**
 * 解析 semver 版本号。
 * @param {string} v - 版本字符串如 "1.2.0"
 * @returns {{ major: number, minor: number, patch: number }} 解析后的版本对象
 */
function parseVersion(v) {
  const parts = String(v).trim().split(".");
  return {
    major: Number.parseInt(parts[0], 10) || 0,
    minor: Number.parseInt(parts[1], 10) || 0,
    patch: Number.parseInt(parts[2], 10) || 0,
  };
}

/**
 * 比较版本号。
 * @param {string} a - 版本 A
 * @param {string} b - 版本 B
 * @returns {number} a > b 返回 1，a < b 返回 -1，相等返回 0
 */
function compareVersion(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (pa.major !== pb.major) {
    return pa.major > pb.major ? 1 : -1;
  }
  if (pa.minor !== pb.minor) {
    return pa.minor > pb.minor ? 1 : -1;
  }
  if (pa.patch !== pb.patch) {
    return pa.patch > pb.patch ? 1 : -1;
  }
  return 0;
}

export function useVersionCheck() {
  const loading = ref(false);
  const updateInfo = ref(null);
  const updateAvailable = ref(false);
  const forceUpdate = ref(false);
  const error = ref("");

  /** 请求远程 version.json 并比对版本。 */
  async function checkVersion() {
    loading.value = true;
    error.value = "";
    updateInfo.value = null;
    updateAvailable.value = false;
    forceUpdate.value = false;

    try {
      const resp = await fetch(VERSION_URL);
      if (!resp.ok) {
        // version.json 不存在或未公开，视为无更新
        loading.value = false;
        return;
      }

      const data = await resp.json();
      updateInfo.value = data;

      const remoteVersion = data.version;
      if (!remoteVersion) {
        loading.value = false;
        return;
      }

      const cmp = compareVersion(remoteVersion, CURRENT_VERSION);
      if (cmp > 0) {
        updateAvailable.value = true;
        forceUpdate.value = data.force === true;
      }
    }
    catch {
      // 网络错误，忽略
    }

    loading.value = false;
  }

  return {
    checkVersion,
    currentVersion: CURRENT_VERSION,
    error,
    forceUpdate,
    loading,
    updateAvailable,
    updateInfo,
    versionUrl: VERSION_URL,
  };
}
