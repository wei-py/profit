<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  buildOptionIndex,
  formatCascadePath,
  parseCascadePath,
} from "@/utils/optionCascade";

const props = defineProps({
  allowClear: { default: true, type: Boolean },
  disabled: { default: false, type: Boolean },
  fullWidth: { default: true, type: Boolean },
  modelValue: { default: "", type: String },
  optionConfigs: { type: Array, default: () => [] },
  options: { type: Array, default: () => [] },
  placeholder: { default: "请选择", type: String },
  rootGroupId: { default: "", type: String },
  size: { default: "sm", type: String },
  wrapDisplay: { default: true, type: Boolean },
});

const emit = defineEmits(["update:modelValue"]);

const detailsRef = ref(null);
const controlRef = ref(null);
const triggerWidth = ref(0);
const dropdownAlignEnd = ref(false);
const viewportWidth = ref(typeof window === "undefined" ? 1200 : window.innerWidth);
const expandedKeys = ref(new Set());
const keyword = ref("");
const searchTimer = ref(null);

const hasGenericOptions = computed(() => props.options.length > 0);

// -- index for tree config mode --
const index = computed(() => buildOptionIndex(props.optionConfigs));
const rootId = computed(() => String(props.rootGroupId || "").trim());
const selectedPathValues = computed(() => parseCascadePath(props.modelValue));

// -- generic options helpers --

function normalizeGenericOptions(opts, parentValues = [], parentLabels = []) {
  return (opts || []).map((raw, index) => {
    const isObject = raw && typeof raw === "object";
    const value = String(isObject ? (raw.value ?? raw.label ?? "") : (raw ?? ""));
    const label = String(isObject ? (raw.label ?? raw.value ?? "") : (raw ?? ""));
    const childrenRaw = isObject ? raw.children || [] : [];
    const pathValues = [...parentValues, value];
    const pathLabels = [...parentLabels, label];
    const key = pathValues.join("\u001F") || `opt_${index}`;
    const children = normalizeGenericOptions(childrenRaw, pathValues, pathLabels);
    return {
      children,
      hasChildren: children.length > 0,
      key,
      label,
      level: parentValues.length,
      nodeId: value,
      pathLabels,
      pathValues,
      value,
    };
  });
}

function flattenGenericOptions(nodes, expanded = new Set(), level = 0) {
  const rows = [];
  for (const node of nodes) {
    rows.push({ ...node, expanded: expanded.has(node.key), level });
    if (node.children?.length && expanded.has(node.key))
      rows.push(...flattenGenericOptions(node.children, expanded, level + 1));
  }
  return rows;
}

function filterGenericNodes(nodes, kw) {
  const result = [];
  for (const node of nodes) {
    const children = filterGenericNodes(node.children || [], kw);
    const text = [...(node.pathLabels || []), ...(node.pathValues || [])].join(" ").toLowerCase();
    if (text.includes(kw) || children.length)
      result.push({ ...node, children, hasChildren: children.length > 0 || node.hasChildren });
  }
  return result;
}

function findGenericNodeByValue(nodes, value) {
  for (const node of nodes) {
    if (node.value === value)
      return node;
    const found = findGenericNodeByValue(node.children || [], value);
    if (found)
      return found;
  }
  return null;
}

const genericRootNodes = computed(() => normalizeGenericOptions(props.options));

// -- tree config helpers --

function rowToFlatNode(row, pathLabels, pathValues, level) {
  const nodeId = (row.选项值编号 || "").trim();
  const val = (row.选项值 || "").trim();
  const label = row.显示名 || val;
  const nextPathValues = [...pathValues, val];
  const nextPathLabels = [...pathLabels, label];
  return {
    hasChildren: index.value.childrenByParent.has(nodeId),
    key: nodeId,
    label,
    level,
    nodeId,
    pathLabels: nextPathLabels,
    pathValues: nextPathValues,
    value: val,
  };
}

function rowToSearchNode(row) {
  const chain = [];
  const seen = new Set();
  let current = row;

  while (current) {
    const nodeId = (current.选项值编号 || "").trim();
    if (!nodeId || seen.has(nodeId))
      break;
    seen.add(nodeId);
    chain.unshift(current);

    const parentId = (current.父级选项值编号 || "").trim();
    if (!parentId || parentId === rootId.value)
      break;
    current = index.value.rowById.get(parentId);
  }

  const pathValues = chain.map(r => (r.选项值 || "").trim()).filter(Boolean);
  const pathLabels = chain.map(r => r.显示名 || r.选项值).filter(Boolean);
  const nodeId = (row.选项值编号 || "").trim();
  const val = (row.选项值 || "").trim();
  const label = row.显示名 || val;

  return {
    hasChildren: index.value.childrenByParent.has(nodeId),
    key: nodeId || pathValues.join("\u001F"),
    label,
    level: Math.max(pathValues.length - 1, 0),
    nodeId,
    pathLabels,
    pathValues,
    value: val,
  };
}

// -- visible nodes --

const visibleNodes = computed(() => {
  const kw = keyword.value.trim().toLowerCase();

  // Generic options mode
  if (hasGenericOptions.value) {
    if (kw)
      return flattenGenericOptions(filterGenericNodes(genericRootNodes.value, kw), new Set(), 0);
    return flattenGenericOptions(genericRootNodes.value, expandedKeys.value, 0);
  }

  // Tree config mode
  const rId = rootId.value;
  if (!rId)
    return [];

  const { childrenByParent } = index.value;

  // Search mode
  if (kw) {
    const result = [];
    const max = 200;
    for (const row of props.optionConfigs) {
      if (result.length >= max)
        break;
      const val = (row.选项值 || "").trim();
      const nid = (row.选项值编号 || "").trim();
      if (!val)
        continue;
      if (!`${val} ${nid}`.toLowerCase().includes(kw))
        continue;
      result.push(rowToSearchNode(row));
    }
    return result;
  }

  // DFS: only traverse expanded path
  const result = [];
  const expanded = expandedKeys.value;
  const visited = new Set();

  function walk(parentId, pathLabels = [], pathValues = [], level = 0) {
    const children = childrenByParent.get(parentId) || [];
    for (const row of children) {
      const node = rowToFlatNode(row, pathLabels, pathValues, level);
      if (!node.nodeId || visited.has(node.nodeId))
        continue;
      visited.add(node.nodeId);
      result.push(node);
      if (expanded.has(node.nodeId) && node.hasChildren)
        walk(node.nodeId, node.pathLabels, node.pathValues, level + 1);
    }
  }

  walk(rId);
  return result;
});

// -- display text --

const selectedLabel = computed(() => {
  // Generic options
  if (hasGenericOptions.value) {
    const node = findGenericNodeByValue(genericRootNodes.value, props.modelValue);
    if (node)
      return node.pathLabels.join(" / ");
    return "";
  }

  // Tree config
  const vals = selectedPathValues.value;
  if (!vals.length)
    return "";

  const labels = [];
  let curPid = rootId.value;
  for (const sv of vals) {
    const children = index.value.childrenByParent.get(curPid) || [];
    const found = children.find(r => (r.选项值 || "").trim() === sv);
    if (found) {
      labels.push(found.显示名 || found.选项值);
      curPid = (found.选项值编号 || "").trim();
    }
    else {
      labels.push(sv);
      break;
    }
  }
  return labels.join(" / ");
});

const displayText = computed(() => {
  if (selectedLabel.value)
    return selectedLabel.value;
  return props.modelValue || props.placeholder;
});

const hasNested = computed(() => {
  if (hasGenericOptions.value)
    return genericRootNodes.value.some(n => n.hasChildren);
  const rId = rootId.value;
  return rId ? (index.value.childrenByParent.get(rId)?.length || 0) > 0 : false;
});

// -- dropdown sizing --

const dropdownStyle = computed(() => {
  const maxWidth = Math.max(180, viewportWidth.value - 32);
  return {
    maxWidth: "calc(100vw - 2rem)",
    minWidth: `${Math.min(Math.max(triggerWidth.value || 0, 120), maxWidth)}px`,
    width: `${Math.min(320, maxWidth)}px`,
  };
});

const sizeClass = computed(() =>
  props.size === "xs" ? "min-h-[33px] text-xs px-2 py-0" : "min-h-[33px] text-sm px-2 py-0",
);

const controlClass = computed(() => [
  "option-tree-control border border-base-300 bg-base-100 flex items-center justify-between gap-2 text-left",
  "hover:border-base-content/30",
  props.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
  props.fullWidth ? "w-full" : "",
  sizeClass.value,
]);

// -- expand ancestors for tree config mode --

function syncExpandedWithValue() {
  if (hasGenericOptions.value)
    return;

  const vals = selectedPathValues.value;
  if (!vals.length)
    return;

  const { childrenByParent } = index.value;
  const toExpand = new Set(expandedKeys.value);
  let curPid = rootId.value;

  for (const sv of vals) {
    const children = childrenByParent.get(curPid) || [];
    const found = children.find(r => (r.选项值 || "").trim() === sv);
    if (!found)
      break;
    const nid = (found.选项值编号 || "").trim();
    toExpand.add(nid);
    curPid = nid;
  }
  expandedKeys.value = toExpand;
}

watch([() => props.modelValue, () => props.rootGroupId], syncExpandedWithValue, { immediate: true });

// -- interaction --

function closeDropdown() {
  nextTick(() => {
    if (detailsRef.value)
      detailsRef.value.open = false;
  });
}

function updateTriggerWidth() {
  const rect = controlRef.value?.getBoundingClientRect();
  triggerWidth.value = Math.ceil(rect?.width || 0);
  viewportWidth.value = window.innerWidth || viewportWidth.value;
  dropdownAlignEnd.value
    = !!rect && rect.left + 320 > viewportWidth.value - 8 && rect.right - 320 > 8;
}

function onToggle() {
  if (detailsRef.value?.open)
    nextTick(updateTriggerWidth);
  else
    keyword.value = "";
}

function handleDocumentPointerDown(event) {
  const root = detailsRef.value;
  if (!root || !root.open)
    return;
  if (root.contains(event.target))
    return;
  root.open = false;
}

onMounted(() => {
  updateTriggerWidth();
  window.addEventListener("resize", updateTriggerWidth);
  document.addEventListener("pointerdown", handleDocumentPointerDown, true);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", updateTriggerWidth);
  document.removeEventListener("pointerdown", handleDocumentPointerDown, true);
});

function toggleNode(node) {
  if (!node.hasChildren)
    return;
  const next = new Set(expandedKeys.value);
  if (next.has(node.key))
    next.delete(node.key);
  else
    next.add(node.key);
  expandedKeys.value = next;
}

function selectNode(node) {
  if (hasGenericOptions.value)
    emit("update:modelValue", node.value);
  else
    emit("update:modelValue", formatCascadePath(node.pathValues));

  closeDropdown();
}

function clearSelection() {
  emit("update:modelValue", "");
  closeDropdown();
}

function onSearchInput() {
  if (searchTimer.value)
    clearTimeout(searchTimer.value);
  searchTimer.value = setTimeout(() => {
    searchTimer.value = null;
  }, 150);
}
</script>

<template>
  <details
    @toggle="onToggle"
    ref="detailsRef"
    class="dropdown"
    :class="[fullWidth ? 'w-full' : '', dropdownAlignEnd ? 'dropdown-end' : '']"
  >
    <summary class="list-none">
      <div ref="controlRef" :class="controlClass">
        <span
          class="min-w-0 flex-1 leading-snug"
          :class="[
            modelValue ? '' : 'opacity-50',
            wrapDisplay ? 'whitespace-normal break-words' : 'truncate',
          ]"
        >
          {{ displayText }}
        </span>
        <span class="shrink-0 opacity-50">▾</span>
      </div>
    </summary>

    <div
      class="dropdown-content z-[70] mt-1 max-h-80 overflow-auto border border-base-300 bg-base-100 p-1 shadow-xl"
      :style="dropdownStyle"
    >
      <div v-if="hasNested" class="border-b border-base-300 p-1">
        <input
          v-model.trim="keyword"
          @click.stop
          @input="onSearchInput"
          @keydown.stop
          class="input input-bordered input-xs h-[33px] min-h-[33px] w-full"
          placeholder="搜索"
        >
      </div>

      <div v-if="allowClear && modelValue" class="border-b border-base-300 p-1 text-right">
        <button
          @click.stop="clearSelection"
          class="btn btn-ghost btn-xs h-[33px] min-h-[33px] px-2 text-[11px]"
          type="button"
        >
          清空
        </button>
      </div>

      <div v-if="visibleNodes.length" class="py-1">
        <div
          @click.stop="selectNode(node)"
          v-for="node in visibleNodes"
          :key="node.key"
          class="flex h-[33px] min-w-max cursor-pointer items-center whitespace-nowrap text-sm hover:bg-base-200"
          :class="
            (hasGenericOptions
              ? modelValue === node.value
              : modelValue === formatCascadePath(node.pathValues))
              ? 'bg-primary/10 font-semibold text-primary'
              : ''
          "
          :style="{ paddingLeft: `${node.level * 16 + 4}px` }"
        >
          <button
            @click.stop="toggleNode(node)"
            class="btn btn-ghost btn-xs h-[33px] min-h-[33px] w-[33px] px-0"
            :disabled="!node.hasChildren"
            type="button"
          >
            <span v-if="node.hasChildren">{{ expandedKeys.has(node.key) ? "▾" : "▸" }}</span>
          </button>
          <span class="pr-3 leading-[33px]">
            {{ node.label }}
          </span>
        </div>
      </div>

      <div v-else class="py-3 text-center text-xs opacity-50">暂无可选项</div>
    </div>
  </details>
</template>
