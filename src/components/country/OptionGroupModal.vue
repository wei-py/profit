<script setup>
import { driver } from "driver.js";
import { computed, ref, watch } from "vue";
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
const draftRows = ref([]);
const expandedIds = ref(new Set());

const rootGroupIds = computed(() => {
  const ids = new Set();
  for (const row of draftRows.value) {
    const gid = normalizeId(row.选项组编号);
    if (gid && !row.父级)
      ids.add(gid);
  }
  return [...ids];
});

const rootGroupRows = computed(() => {
  const ids = rootGroupIds.value;
  return draftRows.value.filter(r => ids.includes(normalizeId(r.选项组编号)) && !r.父级);
});

function visibleRows(parentId = null, exclude = new Set()) {
  const rows = [];
  const target = parentId ? normalizeId(parentId) : null;
  for (const row of draftRows.value) {
    const pid = normalizeId(row.父级) || null;
    if (pid === target && !exclude.has(normalizeId(row.编号))) {
      rows.push(row);
    }
  }
  return rows.sort((a, b) => {
    const oa = Number(a?.排序);
    const ob = Number(b?.排序);
    if (Number.isFinite(oa) && Number.isFinite(ob))
      return oa - ob;
    if (Number.isFinite(oa))
      return -1;
    if (Number.isFinite(ob))
      return 1;
    return String(a?.显示名 || a?.选项值 || "").localeCompare(String(b?.显示名 || b?.选项值 || ""), "zh-Hans-CN");
  });
}

function childrenOf(parentId) {
  return visibleRows(parentId);
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

function countryPrefix() {
  const raw = String(props.cpId || "opt").trim();
  const fromCp = raw.replace(/^cp[_-]?/i, "");
  return fromCp || raw || "opt";
}

function safeIdPart(value) {
  return String(value || "")
    .trim()
    .replace(/[/\\\s]+/g, "_")
    .replace(/[|,，;；]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function usedIds() {
  return new Set(draftRows.value.map(r => normalizeId(r.编号)));
}

function uniqueId(base) {
  const cleaned = safeIdPart(base || `${countryPrefix()}_opt`);
  const used = usedIds();
  if (!used.has(cleaned))
    return cleaned;
  let i = 2;
  while (used.has(`${cleaned}_${i}`)) i += 1;
  return `${cleaned}_${i}`;
}

function loadDraft() {
  const rows = store["选项配置"]
    .filter(r => normalizeId(r.所属国家平台) === normalizeId(props.cpId))
    .map(r => JSON.parse(JSON.stringify(r)));
  draftRows.value = rows;
}

function addRootGroup() {
  const gid = uniqueId(`${countryPrefix()}_opt_group`);
  draftRows.value.push({
    启用: "是",
    备注: "",
    所属国家平台: normalizeId(props.cpId || ""),
    排序: rootGroupIds.value.length + 1,
    显示名: "新选项来源",
    父级: "",
    编号: gid,
    选项值: "新选项1",
    选项组名称: "新选项来源",
    选项组编号: gid,
  });
}

function addChildRow(parentRow) {
  const pid = normalizeId(parentRow.编号);
  const gid = normalizeId(parentRow.选项组编号);
  const existing = childrenOf(pid);
  draftRows.value.push({
    启用: "是",
    备注: "",
    所属国家平台: normalizeId(props.cpId || ""),
    排序: existing.length + 1,
    显示名: `新选项${existing.length + 1}`,
    父级: pid,
    编号: uniqueId(`${pid}_child`),
    选项值: `新选项${existing.length + 1}`,
    选项组名称: parentRow.选项组名称,
    选项组编号: gid,
  });
  expandedIds.value = new Set([...expandedIds.value, pid]);
}

function deleteRow(row) {
  const ids = collectSubtreeIds(row.编号);
  ids.add(normalizeId(row.编号));
  draftRows.value = draftRows.value.filter(r => !ids.has(normalizeId(r.编号)));
}

function collectSubtreeIds(rootId) {
  const ids = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const r of draftRows.value) {
      const pid = normalizeId(r.父级);
      if (pid && (ids.has(pid) || pid === rootId || normalizeId(r.编号) === rootId) && !ids.has(normalizeId(r.编号))) {
        ids.add(normalizeId(r.编号));
        changed = true;
      }
    }
  }
  return ids;
}

function toggleExpand(nodeId) {
  const next = new Set(expandedIds.value);
  if (next.has(normalizeId(nodeId)))
    next.delete(normalizeId(nodeId));
  else
    next.add(normalizeId(nodeId));
  expandedIds.value = next;
}

function hasChildren(nodeId) {
  return childrenOf(nodeId).length > 0;
}

function saveDraft() {
  const oldCountryGroupIds = new Set(
    store.getAllOptionGroupIdsByCountry(props.cpId).map(g => g.编号),
  );
  const keep = store["选项配置"].filter(r => !oldCountryGroupIds.has(normalizeId(r.选项组编号)));

  const cleanRows = draftRows.value.map((row, index) => ({
    ...row,
    启用: row.启用 || "是",
    备注: row.备注 || "",
    所属国家平台: normalizeId(row.所属国家平台 || props.cpId || ""),
    排序: row.排序 || index + 1,
    显示名: row.显示名 || row.选项值,
    父级: normalizeId(row.父级),
    编号: normalizeId(row.编号),
    选项值: normalizeId(row.选项值),
    选项组名称: row.选项组名称 || "",
    选项组编号: normalizeId(row.选项组编号),
  }));

  store["选项配置"] = [...keep, ...cleanRows];
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
  d.setSteps([
    {
      element: "[data-tour='option-tree-list']",
      popover: {
        description: "选项树管理。拖动排序，支持多层嵌套。",
        title: "选项树",
      },
    },
  ]);
  d.drive();
}

const flatVisibleRows = computed(() => {
  const result = [];
  const visited = new Set();

  function appendChildren(parentId, level) {
    const children = visibleRows(parentId, visited);
    for (const child of children) {
      const cid = normalizeId(child.编号);
      if (visited.has(cid))
        continue;
      visited.add(cid);
      result.push({ ...child, _level: level });
      if (expandedIds.value.has(cid)) {
        appendChildren(cid, level + 1);
      }
    }
  }

  for (const root of rootGroupRows.value) {
    const rid = normalizeId(root.编号);
    if (visited.has(rid))
      continue;
    visited.add(rid);
    result.push({ ...root, _level: 0 });
    if (expandedIds.value.has(rid) || !root.选项值) {
      appendChildren(rid, 1);
    }
  }

  return result;
});
</script>

<template>
  <dialog @cancel.prevent class="modal" :open="open">
    <div class="modal-box flex max-h-[88vh] w-[min(40rem,calc(100vw-1rem))] max-w-none flex-col overflow-hidden">
      <div class="mb-3 flex shrink-0 items-center justify-between gap-3">
        <div class="min-w-0">
          <h3 class="text-lg font-bold">选项树管理</h3>
          <p class="mt-1 text-xs opacity-60">
            {{ rootGroupIds.length }} 个来源 / {{ draftRows.length }} 个节点
          </p>
        </div>
        <button @click="startTour" class="btn btn-circle btn-ghost btn-sm shrink-0">?</button>
      </div>

      <div class="min-h-0 flex-1 overflow-auto border border-base-300" data-tour="option-tree-list">
        <div class="sticky top-0 z-10 flex h-10 items-center justify-between border-b border-base-300 bg-base-100 px-3">
          <div class="font-semibold text-sm">选项树</div>
          <button @click="addRootGroup" class="btn btn-ghost btn-xs">＋顶级</button>
        </div>

        <div v-if="flatVisibleRows.length">
          <div
            v-for="row in flatVisibleRows"
            :key="row.编号"
            class="option-tree-row hover flex min-h-[33px] items-center gap-1 border-b border-base-300 bg-base-100 px-2 py-1 text-sm"
            :style="{ paddingLeft: `${row._level * 16 + 8}px` }"
          >
            <span class="option-drag-handle cursor-grab px-1 text-base-content/30" title="拖动排序">☰</span>
            <button
              @click="toggleExpand(row.编号)"
              class="btn btn-ghost btn-xs h-6 min-h-6 w-6 px-0 shrink-0"
              :disabled="!hasChildren(row.编号)"
            >
              {{ hasChildren(row.编号) ? (expandedIds.has(row.编号) ? "▾" : "▸") : "" }}
            </button>
            <input
              v-model="row.显示名"
              class="input input-bordered input-xs min-w-0 flex-1"
              placeholder="显示名"
            >
            <input
              v-model="row.选项值"
              class="input input-bordered input-xs w-24 shrink-0"
              placeholder="选项值"
            >
            <select v-model="row.启用" class="select select-bordered select-xs w-14 shrink-0">
              <option>是</option>
              <option>否</option>
            </select>
            <button @click="addChildRow(row)" class="btn btn-ghost btn-xs shrink-0" title="新增子级">+子级</button>
            <button @click="deleteRow(row)" class="btn btn-ghost btn-xs shrink-0 text-error">删除</button>
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
      <button>关闭</button>
    </form>
  </dialog>
</template>
