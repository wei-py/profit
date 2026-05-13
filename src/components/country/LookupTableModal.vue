<script setup>
import { driver } from "driver.js";
import { ref, watch } from "vue";
import { vDraggable } from "vue-draggable-plus";
import { useConfigStore } from "@/stores/config";
import "driver.js/dist/driver.css";

const props = defineProps({
  open: Boolean,
  tableName: String,
});
const emit = defineEmits(["close"]);

const store = useConfigStore();
const newName = ref("");
const rowsLocal = ref([]);

const dragOpts = {
  animation: 150,
  chosenClass: "drag-chosen",
  dragClass: "drag-drag",
  fallbackOnBody: true,
  forceFallback: true,
  ghostClass: "drag-ghost",
  handle: ".drag-handle",
};

const lookupEditSteps = [
  {
    popover: {
      description:
        "编辑费率表数据。表名可修改（同步更新所有规则中的引用）。＋行列增删行列。列头✕可删除整列。",
      title: "查表编辑",
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
    newName.value = props.tableName;
    rowsLocal.value = JSON.parse(JSON.stringify(store.lookupTables[props.tableName] || []));
  },
);

function addRow() {
  if (!rowsLocal.value.length) {
    rowsLocal.value.push({});
    return;
  }
  const row = {};
  for (const k of Object.keys(rowsLocal.value[0])) row[k] = "";
  rowsLocal.value.push(row);
}
function delRow(i) {
  rowsLocal.value.splice(i, 1);
}

const newCol = ref("");
function addCol() {
  const col = newCol.value.trim();
  if (!col)
    return;
  for (const row of rowsLocal.value) {
    if (!(col in row))
      row[col] = "";
  }
  rowsLocal.value = [...rowsLocal.value];
  newCol.value = "";
}
function delCol(col) {
  for (const row of rowsLocal.value) delete row[col];
  rowsLocal.value = [...rowsLocal.value];
}

function save() {
  const oldName = props.tableName;
  const nn = newName.value.trim();
  if (!nn)
    return;
  if (oldName !== nn) {
    store.lookupTables = {
      ...store.lookupTables,
      [nn]: rowsLocal.value,
    };
    delete store.lookupTables[oldName];
    for (const r of store["费用规则"]) {
      if (r.查表名称 === oldName)
        r.查表名称 = nn;
    }
  }
  else {
    store.lookupTables = {
      ...store.lookupTables,
      [nn]: rowsLocal.value,
    };
  }
  emit("close");
}
</script>

<template>
  <dialog class="modal" :open="open">
    <div class="max-h-[85vh] max-w-4xl modal-box overflow-y-auto w-11/12">
      <div class="flex gap-2 items-center mb-4">
        <h3 class="font-bold text-lg">查表：</h3>
        <input v-model="newName" class="font-mono input input-bordered input-sm w-48">
        <button @click="startTour(lookupEditSteps)" class="btn btn-circle btn-ghost btn-sm ml-auto">
          ?
        </button>
      </div>
      <div class="flex gap-2 mb-3">
        <button @click="addRow" class="btn btn-ghost btn-xs">＋ 行</button>
        <button @click="addCol" class="btn btn-ghost btn-xs">＋ 列</button>
        <input
          v-model="newCol"
          @keyup.enter="addCol"
          class="input input-bordered input-xs w-24"
          placeholder="列名"
        >
      </div>
      <div v-if="rowsLocal.length" class="overflow-x-auto">
        <table class="table table-xs">
          <thead>
            <tr>
              <th class="w-8" />
              <th v-for="k in Object.keys(rowsLocal[0] || {})" :key="k" class="group relative">
                {{ k }}
                <button
                  @click="delCol(k)"
                  class="-right-1 -top-1 absolute btn btn-ghost btn-xs group-hover:opacity-100 opacity-0 text-error"
                >
                  ✕
                </button>
              </th>
              <th class="w-12" />
            </tr>
          </thead>
          <tbody v-draggable="[rowsLocal, dragOpts]">
            <tr v-for="(row, i) in rowsLocal" :key="i">
              <td>
                <span
                  class="drag-handle flex hover:text-base-content items-center justify-center select-none text-base-content/30 text-xs"
                >☰</span>
              </td>
              <td v-for="k in Object.keys(rowsLocal[0] || {})" :key="k">
                <input v-model="row[k]" class="input input-bordered input-xs w-full">
              </td>
              <td>
                <button @click="delRow(i)" class="btn btn-ghost btn-xs text-error">🗑️</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="mb-4 text-base-content/40 text-xs">空表，点击「＋ 行」或「＋ 列」开始</div>
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
