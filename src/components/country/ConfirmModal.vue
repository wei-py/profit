<script setup>
defineProps({
  open: Boolean,
  message: String,
})
const emit = defineEmits(['ok', 'close'])
</script>

<template>
  <dialog :open="open" class="modal">
    <div class="modal-box max-w-sm">
      <h3 class="text-lg font-bold mb-4">
        确认操作
      </h3>
      <p class="text-sm">
        {{ message }}
      </p>
      <div class="modal-action">
        <button class="btn btn-ghost btn-sm" @click="emit('close')">
          取消
        </button>
        <button class="btn btn-error btn-sm" @click="emit('ok')">
          确定
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="emit('close')">
      <button>关闭</button>
    </form>
  </dialog>
</template>
