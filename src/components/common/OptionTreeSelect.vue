<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  buildOptionValueTree,
  findOptionTreeNodeByPath,
  flattenOptionValueTree,
  formatCascadePath,
  getOptionTreeAncestorKeys,
  parseCascadePath,
} from "@/utils/optionCascade";

const props = defineProps({
  allowClear: {
    default: true,
    type: Boolean,
  },
  disabled: {
    default: false,
    type: Boolean,
  },
  fullWidth: {
    default: true,
    type: Boolean,
  },
  modelValue: {
    default: "",
    type: String,
  },
  optionConfigs: {
    type: Array,
    default: () => [],
  },
  /** 单层/通用选项：['是','否'] 或 [{ label, value, children }] */
  options: {
    type: Array,
    default: () => [],
  },
  placeholder: {
    default: "请选择",
    type: String,
  },
  rootGroupId: {
    default: "",
    type: String,
  },
  size: {
    default: "sm",
    type: String,
  },
  wrapDisplay: {
    default: true,
    type: Boolean,
  },
});

const emit = defineEmits(["update:modelValue"]);

const detailsRef = ref(null);
const controlRef = ref(null);
const triggerWidth = ref(0);
const dropdownAlignEnd = ref(false);
const viewportWidth = ref(typeof window === "undefined" ? 1200 : window.innerWidth);
const expandedKeys = ref(new Set());
const keyword = ref("");

function normalizeGenericOptions(options, parentValues = [], parentLabels = [], parentKey = "opt") {
  return (options || []).map((raw, index) => {
    const isObject = raw && typeof raw === "object";
    const value = String(isObject ? (raw.value ?? raw.label ?? "") : (raw ?? ""));
    const label = String(isObject ? (raw.label ?? raw.value ?? "") : (raw ?? ""));
    const childrenRaw = isObject ? raw.children || [] : [];
    const pathValues = [...parentValues, value];
    const pathLabels = [...parentLabels, label];
    const key = pathValues.join("\u001F") || `${parentKey}/${index}`;
    const children = normalizeGenericOptions(childrenRaw, pathValues, pathLabels, key);
    return {
      children,
      hasChildren: children.length > 0,
      key,
      label,
      pathLabels,
      pathValues,
      value,
    };
  });
}

const treeNodes = computed(() => {
  if (props.options.length)
    return normalizeGenericOptions(props.options);
  return buildOptionValueTree({
    optionConfigs: props.optionConfigs,
    rootGroupId: props.rootGroupId,
  });
});

const selectedPathValues = computed(() => parseCascadePath(props.modelValue));
const selectedNode = computed(() =>
  findOptionTreeNodeByPath(treeNodes.value, selectedPathValues.value),
);
const hasNested = computed(() => hasNestedNode(treeNodes.value));

const filteredNodes = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw)
    return treeNodes.value;
  return filterTreeByKeyword(treeNodes.value, kw);
});

const visibleNodes = computed(() =>
  flattenOptionValueTree(
    filteredNodes.value,
    keyword.value.trim() ? collectAllKeys(filteredNodes.value) : expandedKeys.value,
  ),
);

const sizeClass = computed(() =>
  props.size === "xs" ? "min-h-[33px] text-xs px-2 py-0" : "min-h-[33px] text-sm px-2 py-0",
);

const maxTreeDepth = computed(() => getMaxDepth(treeNodes.value));
const maxLabelPx = computed(() => getMaxLabelWidth(treeNodes.value));
const estimatedDropdownWidth = computed(() => {
  const baseWidth = triggerWidth.value || 0;
  const depthWidth = hasNested.value ? maxTreeDepth.value * 28 + 96 : 0;
  const labelWidth = maxLabelPx.value + depthWidth + 96;
  return Math.max(baseWidth, hasNested.value ? 260 : 120, labelWidth);
});

const dropdownStyle = computed(() => {
  const maxWidth = Math.max(180, viewportWidth.value - 32);
  const wantedWidth = Math.ceil(estimatedDropdownWidth.value);
  const width = Math.min(Math.max(wantedWidth, triggerWidth.value || 0, 120), maxWidth);
  return {
    maxWidth: "calc(100vw - 2rem)",
    minWidth: `${Math.min(Math.max(triggerWidth.value || 0, 120), maxWidth)}px`,
    width: `${width}px`,
  };
});

const controlClass = computed(() => [
  "option-tree-control border border-base-300 bg-base-100 flex items-center justify-between gap-2 text-left",
  "hover:border-base-content/30",
  props.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
  props.fullWidth ? "w-full" : "",
  sizeClass.value,
]);

const displayText = computed(() => {
  if (selectedNode.value)
    return selectedNode.value.pathLabels.join(" > ");
  return props.modelValue || props.placeholder;
});

function hasNestedNode(nodes) {
  return nodes.some(
    node => node.children?.length || node.hasChildren || hasNestedNode(node.children || []),
  );
}

function getMaxDepth(nodes, level = 0) {
  let max = level;
  for (const node of nodes || [])
    max = Math.max(max, level, getMaxDepth(node.children || [], level + 1));
  return max;
}

function estimateTextWidth(text) {
  return String(text || "")
    .split("")
    .reduce((sum, char) => {
      // CJK characters are visually wider in this UI than Latin digits/letters.
      return sum + (/[^\x00-\xFF]/.test(char) ? 20 : 12);
    }, 0);
}

function getMaxLabelWidth(nodes) {
  let max = 0;
  for (const node of nodes || []) {
    max = Math.max(max, estimateTextWidth(node.label));
    max = Math.max(max, getMaxLabelWidth(node.children || []));
  }
  return max;
}

function collectAllKeys(nodes, out = new Set()) {
  for (const node of nodes) {
    out.add(node.key);
    collectAllKeys(node.children || [], out);
  }
  return out;
}

function filterTreeByKeyword(nodes, kw) {
  const result = [];
  for (const node of nodes) {
    const children = filterTreeByKeyword(node.children || [], kw);
    const text = [...(node.pathLabels || []), ...(node.pathValues || [])].join(" ").toLowerCase();
    if (text.includes(kw) || children.length) {
      result.push({
        ...node,
        children,
        hasChildren: children.length > 0 || node.hasChildren,
      });
    }
  }
  return result;
}

function syncExpandedWithValue() {
  const keys = getOptionTreeAncestorKeys(selectedPathValues.value);
  if (!keys.length)
    return;
  const next = new Set(expandedKeys.value);
  keys.forEach(key => next.add(key));
  expandedKeys.value = next;
}

watch([() => props.modelValue, treeNodes], syncExpandedWithValue, { immediate: true });

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
  const maxWidth = Math.max(180, viewportWidth.value - 32);
  const wanted = Math.min(estimatedDropdownWidth.value || triggerWidth.value || 0, maxWidth);
  dropdownAlignEnd.value
    = !!rect && rect.left + wanted > viewportWidth.value - 8 && rect.right - wanted > 8;
}

function onToggle() {
  if (detailsRef.value?.open) {
    nextTick(updateTriggerWidth);
  }
  else {
    keyword.value = "";
  }
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
  else next.add(node.key);
  expandedKeys.value = next;
}

function selectNode(node) {
  emit("update:modelValue", formatCascadePath(node.pathValues));
  closeDropdown();
}

function clearSelection() {
  emit("update:modelValue", "");
  closeDropdown();
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
            modelValue === formatCascadePath(node.pathValues)
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
            <span v-if="node.hasChildren">{{ node.expanded ? "▾" : "▸" }}</span>
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
