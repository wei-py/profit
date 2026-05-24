<script setup>
import { open } from "@tauri-apps/plugin-shell";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useFileIO } from "@/composables/useFileIO";
import { useTheme } from "@/composables/useTheme";
import { useVersionCheck } from "@/composables/useVersionCheck";
import { useActivationStore } from "@/stores/activation";

const router = useRouter();
const route = useRoute();
const { restoreLastPath } = useFileIO();
const { init: initTheme } = useTheme();
const activationStore = useActivationStore();
const {
  checkVersion,
  currentVersion,
  downloadedBytes,
  downloadPercent,
  downloadTotal,
  forceUpdate,
  formatBytes,
  hasUpdater,
  platformKey,
  resolveManualUrl,
  startAutoUpdate,
  updateAvailable,
  updateError,
  updateInfo,
  updateStatus,
} = useVersionCheck();

const showUpdateModal = ref(false);
const showForceModal = ref(false);
const showAutoBtn = ref(false);
const appInitialized = ref(false);

async function initAppAfterActivation() {
  if (appInitialized.value)
    return;

  const ok = await activationStore.checkActivation();
  if (!ok) {
    router.replace("/activate");
    return;
  }

  await restoreLastPath();
  await initTheme();

  await checkVersion();
  showAutoBtn.value = hasUpdater(updateInfo.value, platformKey.value);

  if (forceUpdate.value)
    showForceModal.value = true;
  else if (updateAvailable.value)
    showUpdateModal.value = true;

  appInitialized.value = true;
}

function showCheckedUpdateResult() {
  showAutoBtn.value = hasUpdater(updateInfo.value, platformKey.value);

  if (forceUpdate.value) {
    showForceModal.value = true;
  }
  else if (updateAvailable.value) {
    showUpdateModal.value = true;
  }
  else {
    alert("已是最新版本");
  }
}

function handleDismissUpdate() {
  showUpdateModal.value = false;
}

async function handleAutoUpdate() {
  await startAutoUpdate();
}

async function handleManualDownload() {
  const url = resolveManualUrl(updateInfo.value, platformKey.value);
  if (url) {
    await open(url);
  }
}

async function handleCheckUpdateRequest() {
  if (isUpdating.value)
    return;
  showUpdateModal.value = false;
  showForceModal.value = false;
  await checkVersion();
  showCheckedUpdateResult();
}

onMounted(async () => {
  window.addEventListener("profit-check-update", handleCheckUpdateRequest);

  if (route.path === "/activate") {
    await initTheme();
    return;
  }

  await initAppAfterActivation();
});

watch(
  () => route.path,
  async (path, oldPath) => {
    if (oldPath === "/activate" && path !== "/activate")
      await initAppAfterActivation();
  },
);

onUnmounted(() => {
  window.removeEventListener("profit-check-update", handleCheckUpdateRequest);
});

const isUpdating = computed(() =>
  ["checking", "downloading", "installing", "restarting"].includes(updateStatus.value),
);

const statusText = computed(() => {
  switch (updateStatus.value) {
    case "checking": return "正在检查更新...";
    case "downloading": return `正在下载 ${downloadPercent.value}%`;
    case "installing": return "正在安装更新...";
    case "restarting": return "即将重启应用...";
    case "error": return updateError.value || "更新失败";
    default: return "";
  }
});
</script>

<template>
  <router-view v-if="!showForceModal" />

  <!-- 可选更新弹窗 -->
  <dialog v-if="showUpdateModal && updateInfo" class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg">发现新版本</h3>
      <div class="py-3 space-y-2 text-sm">
        <p>
          当前版本：<span class="font-mono">{{ currentVersion }}</span> → 最新版本：<span
            class="font-mono font-bold text-primary"
          >{{ updateInfo.version }}</span>
        </p>
        <p v-if="updateInfo.notes" class="max-h-48 overflow-auto whitespace-pre-line rounded bg-base-200 p-3 text-sm text-base-content/70">
          {{ updateInfo.notes }}
        </p>

        <!-- 进度条 -->
        <div v-if="isUpdating || updateStatus === 'error'" class="space-y-2">
          <div class="flex items-center gap-2">
            <span
              v-if="updateStatus === 'downloading'"
              class="loading loading-spinner loading-sm"
            />
            <span class="text-xs">{{ statusText }}</span>
          </div>
          <progress
            v-if="updateStatus === 'downloading'"
            class="progress progress-primary w-full"
            max="100"
            :value="downloadPercent"
          />
          <div v-if="updateStatus === 'downloading'" class="text-xs text-base-content/40">
            {{ formatBytes(downloadedBytes) }}
            <template v-if="downloadTotal"> / {{ formatBytes(downloadTotal) }}</template>
          </div>
          <div v-if="updateStatus === 'restarting'" class="text-xs text-base-content/60">
            更新已完成，应用即将重启
          </div>
          <div v-if="updateStatus === 'error'" class="text-xs text-error">
            {{ statusText }}
          </div>
        </div>
      </div>
      <div class="modal-action">
        <button
          v-if="!isUpdating"
          @click="handleDismissUpdate"
          class="btn btn-sm btn-ghost"
        >
          稍后提醒
        </button>
        <button
          v-if="showAutoBtn && updateStatus !== 'restarting'"
          @click="handleAutoUpdate"
          class="btn btn-sm btn-primary"
          :disabled="isUpdating"
        >
          {{ isUpdating ? "更新中..." : "自动更新" }}
        </button>
        <button
          v-if="!isUpdating"
          @click="handleManualDownload"
          class="btn btn-sm btn-ghost"
        >
          手动下载
        </button>
      </div>
    </div>
    <form class="modal-backdrop" method="dialog">
      <button v-if="!isUpdating" @click="handleDismissUpdate" />
    </form>
  </dialog>

  <!-- 强制更新弹窗（不可关闭） -->
  <dialog v-if="showForceModal && updateInfo" class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg">必须更新</h3>
      <div class="py-3 space-y-2 text-sm">
        <p>检测到重要更新，当前版本已不兼容，请更新后继续使用。</p>
        <p v-if="updateInfo.notes" class="max-h-48 overflow-auto whitespace-pre-line rounded bg-base-200 p-3 text-sm text-base-content/70">
          {{ updateInfo.notes }}
        </p>
        <p class="font-mono text-sm">
          {{ currentVersion }} →
          <span class="text-primary font-bold">{{ updateInfo.version }}</span>
        </p>

        <div v-if="isUpdating || updateStatus === 'error'" class="space-y-2">
          <div class="flex items-center gap-2">
            <span
              v-if="updateStatus === 'downloading'"
              class="loading loading-spinner loading-sm"
            />
            <span class="text-xs">{{ statusText }}</span>
          </div>
          <progress
            v-if="updateStatus === 'downloading'"
            class="progress progress-primary w-full"
            max="100"
            :value="downloadPercent"
          />
          <div v-if="updateStatus === 'downloading'" class="text-xs text-base-content/40">
            {{ formatBytes(downloadedBytes) }}
            <template v-if="downloadTotal"> / {{ formatBytes(downloadTotal) }}</template>
          </div>
          <div v-if="updateStatus === 'restarting'" class="text-xs text-base-content/60">
            更新已完成，应用即将重启
          </div>
          <div v-if="updateStatus === 'error'" class="text-xs text-error">
            {{ statusText }}
          </div>
        </div>
      </div>
      <div class="modal-action">
        <button
          v-if="showAutoBtn && updateStatus !== 'restarting'"
          @click="handleAutoUpdate"
          class="btn btn-sm btn-primary"
          :disabled="isUpdating"
        >
          {{ isUpdating ? "更新中..." : "自动更新" }}
        </button>
        <button
          v-if="!isUpdating"
          @click="handleManualDownload"
          class="btn btn-sm btn-primary"
        >
          下载更新
        </button>
      </div>
    </div>
  </dialog>
</template>
