<script setup>
import { ref } from "vue";
import { useAdminStore } from "@/stores/admin";

const emit = defineEmits(["close"]);
const store = useAdminStore();

const count = ref(1);
const maxDevices = ref(1);
const expiresIn = ref("");
const remark = ref("");
const creating = ref(false);
const result = ref(null);
const error = ref("");

async function fillTemplate() {
  const resp = await store.doGetTemplate();
  if (resp.success && resp.value) {
    remark.value = resp.value;
  }
}

async function handleCreate() {
  creating.value = true;
  error.value = "";

  const resp = await store.doCreate({
    count: count.value,
    expires_in: expiresIn.value || undefined,
    max_devices: maxDevices.value,
    remark: remark.value || undefined,
  });

  creating.value = false;

  if (resp.success) {
    result.value = resp.created;
  }
  else {
    error.value = resp.error || "创建失败";
  }
}

function copyAll() {
  if (!result.value)
    return;
  const text = result.value.map(c => c.code).join("\n");
  navigator.clipboard.writeText(text);
}
</script>

<template>
  <dialog class="modal" open>
    <div class="modal-box">
      <h3 class="font-bold text-lg">批量创建激活码</h3>

      <div v-if="result" class="mt-4">
        <p class="text-success mb-2">成功创建 {{ result.length }} 个激活码</p>
        <div class="bg-base-200 p-2 rounded text-xs font-mono overflow-auto max-h-40">
          <div v-for="c in result" :key="c.code">{{ c.code }}</div>
        </div>
        <button @click="copyAll" class="btn btn-sm btn-primary mt-2">复制全部</button>
        <button @click="emit('close')" class="btn btn-sm mt-2">关闭</button>
      </div>

      <div v-else class="mt-4 flex flex-col gap-3">
        <div v-if="error" class="alert alert-error">
          <span>{{ error }}</span>
        </div>

        <div class="flex items-center justify-between">
          <span>数量</span>
          <input
            v-model.number="count"
            class="input input-bordered input-sm w-20"
            max="100"
            min="1"
            type="number"
          >
        </div>

        <div class="flex items-center justify-between">
          <span>最大设备数</span>
          <input
            v-model.number="maxDevices"
            class="input input-bordered input-sm w-20"
            max="10"
            min="1"
            type="number"
          >
        </div>

        <div class="flex items-center justify-between">
          <span>有效期</span>
          <input
            v-model="expiresIn"
            class="input input-bordered input-sm w-28"
            placeholder="如 30d 90d 1y"
            type="text"
          >
        </div>

        <div class="flex items-center justify-between">
          <span>备注</span>
          <div class="flex gap-1">
            <input
              v-model="remark"
              class="input input-bordered input-sm w-36"
              placeholder="备注内容"
              type="text"
            >
            <button @click="fillTemplate" class="btn btn-xs btn-ghost">模板</button>
          </div>
        </div>

        <div class="modal-action">
          <button @click="emit('close')" class="btn btn-sm">取消</button>
          <button
            @click="handleCreate"
            class="btn btn-sm btn-primary"
            :disabled="creating"
          >
            <span v-if="creating" class="loading loading-spinner loading-xs" />
            创建
          </button>
        </div>
      </div>
    </div>
    <form class="modal-backdrop" method="dialog">
      <button @click="emit('close')" />
    </form>
  </dialog>
</template>
