<script setup>
import { computed, ref, watch } from 'vue'
import { VueDraggableNext } from 'vue-draggable-next'
import { useConfigStore } from '@/stores/config'

const props = defineProps({
  open: Boolean,
})
const emit = defineEmits(['close'])

const store = useConfigStore()
const CORE_KEYS = ['编号', '国家', '平台', '货币', '货币符号', '汇率', '启用', '排序']
const colOrder = ref([])

const allKeys = computed(() => {
  const keys = new Set(CORE_KEYS)
  for (const row of store['国家平台']) {
    for (const k of Object.keys(row)) {
      if (k)
        keys.add(k)
    }
  }
  return [...keys]
})

watch(
  () => props.open,
  (v) => {
    if (v)
      colOrder.value = [...allKeys.value]
  },
)
</script>

<template>
  <dialog :open="open" class="modal">
    <div class="modal-box max-w-lg">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold">
          编辑列顺序
        </h3>
        <button class="btn btn-ghost btn-sm btn-circle" @click="emit('close')">
          ✕
        </button>
      </div>
      <div class="text-xs text-base-content/50 mb-2">
        拖拽左侧三条杠调整列顺序
      </div>
      <VueDraggableNext
        v-model="colOrder"
        :animation="200"
        handle=".drag-handle"
        ghost-class="bg-base-300"
        :item-key="(item) => item"
      >
        <div
          v-for="col in colOrder"
          :key="col"
          class="flex items-center gap-2 p-2 bg-base-200 rounded text-sm mb-1"
        >
          <span
            class="drag-handle cursor-grab text-base-content/30 hover:text-base-content flex items-center px-1.5 py-0.5 select-none"
            title="拖拽排序"
          >☰</span>
          <span class="flex-1 truncate text-xs" :title="col">{{ col }}</span>
        </div>
      </VueDraggableNext>
      <div class="modal-action mt-4">
        <button class="btn btn-ghost btn-sm" @click="emit('close')">
          取消
        </button>
        <button class="btn btn-primary btn-sm" @click="emit('close')">
          完成
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="emit('close')">
      <button>关闭</button>
    </form>
  </dialog>
</template>
