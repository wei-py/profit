import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { check } from "@tauri-apps/plugin-updater";

const CURRENT_VERSION = __APP_VERSION__;

const VERSION_URL
  = "https://profit-admin.xu-wei.space/api/files/releases/version.json";

async function getPlatformKey() {
  try {
    return await invoke("get_platform");
  }
  catch {
    return null;
  }
}

function resolveManualUrl(data, platformKey) {
  if (!data?.platforms?.[platformKey]?.manual?.url) return null;
  return data.platforms[platformKey].manual.url;
}

function hasUpdater(data, platformKey) {
  return !!(data?.platforms?.[platformKey]?.url
    && data?.platforms?.[platformKey]?.signature);
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
  const platformKey = ref(null);

  const updateStatus = ref("idle");
  const downloadTotal = ref(0);
  const downloadedBytes = ref(0);
  const downloadPercent = ref(0);
  const updateError = ref("");

  async function checkVersion() {
    loading.value = true;
    error.value = "";
    updateInfo.value = null;
    updateAvailable.value = false;
    forceUpdate.value = false;

    platformKey.value = await getPlatformKey();

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

  function formatBytes(bytes) {
    if (!bytes) return "0 B";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function startAutoUpdate() {
    updateStatus.value = "checking";
    updateError.value = "";
    downloadTotal.value = 0;
    downloadedBytes.value = 0;
    downloadPercent.value = 0;

    try {
      const update = await check();
      if (!update) {
        updateStatus.value = "idle";
        updateError.value = "没有可用的更新";
        return;
      }

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            downloadTotal.value = event.data.contentLength || 0;
            downloadedBytes.value = 0;
            downloadPercent.value = 0;
            updateStatus.value = "downloading";
            break;
          case "Progress":
            downloadedBytes.value += event.data.chunkLength;
            if (downloadTotal.value > 0) {
              downloadPercent.value = Math.min(
                99,
                Math.round((downloadedBytes.value / downloadTotal.value) * 100),
              );
            }
            break;
          case "Finished":
            downloadPercent.value = 100;
            updateStatus.value = "installing";
            break;
        }
      });

      updateStatus.value = "restarting";
      await invoke("plugin:updater|relaunch");
    }
    catch (e) {
      updateStatus.value = "error";
      updateError.value = e?.message || String(e);
    }
  }

  return {
    checkVersion,
    currentVersion: CURRENT_VERSION,
    downloadPercent,
    downloadTotal,
    downloadedBytes,
    error,
    formatBytes,
    forceUpdate,
    hasUpdater,
    loading,
    platformKey,
    resolveManualUrl,
    startAutoUpdate,
    updateAvailable,
    updateError,
    updateInfo,
    updateStatus,
    versionUrl: VERSION_URL,
  };
}
