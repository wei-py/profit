<script setup>
import { ref, watch } from "vue";
import { useSortable } from "@/composables/useSortable";

const props = defineProps({
  items: {
    required: true,
    type: Array,
  },
  open: Boolean,
  title: {
    default: "编辑列顺序",
    type: String,
  },
});
const emit = defineEmits(["close", "update"]);

const localOrder = ref([]);
const containerRef = ref(null);

useSortable(containerRef, localOrder, {
  animation: 200,
  handle: ".drag-handle",
});

watch(
  () => props.open,
  (v) => {
    if (v)
      localOrder.value = [...props.items];
  },
);
</script>

<template>
  <div v-if="open" class="modal modal-open">
    <div class="max-w-lg modal-box">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg">
          {{ title }}
        </h3>
        <button @click="emit('close')" class="btn btn-circle btn-ghost btn-sm">✕</button>
      </div>
      <div class="mb-2 text-base-content/50 text-xs">拖拽左侧三条杠调整列顺序</div>
      <div ref="containerRef">
        <div
          v-for="col in localOrder"
          :key="col"
          class="bg-base-200 flex gap-2 items-center mb-1 p-2 rounded sortable-item text-sm"
        >
          <span
            class="cursor-grab drag-handle flex hover:text-base-content items-center px-1.5 py-0.5 select-none text-base-content/30"
            title="拖拽排序"
          >☰</span>
          <span class="flex-1 text-xs truncate" :title="col">{{ col }}</span>
        </div>
      </div>
      <div class="modal-action mt-4">
        <button @click="emit('close')" class="btn btn-ghost btn-sm">取消</button>
        <button
          @click="
            emit('update', localOrder);
            emit('close');
          "
          class="btn btn-primary btn-sm"
        >
          完成
        </button>
      </div>
    </div>
    <form @click="emit('close')" class="modal-backdrop" method="dialog">
      <button>关闭</button>
    </form>
  </div>
</template>
