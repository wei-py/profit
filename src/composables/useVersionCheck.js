import { invoke } from "@tauri-apps/api/core";
import { ref } from "vue";

const CURRENT_VERSION = __APP_VERSION__;

const VERSION_URL
  = "https://profit-admin.xu-wei.space/api/files/8b6b9353-6f1a-4996-9803-8ff67f56b774-version.json";

async function getPlatformKey() {
  try {
    return await invoke("get_platform");
  }
  catch {
    return null;
  }
}

async function resolveDownloadUrl(data) {
  if (!data?.platforms)
    return null;
  const key = await getPlatformKey();
  if (!key)
    return null;
  return data.platforms[key] || null;
}

function parseVersion(v) {
  const parts = String(v).trim().split(".");
  return {
    major: Number.parseInt(parts[0], 10) || 0,
    minor: Number.parseInt(parts[1], 10) || 0,
    patch: Number.parseInt(parts[2], 10) || 0,
  };
}

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

  async function checkVersion() {
    loading.value = true;
    error.value = "";
    updateInfo.value = null;
    updateAvailable.value = false;
    forceUpdate.value = false;

    try {
      const resp = await fetch(VERSION_URL);
      if (!resp.ok) {
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
    resolveDownloadUrl,
    updateAvailable,
    updateInfo,
    versionUrl: VERSION_URL,
  };
}
