<script setup>
import { driver } from "driver.js";
import { computed, ref, watch } from "vue";
import { vDraggable } from "vue-draggable-plus";
import OptionTreeEditorNode from "@/components/country/OptionTreeEditorNode.vue";
import { useModalEsc } from "@/composables/useModalEsc";
import { useConfigStore } from "@/stores/config";
import {
  getParentTriggerValue,
  groupLooksBoundToOption,
  normalizeOptionGroup,
  parentOptionMatches,
} from "@/utils/optionCascade";
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
useModalEsc(() => props.open, () => emit("close"));

const store = useConfigStore();
const draftRoots = ref([]);
const expandedIds = ref(new Set());
const yesNoOptions = ["是", "否"];
let localUid = 0;

const baseDragOpts = {
  animation: 150,
  chosenClass: "drag-chosen",
  dragClass: "drag-drag",
  fallbackOnBody: true,
  forceFallback: true,
  ghostClass: "drag-ghost",
};
const rootDragOpts = {
  ...baseDragOpts,
  draggable: ".option-root-node",
  handle: ".option-root-drag-handle",
};
const itemDragOpts = {
  ...baseDragOpts,
  draggable: ".option-item-node",
  handle: ".option-item-drag-handle",
};

const totalOptionCount = computed(() => {
  let count = 0;
  walkDraftGroups((groupNode) => {
    count += groupNode.items.length;
  });
  return count;
});

watch(
  () => props.open,
  (v) => {
    if (!v)
      return;
    loadDraft();
    expandedIds.value = new Set();
  },
);

function countryPrefix() {
  const raw = String(props.cpId || "opt").trim();
  const fromCp = raw.replace(/^cp[_-]?/i, "");
  return safeIdPart(fromCp || raw || "opt");
}

function safeIdPart(value) {
  return String(value || "")
    .trim()
    .replace(/[/\\\s]+/g, "_")
    .replace(/[|,，;；]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function newKey(prefix = "node") {
  return `${prefix}_${++localUid}`;
}

function makeGroupNode(group) {
  const normalized = normalizeOptionGroup(group);
  return {
    group: normalized,
    items: [],
    key: `group:${normalized.编号 || newKey()}:${newKey()}`,
  };
}

function makeItemNode(item) {
  const value = String(item?.选项值 || item?.显示名 || "新选项");
  return {
    childGroup: null,
    item: {
      所属分组: item?.所属分组 || "",
      选项值: value,
      显示名: item?.显示名 || value,
      排序: item?.排序 || "",
      启用: item?.启用 || "是",
      备注: item?.备注 || "",
    },
    key: `item:${item?.所属分组 || ""}:${value}:${newKey()}`,
  };
}

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function loadDraft() {
  localUid = 0;
  const groups = store
    .getOptionGroupsByCountry(props.cpId)
    .map((group, index) => ({
      ...normalizeOptionGroup(JSON.parse(JSON.stringify(group))),
      __sourceIndex: index,
    }));
  const groupNodes = new Map(groups.map(group => [group.编号, makeGroupNode(group)]));
  const itemsByGroup = new Map();

  for (const item of store["选项值"].filter(item => groupNodes.has(item.所属分组))) {
    const list = itemsByGroup.get(item.所属分组) || [];
    list.push(JSON.parse(JSON.stringify(item)));
    itemsByGroup.set(item.所属分组, list);
  }

  const childGroupsByParent = new Map();
  for (const group of groups) {
    if (!group.父级编号)
      continue;
    const list = childGroupsByParent.get(group.父级编号) || [];
    list.push(group);
    childGroupsByParent.set(group.父级编号, list);
  }

  const attached = new Set();

  function childGroupMatchesItem(group, item) {
    const trigger = getParentTriggerValue(group);
    if (trigger)
      return parentOptionMatches(group, item.选项值);
    return groupLooksBoundToOption(group, item.选项值);
  }

  function hydrateGroup(groupId, guard = new Set()) {
    const node = groupNodes.get(groupId);
    if (!node || guard.has(groupId))
      return null;

    guard.add(groupId);
    const rows = [...(itemsByGroup.get(groupId) || [])].sort((a, b) => {
      const oa = toNumber(a.排序, Number.MAX_SAFE_INTEGER);
      const ob = toNumber(b.排序, Number.MAX_SAFE_INTEGER);
      if (oa !== ob)
        return oa - ob;
      return String(a.显示名 || a.选项值 || "").localeCompare(String(b.显示名 || b.选项值 || ""), "zh-Hans-CN");
    });

    node.items = rows.map((item) => {
      const itemNode = makeItemNode(item);
      const children = [...(childGroupsByParent.get(groupId) || [])].sort((a, b) => {
        const oa = toNumber(a.排序, a.__sourceIndex + 1);
        const ob = toNumber(b.排序, b.__sourceIndex + 1);
        if (oa !== ob)
          return oa - ob;
        return String(a.名称 || a.编号 || "").localeCompare(String(b.名称 || b.编号 || ""), "zh-Hans-CN");
      });
      const child = children.find(childGroup => !attached.has(childGroup.编号) && childGroupMatchesItem(childGroup, itemNode.item));
      if (child) {
        attached.add(child.编号);
        itemNode.childGroup = hydrateGroup(child.编号, new Set(guard));
      }
      return itemNode;
    });

    return node;
  }

  const roots = groups
    .filter(group => !group.父级编号)
    .sort((a, b) => {
      const oa = toNumber(a.排序, a.__sourceIndex + 1);
      const ob = toNumber(b.排序, b.__sourceIndex + 1);
      if (oa !== ob)
        return oa - ob;
      return String(a.名称 || a.编号 || "").localeCompare(String(b.名称 || b.编号 || ""), "zh-Hans-CN");
    })
    .map(group => hydrateGroup(group.编号))
    .filter(Boolean);

  draftRoots.value = roots;
}

function walkDraftGroups(fn) {
  function walk(groupNode, parentGroupNode = null, parentItemNode = null) {
    if (!groupNode)
      return;
    fn(groupNode, parentGroupNode, parentItemNode);
    for (const itemNode of groupNode.items) {
      if (itemNode.childGroup)
        walk(itemNode.childGroup, groupNode, itemNode);
    }
  }
  for (const root of draftRoots.value)
    walk(root);
}

function usedGroupIds() {
  const ids = new Set();
  walkDraftGroups(groupNode => ids.add(groupNode.group.编号));
  return ids;
}

function uniqueGroupId(base) {
  const cleaned = safeIdPart(base || `${countryPrefix()}_选项`) || `${countryPrefix()}_选项`;
  const used = usedGroupIds();
  if (!used.has(cleaned))
    return cleaned;
  let i = 2;
  while (used.has(`${cleaned}_${i}`)) i += 1;
  return `${cleaned}_${i}`;
}

function uniqueOptionValue(groupNode, base = "新选项") {
  const used = new Set(groupNode.items.map(itemNode => String(itemNode.item.选项值)));
  if (!used.has(base))
    return base;
  let i = 2;
  while (used.has(`${base}${i}`)) i += 1;
  return `${base}${i}`;
}

function childGroupDisplayName(parentGroupNode, optionValue) {
  const parentName = String(parentGroupNode?.group?.名称 || parentGroupNode?.group?.编号 || "选项").trim();
  const value = String(optionValue || "子选项").trim();
  return `${parentName} / ${value}`;
}

function addRootGroup() {
  const group = normalizeOptionGroup({
    编号: uniqueGroupId(`${countryPrefix()}_新选项`),
    名称: "新选项",
    所属国家平台: props.cpId || "",
    父级编号: "",
    父级选项值: "",
    说明: "",
    排序: draftRoots.value.length + 1,
  });
  const groupNode = makeGroupNode(group);
  draftRoots.value.push(groupNode);
  addItem(groupNode);
}

function addItem(groupNode) {
  const value = uniqueOptionValue(groupNode);
  groupNode.items.push(makeItemNode({
    所属分组: groupNode.group.编号,
    选项值: value,
    显示名: value,
    排序: groupNode.items.length + 1,
    启用: "是",
    备注: "",
  }));
  expandedIds.value = new Set([...expandedIds.value, groupNode.key]);
}

function addChildItem(parentGroupNode, itemNode) {
  if (!itemNode?.item?.选项值)
    return;
  const value = String(itemNode.item.选项值 || itemNode.item.显示名 || "子选项").trim();
  if (!itemNode.childGroup) {
    const childGroup = normalizeOptionGroup({
      编号: uniqueGroupId(`${parentGroupNode.group.编号}_${value}_children`),
      名称: childGroupDisplayName(parentGroupNode, value),
      所属国家平台: props.cpId || parentGroupNode.group.所属国家平台 || "",
      父级编号: parentGroupNode.group.编号,
      父级选项值: value,
      说明: "",
      排序: parentGroupNode.items.indexOf(itemNode) + 1,
    });
    itemNode.childGroup = makeGroupNode(childGroup);
  }
  else {
    itemNode.childGroup.group.父级编号 = parentGroupNode.group.编号;
    itemNode.childGroup.group.父级选项值 = value;
    itemNode.childGroup.group.名称 = childGroupDisplayName(parentGroupNode, value);
  }
  addItem(itemNode.childGroup);
  expandedIds.value = new Set([...expandedIds.value, parentGroupNode.key, itemNode.key, itemNode.childGroup.key]);
}

function updateItemLabel(parentGroupNode, itemNode, value) {
  const oldValue = String(itemNode.item.选项值 || "");
  const nextValue = String(value || "").trim();
  itemNode.item.选项值 = nextValue;
  itemNode.item.显示名 = nextValue;
  if (itemNode.childGroup) {
    itemNode.childGroup.group.父级编号 = parentGroupNode.group.编号;
    itemNode.childGroup.group.父级选项值 = nextValue;
    const oldAutoNames = new Set([
      oldValue,
      `${oldValue}子级`,
      childGroupDisplayName(parentGroupNode, oldValue),
    ]);
    if (!itemNode.childGroup.group.名称 || oldAutoNames.has(itemNode.childGroup.group.名称))
      itemNode.childGroup.group.名称 = childGroupDisplayName(parentGroupNode, nextValue);
  }
}

function deleteRootGroup(groupNode) {
  const idx = draftRoots.value.indexOf(groupNode);
  if (idx !== -1)
    draftRoots.value.splice(idx, 1);
}

function deleteGroup(groupNode) {
  if (draftRoots.value.includes(groupNode)) {
    deleteRootGroup(groupNode);
    return;
  }
  walkDraftGroups((node) => {
    for (const itemNode of node.items) {
      if (itemNode.childGroup === groupNode)
        itemNode.childGroup = null;
    }
  });
}

function deleteItem(groupNode, itemNode) {
  const idx = groupNode.items.indexOf(itemNode);
  if (idx !== -1)
    groupNode.items.splice(idx, 1);
}

function toggleExpand(key) {
  const next = new Set(expandedIds.value);
  if (next.has(key))
    next.delete(key);
  else next.add(key);
  expandedIds.value = next;
}

function cleanItemValue(itemNode, fallbackIndex) {
  const raw = String(itemNode.item.选项值 || itemNode.item.显示名 || `选项${fallbackIndex + 1}`).trim();
  itemNode.item.选项值 = raw;
  itemNode.item.显示名 = String(itemNode.item.显示名 || raw).trim() || raw;
  return raw;
}

function saveDraft() {
  const oldCountryGroupIds = new Set(store.getOptionGroupsByCountry(props.cpId).map(group => group.编号));
  const groupsKeep = store["选项组"].filter(group => !oldCountryGroupIds.has(group.编号));
  const itemsKeep = store["选项值"].filter(item => !oldCountryGroupIds.has(item.所属分组));
  const cleanGroups = [];
  const cleanItems = [];

  function walkSave(groupNode, parentGroupId = "", parentOptionValue = "", groupOrder = 1, parentGroupName = "") {
    if (parentGroupId && !groupNode.items.length)
      return;

    const rawGroupName = parentGroupId
      ? `${parentGroupName || parentGroupId} / ${parentOptionValue}`
      : groupNode.group.名称 || groupNode.group.编号 || `选项${groupOrder}`;
    const groupName = String(rawGroupName).trim();
    const group = normalizeOptionGroup({
      ...groupNode.group,
      编号: groupNode.group.编号 || uniqueGroupId(`${countryPrefix()}_${groupName}`),
      名称: groupName,
      所属国家平台: props.cpId || groupNode.group.所属国家平台 || "",
      父级编号: parentGroupId,
      父级选项值: parentGroupId ? parentOptionValue : "",
      排序: groupOrder,
    });
    groupNode.group = group;
    cleanGroups.push(group);

    groupNode.items.forEach((itemNode, itemIndex) => {
      const value = cleanItemValue(itemNode, itemIndex);
      cleanItems.push({
        ...itemNode.item,
        所属分组: group.编号,
        选项值: value,
        显示名: itemNode.item.显示名 || value,
        排序: itemIndex + 1,
        启用: itemNode.item.启用 || "是",
        备注: itemNode.item.备注 || "",
      });
      if (itemNode.childGroup?.items?.length)
        walkSave(itemNode.childGroup, group.编号, value, itemIndex + 1, group.名称);
    });
  }

  draftRoots.value.forEach((root, rootIndex) => walkSave(root, "", "", rootIndex + 1, ""));
  store["选项组"] = [...groupsKeep, ...cleanGroups];
  store["选项值"] = [...itemsKeep, ...cleanItems];
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
        title: "选项树",
        description: "拖动三条杠排序；点击底部保存后写入配置 Excel。",
      },
    },
  ]);
  d.drive();
}
</script>

<template>
  <dialog @cancel.prevent class="modal" :open="open">
    <div class="modal-box flex max-h-[88vh] w-[min(34rem,calc(100vw-1rem))] max-w-none flex-col overflow-hidden">
      <div class="mb-3 flex shrink-0 items-center justify-between gap-3">
        <div class="min-w-0">
          <h3 class="text-lg font-bold">选项树管理</h3>
          <p class="mt-1 text-xs opacity-60">{{ draftRoots.length }} 个来源 / {{ totalOptionCount }} 个选项。拖动三条杠排序，保存后写入配置。</p>
        </div>
        <button @click="startTour" class="btn btn-circle btn-ghost btn-sm shrink-0">?</button>
      </div>

      <div class="min-h-0 flex-1 overflow-auto border border-base-300" data-tour="option-tree-list">
        <div class="sticky top-0 z-10 flex h-10 items-center justify-between border-b border-base-300 bg-base-100 px-3">
          <div class="font-semibold text-sm">选项树</div>
          <button @click="addRootGroup" class="btn btn-ghost btn-xs">＋顶级</button>
        </div>

        <ul v-if="draftRoots.length" v-draggable="[draftRoots, rootDragOpts]">
          <OptionTreeEditorNode
            v-for="groupNode in draftRoots"
            :key="groupNode.key"
            :dragOpts="itemDragOpts"
            :expandedIds="expandedIds"
            :groupNode="groupNode"
            :level="0"
            :yesNoOptions="yesNoOptions"
            @add-child-item="addChildItem"
            @add-item="addItem"
            @delete-group="deleteGroup"
            @delete-item="deleteItem"
            @toggle="toggleExpand"
            @update-item-label="updateItemLabel"
          />
        </ul>

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
