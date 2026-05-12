<script setup>
import { ref, watch } from 'vue'
import { useCreateStore } from '@/stores/create'

const props = defineProps({
  open: Boolean,
  skuKey: String,
  fieldKey: String,
})
const emit = defineEmits(['close'])

const createStore = useCreateStore()
const traceContent = ref('')

watch(
  () => props.open,
  (v) => {
    if (!v)
      return
    const sku = createStore.skus.find(s => s.key === props.skuKey)
    traceContent.value = sku?.traces?.[props.fieldKey] || '无计算记录'
  },
)
</script>

<template>
  <dialog :open="open" class="modal">
    <div class="modal-box max-w-lg">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold">
          计算过程：{{ fieldKey }}
        </h3>
        <button class="btn btn-ghost btn-sm btn-circle" @click="emit('close')">
          ✕
        </button>
      </div>
      <div class="text-sm leading-relaxed whitespace-pre-wrap">
        {{ traceContent }}
      </div>
      <div class="modal-action">
        <button class="btn btn-sm" @click="emit('close')">
          关闭
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="emit('close')">
      <button>关闭</button>
    </form>
  </dialog>
</template>
