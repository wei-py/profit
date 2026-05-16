<script setup>
import { ref, watch } from "vue";
import { useConfigStore } from "@/stores/config";
import { useFileIO } from "@/composables/useFileIO";

const props = defineProps({
  open: Boolean,
});
const emit = defineEmits(["close"]);

const store = useConfigStore();
const { openRemoteConfigExcel } = useFileIO();

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
  <dialog class="modal" :open="open">
    <div class="max-w-md modal-box">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg">远程配置</h3>
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
