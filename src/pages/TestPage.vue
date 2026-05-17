<script setup lang="ts">
import { onMounted, ref } from "vue";
import { getFingerprint, validateCode } from "@/services/activation";
import { useActivationStore } from "@/stores/activation";

const store = useActivationStore();
const code = ref("");
const fingerprint = ref("");
const loading = ref(false);
const response = ref<any>(null);

onMounted(async () => {
  fingerprint.value = await getFingerprint();
});

async function handleActivate() {
  const trimmed = code.value.trim();
  if (!trimmed) return;
  loading.value = true;
  const res = await store.activate(trimmed);
  response.value = res;
  loading.value = false;
}

async function handleValidate() {
  const trimmed = code.value.trim();
  if (!trimmed) return;
  loading.value = true;
  const res = await validateCode(trimmed);
  response.value = res;
  loading.value = false;
}

async function handleClear() {
  await store.deactivate();
  response.value = null;
}

function statusBadge(s: string) {
  if (s === "activated") return "badge-success";
  if (s === "checking") return "badge-info";
  return "badge-warning";
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="bg-base-100 card">
      <div class="card-body gap-4">
        <h2 class="card-title">激活码测试</h2>

        <div class="flex items-center gap-2 text-sm">
          <span class="text-base-content/60">设备指纹:</span>
          <code class="bg-base-200 px-2 py-1 rounded text-xs break-all">{{ fingerprint }}</code>
        </div>

        <div class="flex items-center gap-2 text-sm">
          <span class="text-base-content/60">当前状态:</span>
          <span class="badge badge-sm" :class="statusBadge(store.status)">{{ store.status }}</span>
        </div>

        <label class="form-control">
          <div class="label"><span class="label-text">激活码</span></div>
          <input
            v-model="code"
            class="input input-bordered input-sm"
            :disabled="loading"
            placeholder="PFT-XXXX-XXXX"
            type="text"
          />
        </label>

        <div class="flex gap-2">
          <button @click="handleActivate" class="btn btn-sm btn-primary" :disabled="loading">
            <span v-if="loading" class="loading loading-spinner loading-xs" />
            激活
          </button>
          <button @click="handleValidate" class="btn btn-sm" :disabled="loading">校验</button>
          <button @click="handleClear" class="btn btn-sm btn-ghost">清除</button>
        </div>
      </div>
    </div>

    <div v-if="response" class="bg-base-100 card">
      <div class="card-body gap-2">
        <h3 class="font-bold text-sm">响应</h3>
        <pre class="bg-base-200 overflow-auto p-3 rounded text-xs">{{
          JSON.stringify(response, null, 2)
        }}</pre>
      </div>
    </div>
  </div>
</template>
