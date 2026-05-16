<script setup>
import { onMounted, ref } from "vue";
import { useAdminStore } from "@/stores/admin";

const emit = defineEmits(["close"]);
const store = useAdminStore();

const text = ref("");
const saving = ref(false);
const loading = ref(true);

onMounted(async () => {
  const resp = await store.doGetTemplate();
  loading.value = false;
  if (resp.success) {
    text.value = resp.value || "";
  }
});

async function handleSave() {
  saving.value = true;
  await store.doSaveTemplate(text.value);
  saving.value = false;
  emit("close");
}

function copyAll() {
  navigator.clipboard.writeText(text.value);
}
</script>

<template>
  <dialog class="modal" open>
    <div class="modal-box max-w-full sm:max-w-md">
      <h3 class="font-bold text-lg">备注模板</h3>
      <div v-if="loading" class="flex justify-center py-6">
        <span class="loading loading-spinner" />
      </div>
      <div v-else class="mt-4 flex flex-col gap-3">
        <textarea
          v-model="text"
          class="textarea textarea-bordered h-40 w-full"
          placeholder="输入备注模板内容，创建激活码时可一键填入"
        />
        <div class="modal-action">
          <button @click="copyAll" class="btn btn-sm btn-ghost">复制</button>
          <button @click="emit('close')" class="btn btn-sm">取消</button>
          <button @click="handleSave" class="btn btn-sm btn-primary" :disabled="saving">
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
