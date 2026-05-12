<script setup>
defineProps({
  message: String,
  open: Boolean,
});
const emit = defineEmits(["ok", "close"]);
</script>

<template>
  <dialog class="modal" :open="open">
    <div class="max-w-sm modal-box">
      <h3 class="font-bold mb-4 text-lg">确认操作</h3>
      <p class="text-sm">
        {{ message }}
      </p>
      <div class="modal-action">
        <button @click="emit('close')" class="btn btn-ghost btn-sm">取消</button>
        <button @click="emit('ok')" class="btn btn-error btn-sm">确定</button>
      </div>
    </div>
    <form @click="emit('close')" class="modal-backdrop" method="dialog">
      <button>关闭</button>
    </form>
  </dialog>
</template>
