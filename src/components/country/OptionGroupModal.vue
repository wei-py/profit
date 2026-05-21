<script setup>
import { driver } from "driver.js";
import { computed, ref, shallowRef, watch } from "vue";
import { useModalEsc } from "@/composables/useModalEsc";
import { useConfigStore } from "@/stores/config";
import { normalizeId } from "@/utils/value";
import "driver.js/dist/driver.css";

const props = defineProps({
  cpId: String,
  open: Boolean,
  selectedGroupId: {
    default: "",
    type: String,
  },
});

const emit = defineEmits(["close"]);
useModalEsc(
  () => props.open,
  () => emit("close"),
);

const store = useConfigStore();
const draftRows = shallowRef([]);
const expandedIds = ref(new Set());

const childrenByParent = computed(() => {
  const map = new Map();

  for (const row of draftRows.value) {
    const parentId = (row.父级选项值编号 || "").trim();
    const list = map.get(parentId) || [];
    list.push(row);
    map.set(parentId, list);
  }

  for (const list of map.values()) {
    list.sort((a, b) => {
      const oa = Number(a?.排序);
      const ob = Number(b?.排序);
      if (Number.isFinite(oa) && Number.isFinite(ob))
        return oa - ob;
      if (Number.isFinite(oa))
        return -1;
      if (Number.isFinite(ob))
        return 1;
      return String(a?.选项值 || "").localeCompare(String(b?.选项值 || ""), "zh-Hans-CN");
    });
  }

  return map;
});

const rootNodes = computed(() => childrenByParent.value.get("") || []);

function childrenOfNodeId(parentNodeId) {
  return childrenByParent.value.get((parentNodeId || "").trim()) || [];
}

function childrenOf(row) {
  return childrenOfNodeId(row.选项值编号);
}

watch(
  () => props.open,
  (v) => {
    if (!v)
      return;
    expandedIds.value = new Set();
    loadDraft();
  },
);

function loadDraft() {
  const rows = store["选项配置"]
    .filter(r => normalizeId(r.所属国家平台) === normalizeId(props.cpId))
    .map(r => JSON.parse(JSON.stringify(r)));
  draftRows.value = rows;
}

function addRootNode() {
  const newVal = "新选项来源";
  draftRows.value = [
    ...draftRows.value,
    {
      启用: "是",
      备注: "",
      所属国家平台: normalizeId(props.cpId || ""),
      排序: rootNodes.value.length + 1,
      父级选项值: "",
      父级选项值编号: "",
      选项值: newVal,
      选项值编号: newVal,
    },
  ];
}

function addChildRow(parentRow) {
  const existing = childrenOf(parentRow);
  const newVal = `新选项${existing.length + 1}`;
  const newNodeId = `${(parentRow.选项值编号 || "").trim()} / ${newVal}`;
  draftRows.value = [
    ...draftRows.value,
    {
      启用: "是",
      备注: "",
      所属国家平台: normalizeId(props.cpId || ""),
      排序: existing.length + 1,
      父级选项值: parentRow.选项值,
      父级选项值编号: parentRow.选项值编号,
      选项值: newVal,
      选项值编号: newNodeId,
    },
  ];
  expandedIds.value = new Set([...expandedIds.value, (parentRow.选项值编号 || "").trim()]);
}

function updateDescendantIds(row, oldNodeId, newNodeId, oldPrefix, newPrefix) {
  for (const r of draftRows.value) {
    if (r === row)
      continue;
    const cur = (r.选项值编号 || "").trim();
    const curParent = (r.父级选项值编号 || "").trim();
    if (cur === oldNodeId || cur.startsWith(`${oldPrefix} / `)) {
      r.选项值编号 = cur.replace(oldPrefix, newPrefix);
    }
    if (curParent === oldNodeId || curParent.startsWith(`${oldPrefix} / `)) {
      r.父级选项值编号 = curParent.replace(oldPrefix, newPrefix);
    }
    if (curParent === oldNodeId) {
      r.父级选项值 = row.选项值;
    }
  }
}

function onValueChange(row) {
  const oldNodeId = row.选项值编号 || "";
  const newValue = (row.选项值 || "").trim();
  if (!newValue || !oldNodeId)
    return;

  const parts = oldNodeId.split(" / ").map(s => s.trim()).filter(Boolean);
  if (!parts.length) {
    row.选项值编号 = newValue;
    draftRows.value = [...draftRows.value];
    return;
  }
  parts[parts.length - 1] = newValue;
  const newNodeId = parts.join(" / ");

  if (newNodeId === oldNodeId)
    return;

  const oldPrefix = oldNodeId;
  const newPrefix = newNodeId;
  updateDescendantIds(row, oldNodeId, newNodeId, oldPrefix, newPrefix);
  row.选项值编号 = newNodeId;

  for (const r of draftRows.value) {
    if (r === row)
      continue;
    if ((r.父级选项值编号 || "").trim() === oldNodeId) {
      r.父级选项值编号 = newNodeId;
      r.父级选项值 = newValue;
    }
  }

  draftRows.value = [...draftRows.value];
}

function deleteRow(row) {
  const nodeId = (row.选项值编号 || "").trim();
  const prefix = `${nodeId} / `;
  draftRows.value = draftRows.value.filter((r) => {
    if (r === row)
      return false;
    const rnid = (r.选项值编号 || "").trim();
    if (rnid === nodeId || rnid.startsWith(prefix))
      return false;
    return true;
  });
}

function toggleExpand(row) {
  const key = (row.选项值编号 || "").trim();
  const next = new Set(expandedIds.value);
  if (next.has(key))
    next.delete(key);
  else next.add(key);
  expandedIds.value = next;
}

function saveDraft() {
  const oldRootIds = new Set(
    store.getAllOptionGroupsByCountry(props.cpId).map(g => g.名称),
  );
  const keep = store["选项配置"].filter(r => !oldRootIds.has((r.选项值编号 || "").trim()));

  const cleanRows = draftRows.value.map((row, index) => ({
    启用: row.启用 || "是",
    备注: row.备注 || "",
    所属国家平台: normalizeId(row.所属国家平台 || props.cpId || ""),
    排序: row.排序 || index + 1,
    父级选项值: (row.父级选项值 || "").trim(),
    父级选项值编号: (row.父级选项值编号 || "").trim(),
    选项值: (row.选项值 || "").trim(),
    选项值编号: (row.选项值编号 || "").trim(),
  }));

  store["选项配置"] = [...keep, ...cleanRows];
  store.markDirty();
  emit("close");
}

function startTour() {
  const d = driver({
    animate: true,
    closeBtnText: "✕",
    doneBtnText: "知道了",
    nextBtnText: "下一步",
    prevBtnText: "上一步",
    showProgress: true,
  });
  d.setSteps([{
    element: "[data-tour='option-tree-list']",
    popover: {
      description: "选项树管理。拖动排序，支持多层嵌套。",
      title: "选项树",
    },
  }]);
  d.drive();
}

const flatVisibleRows = computed(() => {
  const result = [];
  const visited = new Set();

  function appendRow(row, level) {
    const nodeId = (row.选项值编号 || "").trim();
    if (!nodeId || visited.has(nodeId))
      return;

    visited.add(nodeId);
    const children = childrenOfNodeId(nodeId);

    result.push({
      hasChildren: children.length > 0,
      level,
      row,
    });

    if (expandedIds.value.has(nodeId)) {
      for (const child of children)
        appendRow(child, level + 1);
    }
  }

  for (const root of rootNodes.value)
    appendRow(root, 0);

  return result;
});
</script>

<template>
  <dialog @cancel.prevent class="modal" :open="open">
    <div class="modal-box flex max-h-[88vh] w-[min(44rem,calc(100vw-1rem))] max-w-none flex-col overflow-hidden">
      <div class="mb-3 flex shrink-0 items-center justify-between gap-3">
        <div class="min-w-0">
          <h3 class="text-lg font-bold">选项树管理</h3>
          <p class="mt-1 text-xs opacity-60">
            {{ rootNodes.length }} 个顶级 / {{ draftRows.length }} 个节点
          </p>
        </div>
        <button @click="startTour" class="btn btn-circle btn-ghost btn-sm shrink-0">?</button>
      </div>

      <div class="min-h-0 flex-1 overflow-auto border border-base-300" data-tour="option-tree-list">
        <div class="sticky top-0 z-10 flex h-10 items-center justify-between border-b border-base-300 bg-base-100 px-3">
          <div class="font-semibold text-sm">选项树</div>
          <button @click="addRootNode" class="btn btn-ghost btn-xs">＋顶级</button>
        </div>

        <div v-if="flatVisibleRows.length">
          <div
            v-for="item in flatVisibleRows"
            :key="item.row.选项值编号"
            class="option-tree-row hover flex min-h-[33px] items-center gap-1 border-b border-base-300 bg-base-100 px-2 py-1 text-sm"
            :style="{ paddingLeft: `${item.level * 16 + 8}px` }"
          >
            <span class="option-drag-handle cursor-grab px-1 text-base-content/30" title="拖动排序">☰</span>
            <button
              @click="toggleExpand(item.row)"
              class="btn btn-ghost btn-xs h-6 min-h-6 w-6 px-0 shrink-0"
              :disabled="!item.hasChildren"
            >
              {{ item.hasChildren ? (expandedIds.has(item.row.选项值编号) ? "▾" : "▸") : "" }}
            </button>
            <input
              v-model="item.row.选项值"
              @change="onValueChange(item.row)"
              class="input input-bordered input-xs min-w-0 flex-1"
              placeholder="选项值"
            >
            <select v-model="item.row.启用" class="select select-bordered select-xs w-14 shrink-0">
              <option>是</option>
              <option>否</option>
            </select>
            <button @click="addChildRow(item.row)" class="btn btn-ghost btn-xs shrink-0" title="新增子级">+子级</button>
            <button @click="deleteRow(item.row)" class="btn btn-ghost btn-xs shrink-0 text-error">删除</button>
          </div>
        </div>
        <div v-else class="bg-base-200 p-4 text-center text-sm opacity-70">
          暂无选项，点击“＋顶级”开始。
        </div>
      </div>

      <div class="modal-action shrink-0">
        <button @click="emit('close')" class="btn btn-ghost btn-sm">关闭</button>
        <button @click="saveDraft" class="btn btn-primary btn-sm">保存</button>
      </div>
    </div>

    <form @click="emit('close')" class="modal-backdrop" method="dialog">
      <button>close</button>
    </form>
  </dialog>
</template>

<style scoped>
.option-tree-row {
  transition: background-color 0.15s;
}
</style>
