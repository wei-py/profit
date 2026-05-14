<script setup>
import { ref, watch } from "vue";
import { vDraggable } from "vue-draggable-plus";

const props = defineProps({
  filterKey: {
    default: "_uid",
    type: String,
  },
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

const options = {
  animation: 150,
  chosenClass: "drag-chosen",
  dragClass: "drag-drag",
  fallbackOnBody: true,
  forceFallback: true,
  ghostClass: "drag-ghost",
  handle: ".drag-handle",
};

watch(
  () => props.open,
  (v) => {
    if (v)
      localOrder.value = [...props.items.filter(k => k !== props.filterKey)];
  },
);

function saveOrder() {
  emit("update", [...localOrder.value]);
  emit("close");
}
</script>

<template>
  <div v-if="open" class="modal modal-open">
    <div class="max-h-[80vh] max-w-lg modal-box">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg">
          {{ title }}
        </h3>
        <button @click="emit('close')" class="btn btn-circle btn-ghost btn-sm">✕</button>
      </div>
      <div class="mb-2 text-base-content/50 text-xs">拖拽左侧三条杠调整列顺序</div>
      <div v-draggable="[localOrder, options]" class="overflow-y-auto drag-list">
        <div
          v-for="col in localOrder"
          :key="col"
          class="bg-base-200 flex gap-2 items-center mb-1 p-2 rounded text-sm drag-item"
        >
          <span
            class="drag-handle flex hover:text-base-content items-center px-1.5 py-0.5 select-none text-base-content/30 cursor-grab"
          >☰</span>
          <span class="flex-1 text-xs truncate" :title="col">{{ col }}</span>
        </div>
      </div>
      <div class="modal-action mt-4">
        <button @click="emit('close')" class="btn btn-ghost btn-sm">取消</button>
        <button
          @click="saveOrder"
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
