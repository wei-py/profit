<script setup>
import { ref, watch } from "vue";
import { useModalEsc } from "@/composables/useModalEsc";

import { useCreateStore } from "@/stores/create";

const props = defineProps({
  fieldKey: String,
  open: Boolean,
  skuKey: String,
});
const emit = defineEmits(["close"]);
useModalEsc(
  () => props.open,
  () => emit("close"),
);

const createStore = useCreateStore();
const traceContent = ref("");

watch(
  () => props.open,
  (v) => {
    if (!v)
      return;
    const sku = createStore.skus.find(s => s.key === props.skuKey);
    traceContent.value = sku?.traces?.[props.fieldKey] || "无计算记录";
  },
);
</script>

<template>
  <dialog @cancel.prevent class="modal" :open="open">
    <div class="max-w-lg modal-box">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg">计算过程：{{ fieldKey }}</h3>
        <button @click="emit('close')" class="btn btn-circle btn-ghost btn-sm">✕</button>
      </div>
      <div class="leading-relaxed text-sm whitespace-pre-wrap">
        {{ traceContent }}
      </div>
      <div class="modal-action">
        <button @click="emit('close')" class="btn btn-sm">关闭</button>
      </div>
    </div>
    <form @click="emit('close')" class="modal-backdrop" method="dialog">
      <button>关闭</button>
    </form>
  </dialog>
</template>
