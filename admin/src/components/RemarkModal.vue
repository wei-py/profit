<script setup>
import { ref } from "vue";
import { useAdminStore } from "@/stores/admin";

const props = defineProps({ code: String, remark: String });
const emit = defineEmits(["close"]);
const store = useAdminStore();

const text = ref(props.remark || "");
const saving = ref(false);
const templateLoading = ref(false);

async function fillTemplate() {
  templateLoading.value = true;
  const resp = await store.doGetTemplate();
  templateLoading.value = false;
  if (resp.success && resp.value) {
    text.value = resp.value;
  }
}

async function handleSave() {
  saving.value = true;
  await store.doUpdateRemark(props.code, text.value);
  saving.value = false;
  emit("close");
}
</script>

<template>
  <dialog class="modal" open>
    <div class="modal-box">
      <h3 class="font-bold text-lg">编辑备注 - {{ props.code }}</h3>
      <div class="mt-4 flex flex-col gap-3">
        <textarea
          v-model="text"
          class="textarea textarea-bordered h-32 w-full"
          placeholder="输入备注内容"
        />
        <div class="modal-action">
          <button @click="fillTemplate" class="btn btn-sm btn-ghost" :disabled="templateLoading">
            从模板填充
          </button>
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
