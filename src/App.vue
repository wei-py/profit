<script setup>
import { onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useFileIO } from "@/composables/useFileIO";
import { useTheme } from "@/composables/useTheme";
import { useActivationStore } from "@/stores/activation";

const router = useRouter();
const route = useRoute();
const { restoreLastPath } = useFileIO();
const { init: initTheme } = useTheme();
const activationStore = useActivationStore();

/**
 * 应用根组件。
 * 启动时校验激活状态，未激活则跳转激活页。
 */
onMounted(async () => {
  // 激活页本身不校验
  if (route.path === "/activate") return;

  const ok = await activationStore.checkActivation();
  if (!ok) {
    router.replace("/activate");
    return;
  }

  await restoreLastPath();
  await initTheme();
});
</script>

<template>
  <router-view />
</template>
