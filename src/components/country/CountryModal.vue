<script setup>
import { driver } from "driver.js";
import { reactive, watch } from "vue";
import OptionTreeSelect from "@/components/common/OptionTreeSelect.vue";
import { useConfigStore } from "@/stores/config";
import "driver.js/dist/driver.css";

import { useModalEsc } from "@/composables/useModalEsc";

const props = defineProps({
  allKeys: Array,
  countryId: String,
  open: Boolean,
});
const emit = defineEmits(["close"]);
useModalEsc(() => props.open, () => emit("close"));

const store = useConfigStore();
const form = reactive({});
const yesNoOptions = ["是", "否"];

const countryEditSteps = [
  {
    popover: {
      description:
        "修改国家平台的基本信息。编号、国家、平台、货币等核心字段。自定义列也可以在这里编辑。",
      title: "编辑国家",
    },
  },
];

function startTour(steps) {
  const d = driver({
    animate: true,
    closeBtnText: "✕",
    doneBtnText: "知道了",
    nextBtnText: "下一步",
    prevBtnText: "上一步",
    showProgress: true,
  });
  d.setSteps(steps);
  d.drive();
}

watch(
  () => props.open,
  (v) => {
    if (v && props.countryId) {
      const row = store["国家平台"].find(r => r.编号 === props.countryId);
      if (row)
        Object.assign(form, JSON.parse(JSON.stringify(row)));
    }
  },
);

function save() {
  const idx = store["国家平台"].findIndex(r => r.编号 === props.countryId);
  if (idx !== -1)
    store["国家平台"][idx] = { ...form };
  emit("close");
}
</script>

<template>
  <dialog class="modal" :open="open" @cancel.prevent>
    <div class="max-w-lg modal-box">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg">编辑国家</h3>
        <button @click="startTour(countryEditSteps)" class="btn btn-circle btn-ghost btn-sm">
          ?
        </button>
      </div>
      <div class="gap-3 grid grid-cols-2">
        <div v-for="k in allKeys" :key="k">
          <label class="label py-0 text-xs">{{ k }}</label>
          <input
            v-if="k !== '启用'"
            v-model="form[k]"
            class="input input-bordered input-sm w-full"
          >
          <OptionTreeSelect v-else v-model="form.启用" :options="yesNoOptions" placeholder="—" size="sm" />
        </div>
      </div>
      <div class="modal-action">
        <button @click="emit('close')" class="btn btn-ghost btn-sm">取消</button>
        <button @click="save" class="btn btn-primary btn-sm">保存</button>
      </div>
    </div>
    <form @click="emit('close')" class="modal-backdrop" method="dialog">
      <button>关闭</button>
    </form>
  </dialog>
</template>
