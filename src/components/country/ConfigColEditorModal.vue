<script setup>
import { ref, watch } from 'vue'
import { useSortable } from '@/composables/useSortable'

const props = defineProps({
  open: Boolean,
  title: { type: String, default: '编辑列顺序' },
  items: { type: Array, required: true },
})
const emit = defineEmits(['close', 'update'])

const localOrder = ref([])
const containerRef = ref(null)

useSortable(containerRef, localOrder, { handle: '.drag-handle', animation: 200 })

watch(
  () => props.open,
  (v) => {
    if (v)
      localOrder.value = [...props.items]
  },
)
</script>

<template>
  <div v-if="open" class="modal modal-open">
    <div class="modal-box max-w-lg">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold">
          {{ title }}
        </h3>
        <button class="btn btn-ghost btn-sm btn-circle" @click="emit('close')">
          ✕
        </button>
      </div>
      <div class="text-xs text-base-content/50 mb-2">
        拖拽左侧三条杠调整列顺序
      </div>
      <div ref="containerRef">
        <div
          v-for="col in localOrder"
          :key="col"
          class="sortable-item flex items-center gap-2 p-2 bg-base-200 rounded text-sm mb-1"
        >
          <span
            class="drag-handle cursor-grab text-base-content/30 hover:text-base-content flex items-center px-1.5 py-0.5 select-none"
            title="拖拽排序"
          >☰</span>
          <span class="flex-1 truncate text-xs" :title="col">{{ col }}</span>
        </div>
      </div>
      <div class="modal-action mt-4">
        <button class="btn btn-ghost btn-sm" @click="emit('close')">
          取消
        </button>
        <button
          class="btn btn-primary btn-sm"
          @click="
            emit('update', localOrder);
            emit('close');
          "
        >
          完成
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="emit('close')">
      <button>关闭</button>
    </form>
  </div>
</template>
