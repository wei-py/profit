<script setup>
import { ref, watch } from "vue";
import { useFileIO } from "@/composables/useFileIO";
import { useModalEsc } from "@/composables/useModalEsc";
import { useTour } from "@/composables/useTour";

import { useConfigStore } from "@/stores/config";

const props = defineProps({
  open: Boolean,
});
const emit = defineEmits(["close"]);
useModalEsc(
  () => props.open,
  () => emit("close"),
);

const store = useConfigStore();
const { openRemoteConfigExcel } = useFileIO();
const { startTour } = useTour();
const remoteHelpSteps = [
  {
    element: "[data-tour=\"remote-url-modal\"]",
    popover: {
      description:
        "粘贴可直接访问的 Excel 配置链接后点击加载。远程配置用于查看和临时使用，保存请使用本地文件。",
      title: "远程配置",
    },
  },
];

const url = ref("");
const loading = ref(false);
const error = ref("");

watch(
  () => props.open,
  (v) => {
    if (v) {
      url.value = store.remoteUrl || "";
      error.value = "";
    }
  },
);

async function load() {
  const u = url.value.trim();
  if (!u)
    return;
  loading.value = true;
  error.value = "";
  const result = await openRemoteConfigExcel(u);
  loading.value = false;
  if (result.success) {
    emit("close");
  }
  else {
    error.value = result.error || "加载失败";
  }
}
</script>

<template>
  <dialog @cancel.prevent class="modal" :open="open">
    <div class="max-w-md modal-box" data-tour="remote-url-modal">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg">远程配置</h3>
        <button
          @click="startTour(remoteHelpSteps)"
          class="btn btn-circle btn-ghost btn-sm"
          title="远程配置帮助"
        >
          ?
        </button>
      </div>
      <div class="space-y-3">
        <div>
          <label class="label py-0 text-xs">配置链接 (Excel 文件 URL)</label>
          <input
            v-model="url"
            @keyup.enter="load"
            class="input input-bordered input-sm w-full"
            placeholder="https://example.com/config.xlsx"
          >
        </div>
        <div v-if="error" class="text-error text-xs">{{ error }}</div>
        <div v-if="loading" class="flex justify-center">
          <span class="loading loading-spinner loading-sm" />
        </div>
      </div>
      <div class="modal-action">
        <button @click="emit('close')" class="btn btn-ghost btn-sm" :disabled="loading">
          取消
        </button>
        <button @click="load" class="btn btn-primary btn-sm" :disabled="loading || !url.trim()">
          加载
        </button>
      </div>
    </div>
    <form @click="emit('close')" class="modal-backdrop" method="dialog">
      <button>关闭</button>
    </form>
  </dialog>
</template>
