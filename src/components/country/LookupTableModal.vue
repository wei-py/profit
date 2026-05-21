<script setup>
import { driver } from "driver.js";
import { computed, ref, shallowRef, watch } from "vue";
import PaginationBar from "@/components/common/PaginationBar.vue";
import { useModalEsc } from "@/composables/useModalEsc";
import { useConfigStore } from "@/stores/config";
import { FONT_TABLE_XS, LINE_HEIGHT_TABLE_XS, measureTextHeight } from "@/utils/textMeasure";

import "driver.js/dist/driver.css";

const props = defineProps({
  open: Boolean,
  tableName: String,
});
const emit = defineEmits(["close"]);
useModalEsc(
  () => props.open,
  () => emit("close"),
);

const store = useConfigStore();
const newName = ref("");
const rowsLocal = shallowRef([]);
let rowUid = 0;
const currentPage = ref(1);
const pageSize = ref(100);

const columns = computed(() =>
  Object.keys(rowsLocal.value[0] || {}).filter(k => k !== "_uid"),
);

const totalPages = computed(() =>
  Math.max(1, Math.ceil(rowsLocal.value.length / pageSize.value)),
);

const pagedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return rowsLocal.value.slice(start, start + pageSize.value);
});

const lookupEditSteps = [
  {
    element: "[data-tour=\"lookup-modal\"]",
    popover: {
      description: "编辑费率表数据。表名可修改，并会同步更新所有规则中的引用。",
      title: "查表编辑",
    },
  },
  {
    element: "[data-tour=\"lookup-actions\"]",
    popover: {
      description: "这里可以新增行和列。新增列需要先填写列名再点击＋列。",
      title: "行列操作",
    },
  },
  {
    element: "[data-tour=\"lookup-table\"]",
    popover: {
      description: "表格内容可直接编辑。拖动左侧三条杠调整行顺序，列头的✕可删除整列。",
      title: "查表数据",
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

const COLUMN_WIDTHS = {
  catName: 140,
  chCatName: 120,
  chPath: 180,
  parentName: 140,
  path: 180,
};

function getColumnWidth(col) {
  return COLUMN_WIDTHS[col] || 92;
}

const rowHeights = computed(() => {
  return pagedRows.value.map((row) => {
    let maxH = LINE_HEIGHT_TABLE_XS;

    for (const col of columns.value) {
      const text = String(row[col] ?? "");
      const width = getColumnWidth(col) - 8;
      const h = measureTextHeight(text, width, LINE_HEIGHT_TABLE_XS, FONT_TABLE_XS);
      if (h > maxH)
        maxH = h;
    }

    return Math.max(28, maxH + 10);
  });
});

watch(
  () => props.open,
  (v) => {
    if (!v)
      return;
    newName.value = props.tableName;
    rowUid = 0;
    currentPage.value = 1;
    rowsLocal.value = JSON.parse(JSON.stringify(store.lookupTables[props.tableName] || [])).map(
      row => ({ ...row, _uid: ++rowUid }),
    );
  },
);

watch([totalPages, pageSize], () => {
  if (currentPage.value > totalPages.value)
    currentPage.value = totalPages.value;
});

function addRow() {
  if (!rowsLocal.value.length) {
    rowsLocal.value = [{ _uid: ++rowUid }];
    return;
  }
  const row = { _uid: ++rowUid };
  for (const k of columns.value) row[k] = "";
  rowsLocal.value = [...rowsLocal.value, row];
}
function delRow(i) {
  const arr = [...rowsLocal.value];
  arr.splice(i, 1);
  rowsLocal.value = arr;
}

const newCol = ref("");
function addCol() {
  const col = newCol.value.trim();
  if (!col)
    return;
  for (const row of rowsLocal.value) {
    if (col !== "_uid" && !(col in row))
      row[col] = "";
  }
  rowsLocal.value = [...rowsLocal.value];
  newCol.value = "";
}
function delCol(col) {
  for (const row of rowsLocal.value) delete row[col];
  rowsLocal.value = [...rowsLocal.value];
}

function cleanRows() {
  return rowsLocal.value.map(({ _uid, ...row }) => row);
}

function save() {
  const oldName = props.tableName;
  const nn = newName.value.trim();
  if (!nn)
    return;
  if (oldName !== nn) {
    store.lookupTables = {
      ...store.lookupTables,
      [nn]: cleanRows(),
    };
    delete store.lookupTables[oldName];
    store.renameLookupConfig(oldName, nn);
    for (const r of store["费用规则"]) {
      if (r.查表名称 === oldName)
        r.查表名称 = nn;
    }
  }
  else {
    store.lookupTables = {
      ...store.lookupTables,
      [nn]: cleanRows(),
    };
    store.upsertLookupConfig(nn);
  }
  store.markDirty();
  emit("close");
}
</script>

<template>
  <dialog @cancel.prevent class="modal" :open="open">
    <div
      class="modal-box max-h-[85vh] w-[min(52rem,calc(100vw-1rem))] max-w-none overflow-y-auto"
      data-tour="lookup-modal"
    >
      <div class="flex gap-2 items-center mb-4">
        <h3 class="font-bold text-lg">查表：</h3>
        <input v-model="newName" class="font-mono input input-bordered input-sm w-48">
        <button @click="startTour(lookupEditSteps)" class="btn btn-circle btn-ghost btn-sm ml-auto">
          ?
        </button>
      </div>
      <div class="flex gap-2 mb-3" data-tour="lookup-actions">
        <button @click="addRow" class="btn btn-ghost btn-xs">＋ 行</button>
        <button @click="addCol" class="btn btn-ghost btn-xs">＋ 列</button>
        <input
          v-model="newCol"
          @keyup.enter="addCol"
          class="input input-bordered input-xs w-24"
          placeholder="列名"
        >
      </div>
      <div v-if="rowsLocal.length" data-tour="lookup-table">
        <div class="overflow-x-auto">
          <table class="table table-xs">
            <thead>
              <tr>
                <th
                  v-for="k in columns"
                  :key="k"
                  class="group relative"
                  :style="{ minWidth: `${getColumnWidth(k)}px`, width: `${getColumnWidth(k)}px` }"
                >
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
            <tbody>
              <tr v-for="(row, i) in pagedRows" :key="row._uid">
                <td
                  v-for="k in columns"
                  :key="k"
                  class="p-0 align-top"
                  :style="{ minWidth: `${getColumnWidth(k)}px`, width: `${getColumnWidth(k)}px` }"
                >
                  <textarea
                    @input="row[k] = $event.target.value"
                    class="textarea textarea-xs w-full resize-none rounded-none border-0 px-1 py-1 leading-5"
                    rows="1"
                    :style="{ height: `${rowHeights[i]}px` }"
                    :value="row[k]"
                  />
                </td>
                <td>
                  <button @click="delRow((currentPage - 1) * pageSize + i)" class="btn btn-ghost btn-xs text-error">🗑️</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <PaginationBar
          v-model:currentPage="currentPage"
          v-model:pageSize="pageSize"
          class="justify-end mt-2"
          showJump
          showTotal
          :total="rowsLocal.length"
          :totalPages="totalPages"
        />
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
