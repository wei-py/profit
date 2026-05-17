<script setup>
import dayjs from "dayjs";
import { ref } from "vue";
import { useAdminStore } from "@/stores/admin";

const props = defineProps({
  code: { required: true, type: Object },
});

const emit = defineEmits(["close"]);
const store = useAdminStore();

const newCode = ref(props.code.code);
const editStatus = ref(props.code.status);
const maxDevices = ref(props.code.max_devices);
const expiresAt = ref("");

if (props.code.expires_at) {
  const d = dayjs(props.code.expires_at);
  if (d.isValid()) {
    expiresAt.value = d.format("YYYY-MM-DDTHH:mm");
  }
}

const updating = ref(false);
const result = ref(null);
const error = ref("");

async function handleUpdate() {
  updating.value = true;
  error.value = "";

  const updates = {
    expires_at: expiresAt.value ? dayjs(expiresAt.value).toISOString() : null,
    max_devices: maxDevices.value !== props.code.max_devices ? maxDevices.value : undefined,
    new_code: newCode.value !== props.code.code ? newCode.value : undefined,
    status: editStatus.value !== props.code.status ? editStatus.value : undefined,
  };

  if (updates.new_code === undefined)
    delete updates.new_code;
  if (updates.status === undefined)
    delete updates.status;
  if (updates.max_devices === undefined)
    delete updates.max_devices;

  if (props.code.expires_at) {
    if (
      expiresAt.value
      && dayjs(expiresAt.value).toISOString() === dayjs(props.code.expires_at).toISOString()
    ) {
      delete updates.expires_at;
    }
  }
  else {
    if (!expiresAt.value) {
      delete updates.expires_at;
    }
  }

  if (Object.keys(updates).length === 0) {
    error.value = "没有修改";
    updating.value = false;
    return;
  }

  const resp = await store.doUpdate(props.code.code, updates);
  updating.value = false;

  if (resp.success) {
    result.value = true;
  }
  else {
    error.value = resp.error || "更新失败";
  }
}
</script>

<template>
  <dialog class="modal" open>
    <div class="modal-box max-w-full sm:max-w-md">
      <h3 class="font-bold text-lg">编辑激活码</h3>

      <div v-if="result" class="mt-4">
        <p class="text-success mb-2">更新成功</p>
        <button @click="emit('close')" class="btn btn-sm btn-primary">关闭</button>
      </div>

      <div v-else class="mt-4 flex flex-col gap-3">
        <div v-if="error" class="alert alert-error">
          <span>{{ error }}</span>
        </div>

        <div class="flex items-center justify-between">
          <span>激活码</span>
          <input
            v-model="newCode"
            class="input input-bordered input-sm w-44 font-mono"
            type="text"
          >
        </div>

        <div class="flex items-center justify-between">
          <span>状态</span>
          <select v-model="editStatus" class="select select-bordered select-sm w-44">
            <option value="active">active</option>
            <option value="revoked">revoked</option>
            <option value="expired">expired</option>
          </select>
        </div>

        <div class="flex items-center justify-between">
          <span>最大设备数</span>
          <input
            v-model.number="maxDevices"
            class="input input-bordered input-sm w-20"
            max="100"
            min="1"
            type="number"
          >
        </div>

        <div class="flex items-center justify-between">
          <span>过期时间</span>
          <input
            v-model="expiresAt"
            class="input input-bordered input-sm w-44"
            type="datetime-local"
          >
        </div>
        <div class="text-xs text-base-content/40 text-right">留空为永久有效</div>

        <div class="modal-action">
          <button @click="emit('close')" class="btn btn-sm">取消</button>
          <button @click="handleUpdate" class="btn btn-sm btn-primary" :disabled="updating">
            <span v-if="updating" class="loading loading-spinner loading-xs" />
            保存
          </button>
        </div>
      </div>
    </div>
    <form class="modal-backdrop" method="dialog">
      <button @click="emit('close')" />
    </form>
  </dialog>
</template>
