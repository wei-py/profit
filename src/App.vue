<script setup>
import { onMounted, ref } from "vue";
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
const { checkVersion, currentVersion, forceUpdate, updateAvailable, updateInfo, resolveDownloadUrl }
  = useVersionCheck();

const showUpdateModal = ref(false);
const showForceModal = ref(false);

function formatSize(bytes) {
  if (!bytes) {
    return "";
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function handleOpenDownload() {
  const url = await resolveDownloadUrl(updateInfo.value);
  if (url) {
    window.open(url, "_blank");
  }
}

function handleDismissUpdate() {
  showUpdateModal.value = false;
}

/** 应用根组件。 启动时校验激活状态，未激活则跳转激活页。 */
onMounted(async () => {
  // 激活页本身不校验
  if (route.path === "/activate")
    return;

  const ok = await activationStore.checkActivation();
  if (!ok) {
    router.replace("/activate");
    return;
  }

  await restoreLastPath();
  await initTheme();

  // 版本检查
  await checkVersion();
  if (forceUpdate.value) {
    showForceModal.value = true;
  }
  else if (updateAvailable.value) {
    showUpdateModal.value = true;
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
        <p v-if="updateInfo.release_notes" class="text-base-content/60">
          {{ updateInfo.release_notes }}
        </p>
        <p v-if="updateInfo.download_size" class="text-base-content/40 text-xs">
          {{ formatSize(updateInfo.download_size) }}
        </p>
      </div>
      <div class="modal-action">
        <button @click="handleDismissUpdate" class="btn btn-sm btn-ghost">稍后提醒</button>
        <button @click="handleOpenDownload" class="btn btn-sm btn-primary">立即更新</button>
      </div>
    </div>
    <form class="modal-backdrop" method="dialog">
      <button @click="handleDismissUpdate" />
    </form>
  </dialog>

  <!-- 强制更新弹窗（不可关闭） -->
  <dialog v-if="showForceModal && updateInfo" class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg">必须更新</h3>
      <div class="py-3 space-y-2 text-sm">
        <p>检测到重要更新，当前版本已不兼容，请更新后继续使用。</p>
        <p v-if="updateInfo.release_notes" class="text-base-content/60">
          {{ updateInfo.release_notes }}
        </p>
        <p class="font-mono text-sm">
          {{ currentVersion }} →
          <span class="text-primary font-bold">{{ updateInfo.version }}</span>
        </p>
      </div>
      <div class="modal-action">
        <button @click="handleOpenDownload" class="btn btn-sm btn-primary">下载更新</button>
      </div>
    </div>
  </dialog>
</template>
