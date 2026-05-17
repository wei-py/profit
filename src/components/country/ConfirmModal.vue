<script setup>
import { useModalEsc } from "@/composables/useModalEsc";
import { useTour } from "@/composables/useTour";

const props = defineProps({
  message: String,
  open: Boolean,
});
const emit = defineEmits(["ok", "close"]);
useModalEsc(
  () => props.open,
  () => emit("close"),
);
const { startTour } = useTour();
const confirmHelpSteps = [
  {
    element: "[data-tour=\"confirm-modal\"]",
    popover: {
      description: "这是高风险操作确认。确认前请检查提示内容，确定后才会执行删除或覆盖。",
      title: "确认操作",
    },
  },
];
</script>

<template>
  <dialog @cancel.prevent class="modal" :open="open">
    <div class="max-w-sm modal-box" data-tour="confirm-modal">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="font-bold text-lg">确认操作</h3>
        <button
          @click="startTour(confirmHelpSteps)"
          class="btn btn-circle btn-ghost btn-sm"
          title="确认操作帮助"
        >
          ?
        </button>
      </div>
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
