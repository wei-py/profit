<script setup>
import { ref, watch } from "vue";
import { vDraggable } from "vue-draggable-plus";

import { useModalEsc } from "@/composables/useModalEsc";

const props = defineProps({
  filterKey: {
    default: "_uid",
    type: String,
  },
  hiddenKeys: {
    default: () => [],
    type: Array,
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
const emit = defineEmits(["close", "update", "update-hidden"]);
useModalEsc(() => props.open, () => emit("close"));

const localOrder = ref([]);
const localHidden = ref(new Set());

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
    if (v) {
      localOrder.value = [...props.items.filter(k => k !== props.filterKey)];
      localHidden.value = new Set(props.hiddenKeys);
    }
  },
);

function toggleCol(key) {
  const next = new Set(localHidden.value);
  if (next.has(key))
    next.delete(key);
  else
    next.add(key);
  localHidden.value = next;
}

function saveOrder() {
  emit("update", [...localOrder.value]);
  emit("update-hidden", [...localHidden.value]);
  emit("close");
}
</script>

<template>
  <div v-if="open" class="modal modal-open">
    <div class="max-h-[80vh] modal-box" style="width: min(48rem, calc(100vw - 1rem));">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg">
          {{ title }}
        </h3>
        <button @click="emit('close')" class="btn btn-circle btn-ghost btn-sm">✕</button>
      </div>
      <div class="mb-2 text-base-content/50 text-xs">拖拽左侧三条杠调整列顺序，点击右侧开关控制显示/隐藏</div>
      <div v-draggable="[localOrder, options]" class="grid max-h-[10.25rem] grid-cols-3 gap-2 overflow-y-auto drag-list">
        <div
          v-for="col in localOrder"
          :key="col"
          class="bg-base-200 flex h-11 gap-2 items-center p-2 text-sm drag-item"
          :class="{ 'opacity-50': localHidden.has(col) }"
        >
          <span
            class="drag-handle flex hover:text-base-content items-center px-1.5 py-0.5 select-none text-base-content/30 cursor-grab"
          >☰</span>
          <span class="flex-1 text-xs truncate" :title="col">{{ col }}</span>
          <input
            :checked="!localHidden.has(col)"
            @change="toggleCol(col)"
            class="toggle toggle-sm"
            type="checkbox"
          >
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
