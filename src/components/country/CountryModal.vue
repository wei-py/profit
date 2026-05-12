<script setup>
import { driver } from "driver.js";
import { reactive, watch } from "vue";
import { useConfigStore } from "@/stores/config";
import "driver.js/dist/driver.css";

const props = defineProps({
  open: Boolean,
  countryId: String,
  allKeys: Array,
});
const emit = defineEmits(["close"]);

const store = useConfigStore();
const form = reactive({});

const countryEditSteps = [
  {
    popover: {
      title: "编辑国家",
      description:
        "修改国家平台的基本信息。编号、国家、平台、货币等核心字段。自定义列也可以在这里编辑。",
    },
  },
];

function startTour(steps) {
  const d = driver({
    showProgress: true,
    animate: true,
    prevBtnText: "上一步",
    nextBtnText: "下一步",
    doneBtnText: "知道了",
    closeBtnText: "✕",
  });
  d.setSteps(steps);
  d.drive();
}

watch(
  () => props.open,
  (v) => {
    if (v && props.countryId) {
      const row = store["国家平台"].find((r) => r.编号 === props.countryId);
      if (row) Object.assign(form, JSON.parse(JSON.stringify(row)));
    }
  },
);

function save() {
  const idx = store["国家平台"].findIndex((r) => r.编号 === props.countryId);
  if (idx !== -1) store["国家平台"][idx] = { ...form };
  emit("close");
}
</script>

<template>
  <dialog :open="open" class="modal">
    <div class="modal-box max-w-lg">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold">编辑国家</h3>
        <button class="btn btn-ghost btn-sm btn-circle" @click="startTour(countryEditSteps)">
          ?
        </button>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div v-for="k in allKeys" :key="k">
          <label class="label py-0 text-xs">{{ k }}</label>
          <input
            v-if="k !== '启用'"
            v-model="form[k]"
            class="input input-bordered input-sm w-full"
          />
          <select v-else v-model="form.启用" class="select select-bordered select-sm w-full">
            <option>是</option>
            <option>否</option>
          </select>
        </div>
      </div>
      <div class="modal-action">
        <button class="btn btn-ghost btn-sm" @click="emit('close')">取消</button>
        <button class="btn btn-primary btn-sm" @click="save">保存</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="emit('close')">
      <button>关闭</button>
    </form>
  </dialog>
</template>
