<script setup>
import { driver } from "driver.js";
import { reactive, ref, watch } from "vue";
import { vDraggable } from "vue-draggable-plus";
import { useConfigStore } from "@/stores/config";
import "driver.js/dist/driver.css";

const props = defineProps({
  cpId: String,
  groupIdx: Number,
  open: Boolean,
});
const emit = defineEmits(["close"]);

const store = useConfigStore();
const form = reactive({});
const items = ref([]);
let _uid = 0;

const dragOpts = {
  animation: 150,
  chosenClass: "drag-chosen",
  dragClass: "drag-drag",
  fallbackOnBody: true,
  forceFallback: true,
  ghostClass: "drag-ghost",
  handle: ".drag-handle",
  onEnd: () => {
    items.value.forEach((item, i) => { item.排序 = i + 1; });
  },
};

const optionEditSteps = [
  {
    popover: {
      description: "选项组为下拉字段提供可选值。编号建议带国家前缀（如 br_刊登类型）。",
      title: "编辑选项组",
    },
  },
  {
    element: "[data-tour=\"opt-items\"]",
    popover: {
      description:
        "选项值=存储值（code），显示名=用户看到的文本。启用=否则该选项不出现在下拉框中。拖拽左侧三条杠可排序。",
      title: "选项值",
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
    if (!v)
      return;
    _uid = 0;
    if (props.groupIdx >= 0) {
      const groups = store.getOptionGroupsByCountry(props.cpId);
      const g = groups[props.groupIdx];
      Object.assign(form, JSON.parse(JSON.stringify(g)));
      items.value = JSON.parse(JSON.stringify(store.getOptionItemsByGroup(g.编号))).map(item => ({
        ...item,
        _uid: ++_uid,
      }));
    }
    else {
      Object.assign(form, {
        名称: "",
        所属国家平台: props.cpId,
        编号: "",
        说明: "",
      });
      items.value = [];
    }
  },
);

function addItem() {
  items.value.push({
    _uid: ++_uid,
    启用: "是",
    备注: "",
    所属分组: form.编号,
    排序: "",
    显示名: "",
    选项值: "",
  });
}
function delItem(i) {
  items.value.splice(i, 1);
}

function save() {
  if (props.groupIdx >= 0) {
    const groups = store.getOptionGroupsByCountry(props.cpId);
    const x = store["选项组"].indexOf(groups[props.groupIdx]);
    if (x !== -1)
      store["选项组"][x] = { ...form };
    const keep = store["选项值"].filter(r => r.所属分组 !== form.编号);
    store["选项值"] = [...keep, ...items.value];
  }
  else {
    store["选项组"].push({ ...form });
    store["选项值"] = [...store["选项值"], ...items.value];
  }
  emit("close");
}

function deleteGroup() {
  if (props.groupIdx >= 0) {
    const groups = store.getOptionGroupsByCountry(props.cpId);
    const g = groups[props.groupIdx];
    store["选项组"] = store["选项组"].filter(r => r.编号 !== g.编号);
    store["选项值"] = store["选项值"].filter(r => r.所属分组 !== g.编号);
  }
  emit("close");
}
</script>

<template>
  <dialog class="modal" :open="open">
    <div class="max-h-[85vh] max-w-2xl modal-box overflow-y-auto">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg">
          {{ groupIdx >= 0 ? "编辑选项组" : "新建选项组" }}
        </h3>
        <button @click="startTour(optionEditSteps)" class="btn btn-circle btn-ghost btn-sm">
          ?
        </button>
      </div>
      <div class="gap-3 grid grid-cols-3 mb-4">
        <div>
          <label class="label py-0 text-xs">编号</label>
          <input v-model="form.编号" class="input input-bordered input-sm w-full">
        </div>
        <div>
          <label class="label py-0 text-xs">名称</label>
          <input v-model="form.名称" class="input input-bordered input-sm w-full">
        </div>
        <div>
          <label class="label py-0 text-xs">说明</label>
          <input v-model="form.说明" class="input input-bordered input-sm w-full">
        </div>
      </div>
      <div>
        <div class="flex items-center justify-between mb-2">
          <span
            class="font-semibold text-sm"
            data-tour="opt-items"
          >选项值（{{ items.length }}）</span>
          <button @click="addItem" class="btn btn-primary btn-xs">＋</button>
        </div>
        <table v-if="items.length" class="table table-xs">
          <thead>
            <tr>
              <th class="w-8" />
              <th>选项值</th>
              <th>显示名</th>
              <th>排序</th>
              <th>启用</th>
              <th />
            </tr>
          </thead>
          <tbody v-draggable="[items, dragOpts]">
            <tr v-for="(item, i) in items" :key="i">
              <td>
                <span
                  class="drag-handle flex hover:text-base-content items-center justify-center px-0.5 select-none text-base-content/30 text-xs"
                >☰</span>
              </td>
              <td>
                <input v-model="item.选项值" class="input input-bordered input-xs w-20">
              </td>
              <td>
                <input v-model="item.显示名" class="input input-bordered input-xs w-24">
              </td>
              <td>
                <input v-model="item.排序" class="input input-bordered input-xs w-12">
              </td>
              <td>
                <select v-model="item.启用" class="select select-bordered select-xs w-16">
                  <option>是</option>
                  <option>否</option>
                </select>
              </td>
              <td>
                <button @click="delItem(i)" class="btn btn-ghost btn-xs text-error">🗑️</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="modal-action">
        <button v-if="groupIdx >= 0" @click="deleteGroup" class="btn btn-error btn-outline btn-sm">
          删除
        </button>
        <button @click="emit('close')" class="btn btn-ghost btn-sm">取消</button>
        <button @click="save" class="btn btn-primary btn-sm">保存</button>
      </div>
    </div>
    <form @click="emit('close')" class="modal-backdrop" method="dialog">
      <button>关闭</button>
    </form>
  </dialog>
</template>
