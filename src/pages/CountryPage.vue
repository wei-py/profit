<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { vDraggable } from "vue-draggable-plus";
import ColEditorModal from "@/components/common/ColEditorModal.vue";
import CountryModal from "@/components/country/CountryModal.vue";
import FieldModal from "@/components/country/FieldModal.vue";
import OptionGroupModal from "@/components/country/OptionGroupModal.vue";
import RemoteUrlModal from "@/components/country/RemoteUrlModal.vue";
import TemplateModal from "@/components/country/TemplateModal.vue";
import { useFileIO } from "@/composables/useFileIO";
import { useConfigStore } from "@/stores/config";

const store = useConfigStore();
const { openConfigExcel, restoreRemoteUrl, saveConfigExcel } = useFileIO();
const CORE_KEYS = ["编号", "国家", "平台", "货币", "货币符号", "汇率", "启用"];

const dragOpts = {
  animation: 150,
  chosenClass: "drag-chosen",
  dragClass: "drag-drag",
  fallbackOnBody: true,
  forceFallback: true,
  ghostClass: "drag-ghost",
  handle: ".drag-handle",
};
const dragOptsCountry = {
  animation: 150,
  chosenClass: "drag-chosen",
  dragClass: "drag-drag",
  draggable: ".country-main-row",
  fallbackOnBody: true,
  forceFallback: true,
  ghostClass: "drag-ghost",
  handle: ".country-row-drag-handle",
};
const dragOptsOptionGroup = {
  ...dragOpts,
  draggable: ".option-source-row",
  handle: ".option-source-drag-handle",
};

const allKeys = computed(() => {
  const keys = new Set(CORE_KEYS);
  for (const row of store["国家平台"]) {
    for (const k of Object.keys(row)) {
      if (k)
        keys.add(k);
    }
  }
  return [...keys];
});
const newColName = ref("");
const showAddCol = ref(false);
const showRemoteModal = ref(false);
const expandedId = ref(null);
const cpId = computed(() => expandedId.value);

const configColumns = computed(() => {
  if (!store["国家平台"].length)
    return [];
  const order = store.国家平台ColOrder;
  const all = order.length === allKeys.value.length ? order : allKeys.value;
  const hiddenSet = new Set(store.国家平台HiddenCols);
  return all.filter(k => !hiddenSet.has(k));
});

const allConfigColumns = computed(() => {
  if (!store["国家平台"].length)
    return [];
  const order = store.国家平台ColOrder;
  return order.length === allKeys.value.length ? order : allKeys.value;
});

const expFieldsSource = computed(() => (cpId.value ? store.getFieldsByCountry(cpId.value) : []));
const localFields = ref([]);
watch(
  expFieldsSource,
  (v) => {
    localFields.value = [...v];
  },
  { immediate: true },
);
function onFieldsDragEnd() {
  const other = store["计算字段"].filter(f => f.所属国家平台 !== cpId.value);
  store["计算字段"] = [...other, ...localFields.value];
}

const expOptGroupsSource = computed(() =>
  cpId.value ? store.getOptionGroupsByCountry(cpId.value) : [],
);
const localOptGroups = ref([]);
const isDraggingOptGroups = ref(false);

function sortOptionGroups(groups) {
  return [...(groups || [])].sort((a, b) => {
    const oa = Number(a?.排序);
    const ob = Number(b?.排序);
    const aHasOrder = Number.isFinite(oa);
    const bHasOrder = Number.isFinite(ob);
    if (aHasOrder || bHasOrder) {
      const na = aHasOrder ? oa : Number.MAX_SAFE_INTEGER;
      const nb = bHasOrder ? ob : Number.MAX_SAFE_INTEGER;
      if (na !== nb)
        return na - nb;
    }
    return String(a?.名称 || a?.编号 || "").localeCompare(
      String(b?.名称 || b?.编号 || ""),
      "zh-Hans-CN",
    );
  });
}

function rootOptionGroups(groups) {
  return sortOptionGroups((groups || []).filter(g => !g.父级编号));
}

watch(
  expOptGroupsSource,
  (v) => {
    if (!isDraggingOptGroups.value)
      localOptGroups.value = rootOptionGroups(v);
  },
  { immediate: true },
);

const expTemplatesSource = computed(() =>
  cpId.value ? store.getTemplatesByCountry(cpId.value) : [],
);
const localTemplates = ref([]);
watch(
  expTemplatesSource,
  (v) => {
    localTemplates.value = [...v];
  },
  { immediate: true },
);
function onTemplatesDragEnd() {
  const other = store["计算模板"].filter(t => t.所属国家平台 !== cpId.value);
  store["计算模板"] = [...other, ...localTemplates.value];
}

function addColumn() {
  const n = newColName.value.trim();
  if (!n || allKeys.value.includes(n))
    return;
  for (const r of store["国家平台"]) {
    if (!(n in r))
      r[n] = "";
  }
  store.sync国家平台ColOrder();
  newColName.value = "";
  showAddCol.value = false;
}
function removeColumn(k) {
  if (!CORE_KEYS.includes(k)) {
    for (const r of store["国家平台"]) delete r[k];
  }
}
function addRow() {
  const r = {};
  for (const k of allKeys.value) r[k] = "";
  r.启用 = "是";
  store["国家平台"].push(r);
}
function deleteRow(id) {
  const i = store["国家平台"].findIndex(r => r.编号 === id);
  if (i !== -1)
    store["国家平台"].splice(i, 1);
}
function deleteField(idx) {
  const fields = store.getFieldsByCountry(cpId.value);
  const x = store["计算字段"].indexOf(fields[idx]);
  if (x !== -1)
    store["计算字段"].splice(x, 1);
  localFields.value.splice(idx, 1);
}
function deleteOptGroup(group) {
  if (!group)
    return;
  const ids = collectDescendantIds(group.编号);
  ids.add(group.编号);
  store["选项组"] = store["选项组"].filter(r => !ids.has(r.编号));
  store["选项值"] = store["选项值"].filter(r => !ids.has(r.所属分组));
  localOptGroups.value = localOptGroups.value.filter(r => !ids.has(r.编号));
}

function collectDescendantIds(rootId) {
  const ids = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const g of store["选项组"]) {
      if (
        g.父级编号
        && (ids.has(g.父级编号) || g.父级编号 === rootId || g.编号 === rootId)
        && !ids.has(g.编号)
      ) {
        ids.add(g.编号);
        changed = true;
      }
    }
  }
  return ids;
}
function dragTargetIndex(evt, selector = "") {
  if (evt?.newDraggableIndex !== undefined && evt?.newDraggableIndex !== null)
    return evt.newDraggableIndex;
  if (selector && evt?.to && evt?.item) {
    const items = [...evt.to.children].filter(el => el.matches?.(selector));
    const index = items.indexOf(evt.item);
    if (index >= 0)
      return index;
  }
  return evt?.newIndex;
}

function ensureDraggedItemPosition(listRef, evt, getKey, selector = "") {
  const targetIndex = dragTargetIndex(evt, selector);
  const dragKey = evt?.item?.dataset?.dragKey;
  if (!dragKey || targetIndex === undefined || targetIndex === null)
    return;

  if (String(getKey(listRef.value[targetIndex]) || "") === dragKey)
    return;

  const currentIndex = listRef.value.findIndex(item => String(getKey(item) || "") === dragKey);
  if (currentIndex < 0 || currentIndex === targetIndex)
    return;

  const [moved] = listRef.value.splice(currentIndex, 1);
  listRef.value.splice(targetIndex, 0, moved);
}

function onOptionGroupDragStart() {
  isDraggingOptGroups.value = true;
}

function onOptionGroupsDragEnd(evt) {
  ensureDraggedItemPosition(localOptGroups, evt, group => group?.编号, ".option-source-row");
  localOptGroups.value.forEach((group, index) => {
    group.排序 = index + 1;
  });
  reorderOptionGroupsForCurrentCountry();
  isDraggingOptGroups.value = false;
}

function reorderOptionGroupsForCurrentCountry() {
  if (!cpId.value)
    return;

  const localIds = new Set(expOptGroupsSource.value.map(group => group.编号));
  const otherGroups = store["选项组"].filter(group => !localIds.has(group.编号));
  const byParent = new Map();
  for (const group of expOptGroupsSource.value) {
    const parentId = group.父级编号 || "";
    const list = byParent.get(parentId) || [];
    list.push(group);
    byParent.set(parentId, list);
  }

  const orderedCountryGroups = [];
  const appendedIds = new Set();
  const appendTree = (group) => {
    if (!group || appendedIds.has(group.编号))
      return;
    orderedCountryGroups.push(group);
    appendedIds.add(group.编号);
    for (const child of sortOptionGroups(byParent.get(group.编号) || [])) appendTree(child);
  };

  for (const root of localOptGroups.value) appendTree(root);

  for (const group of expOptGroupsSource.value) {
    if (!appendedIds.has(group.编号))
      orderedCountryGroups.push(group);
  }

  store["选项组"] = [...otherGroups, ...orderedCountryGroups];
}

function deleteTpl(idx) {
  const templates = store.getTemplatesByCountry(cpId.value);
  const t = templates[idx];
  store["计算模板"] = store["计算模板"].filter(r => r.编号 !== t.编号);
  store["费用规则"] = store["费用规则"].filter(r => r.所属模板 !== t.编号);
  localTemplates.value.splice(idx, 1);
}
function toggleExpand(id) {
  expandedId.value = expandedId.value === id ? null : id;
}

const showCountryModal = ref(false);
const editingCountryId = ref("");
const showFieldModal = ref(false);
const editingFieldIdx = ref(-1);
const showOptModal = ref(false);
const editingOptGroupId = ref("");
const showTplModal = ref(false);
const editingTplIdx = ref(-1);
const showConfigColModal = ref(false);

const isDraggingCp = ref(false);
const dragExpandedId = ref(null);
const local国家平台 = ref([]);
watch(
  () => [...store["国家平台"]],
  (v) => {
    if (!isDraggingCp.value)
      local国家平台.value.splice(0, local国家平台.value.length, ...v);
  },
  { immediate: true },
);
function onCountryDragStart() {
  isDraggingCp.value = true;
  dragExpandedId.value = expandedId.value;
  expandedId.value = null;
}
function onCountryDragEnd(evt) {
  ensureDraggedItemPosition(local国家平台, evt, row => row?.编号, ".country-main-row");
  store["国家平台"].splice(0, store["国家平台"].length, ...local国家平台.value);
  const restoreId = dragExpandedId.value;
  const shouldRestore = restoreId && store["国家平台"].some(row => row.编号 === restoreId);
  dragExpandedId.value = null;
  isDraggingCp.value = false;
  expandedId.value = shouldRestore ? restoreId : null;
}

function openEditCountry(row) {
  editingCountryId.value = row.编号;
  showCountryModal.value = true;
}
function openNewField() {
  editingFieldIdx.value = -1;
  showFieldModal.value = true;
}
function openEditField(idx) {
  editingFieldIdx.value = idx;
  showFieldModal.value = true;
}
function openNewOpt() {
  editingOptGroupId.value = "";
  showOptModal.value = true;
}
function openEditOptGroup(group) {
  editingOptGroupId.value = group?.编号 || "";
  showOptModal.value = true;
}
function openNewTpl() {
  editingTplIdx.value = -1;
  showTplModal.value = true;
}
function openEditTpl(idx) {
  editingTplIdx.value = idx;
  showTplModal.value = true;
}
function openConfigColEditor() {
  showConfigColModal.value = true;
}

onMounted(() => {
  restoreRemoteUrl();
});
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <h1 class="font-bold text-2xl">配置</h1>
        <span v-if="store.isRemote" class="badge badge-warning badge-sm">远程</span>
      </div>
      <div class="flex gap-2">
        <div class="flex">
          <button @click="openConfigExcel" class="btn btn-outline btn-sm rounded-r-none">
            打开配置
          </button>
          <div class="dropdown dropdown-end">
            <button
              class="btn btn-outline btn-sm rounded-l-none border-l-base-300 border-l-0"
              tabindex="0"
            >
              ▼
            </button>
            <ul
              class="dropdown-content menu bg-base-200 rounded-box z-10 w-40 p-1 shadow-sm"
              tabindex="0"
            >
              <li><button @click="openConfigExcel" class="text-xs">📁 本地文件</button></li>
              <li><button @click="showRemoteModal = true" class="text-xs">🔗 远程链接</button></li>
            </ul>
          </div>
        </div>
        <button
          @click="saveConfigExcel"
          class="btn btn-outline btn-sm"
          :disabled="store.isRemote"
          :title="store.isRemote ? '远程配置不可直接保存，请先加载本地文件' : ''"
        >
          保存配置
        </button>
        <button @click="openConfigColEditor" class="btn btn-ghost btn-sm">⚙️ 编辑列</button>
        <button v-if="!showAddCol" @click="showAddCol = true" class="btn btn-ghost btn-sm">
          ＋ 添加列
        </button>
        <div v-else class="flex gap-1 items-center">
          <input
            v-model="newColName"
            @keyup.enter="addColumn"
            class="input input-bordered input-sm w-32"
            placeholder="列名"
          >
          <button @click="addColumn" class="btn btn-primary btn-xs">确定</button>
          <button @click="showAddCol = false" class="btn btn-ghost btn-xs">取消</button>
        </div>
      </div>
    </div>

    <div class="flex-1 space-y-4">
      <div class="bg-base-100 border border-base-300 card card-sm">
        <div class="card-body p-3">
          <div class="overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th class="w-10" />
                  <th class="w-8" />
                  <th v-for="k in configColumns" :key="k" class="group relative">
                    {{ k }}
                    <button
                      v-if="!CORE_KEYS.includes(k)"
                      @click="removeColumn(k)"
                      class="-right-1 -top-1 absolute btn btn-ghost btn-xs group-hover:opacity-100 opacity-0 text-error"
                    >
                      ✕
                    </button>
                  </th>
                  <th class="w-24">操作</th>
                </tr>
              </thead>
              <tbody
                v-draggable="[
                  local国家平台,
                  { ...dragOptsCountry, onStart: onCountryDragStart, onEnd: onCountryDragEnd },
                ]"
              >
                <template v-for="(row, ri) in local国家平台" :key="row.编号 || ri">
                  <tr
                    class="country-main-row hover"
                    :class="{ 'bg-base-200': expandedId === row.编号 }"
                    :data-drag-key="row.编号"
                  >
                    <td>
                      <span
                        class="country-row-drag-handle flex hover:text-base-content cursor-grab items-center justify-center px-1 py-0.5 select-none text-base-content/30"
                      >☰</span>
                    </td>
                    <td>
                      <button @click="toggleExpand(row.编号)" class="btn btn-ghost btn-xs">
                        {{ expandedId === row.编号 ? "▼" : "▶" }}
                      </button>
                    </td>
                    <td
                      @click="toggleExpand(row.编号)"
                      v-for="k in configColumns"
                      :key="k"
                      class="cursor-pointer"
                    >
                      {{
                        k === "启用"
                          ? row[k] === "是" || row[k] === "TRUE"
                            ? "是"
                            : "否"
                          : row[k] || "—"
                      }}
                    </td>
                    <td class="flex gap-1 items-center">
                      <button @click="openEditCountry(row)" class="btn btn-ghost btn-xs">✏️</button>
                      <button @click="deleteRow(row.编号)" class="btn btn-ghost btn-xs text-error">
                        ✕
                      </button>
                    </td>
                  </tr>
                  <tr v-if="expandedId === row.编号 && !isDraggingCp" class="country-expand-row">
                    <td class="bg-base-200/50 p-4" :colspan="configColumns.length + 3">
                      <div class="gap-4 grid grid-cols-3">
                        <div class="bg-base-100 card card-sm">
                          <div class="card-body p-3">
                            <div class="flex items-center justify-between mb-2">
                              <span class="font-semibold text-sm">字段（{{ localFields.length }}）</span>
                              <button @click="openNewField" class="btn btn-primary btn-xs">
                                ＋
                              </button>
                            </div>
                            <div v-if="!localFields.length" class="text-base-content/40 text-xs">
                              暂无
                            </div>
                            <div
                              v-else
                              v-draggable="[localFields, { ...dragOpts, onEnd: onFieldsDragEnd }]"
                            >
                              <div
                                v-for="(f, i) in localFields"
                                :key="f.字段键 || i"
                                class="border-b border-base-200 flex items-center justify-between py-1 text-xs"
                              >
                                <span class="flex gap-2 items-center">
                                  <span
                                    class="drag-handle flex hover:text-base-content items-center px-1.5 py-0.5 select-none text-base-content/30"
                                  >☰</span>
                                  <span
                                    @click="openEditField(i)"
                                    class="cursor-pointer hover:text-primary"
                                  >{{ f.字段键 || "(新)" }}
                                    <span class="text-base-content/40">{{ f.层级 }}·{{ f.输入输出 }}</span></span>
                                </span>
                                <button
                                  @click="deleteField(i)"
                                  class="btn btn-ghost btn-xs text-error"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div class="bg-base-100 card card-sm">
                          <div class="card-body p-3">
                            <div class="flex items-center justify-between mb-2">
                              <span class="font-semibold text-sm">选项来源（{{ localOptGroups.length }}）</span>
                              <button @click="openNewOpt" class="btn btn-primary btn-xs">＋</button>
                            </div>
                            <div v-if="!localOptGroups.length" class="text-base-content/40 text-xs">
                              暂无
                            </div>
                            <div
                              v-else
                              v-draggable="[
                                localOptGroups,
                                {
                                  ...dragOptsOptionGroup,
                                  onStart: onOptionGroupDragStart,
                                  onEnd: onOptionGroupsDragEnd,
                                },
                              ]"
                            >
                              <div
                                v-for="(group, i) in localOptGroups"
                                :key="group.编号 || i"
                                class="option-source-row border-b border-base-200 flex items-center justify-between py-1 text-xs"
                                :data-drag-key="group.编号"
                              >
                                <span class="flex min-w-0 flex-1 gap-2 items-center">
                                  <span
                                    class="option-source-drag-handle flex hover:text-base-content cursor-grab items-center px-1.5 py-0.5 select-none text-base-content/30"
                                    title="拖动排序"
                                  >☰</span>
                                  <span
                                    @click="openEditOptGroup(group)"
                                    class="min-w-0 cursor-pointer font-semibold truncate hover:text-primary"
                                  >
                                    {{ group.名称 || group.编号 || "(新)" }}
                                    <span class="text-base-content/40">{{ group.编号 }}</span>
                                  </span>
                                  <span
                                    v-if="collectDescendantIds(group.编号).size"
                                    class="badge badge-ghost badge-xs"
                                  >子级</span>
                                </span>
                                <button
                                  @click="deleteOptGroup(group)"
                                  class="btn btn-ghost btn-xs text-error"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div class="bg-base-100 card card-sm">
                          <div class="card-body p-3">
                            <div class="flex items-center justify-between mb-2">
                              <span class="font-semibold text-sm">模板（{{ localTemplates.length }}）</span>
                              <button @click="openNewTpl" class="btn btn-primary btn-xs">＋</button>
                            </div>
                            <div v-if="!localTemplates.length" class="text-base-content/40 text-xs">
                              暂无
                            </div>
                            <div
                              v-else
                              v-draggable="[
                                localTemplates,
                                { ...dragOpts, onEnd: onTemplatesDragEnd },
                              ]"
                            >
                              <div
                                v-for="(t, i) in localTemplates"
                                :key="t.编号 || i"
                                class="border-b border-base-200 flex items-center justify-between py-1 text-xs"
                              >
                                <span class="flex gap-2 items-center">
                                  <span
                                    class="drag-handle flex hover:text-base-content items-center px-1.5 py-0.5 select-none text-base-content/30"
                                  >☰</span>
                                  <span
                                    @click="openEditTpl(i)"
                                    class="cursor-pointer hover:text-primary"
                                  >
                                    {{ t.名称 || "(新)" }}
                                    <span class="badge badge-xs">
                                      {{ t.启用 === "是" ? "启用" : "—" }}
                                    </span></span>
                                </span>
                                <button
                                  @click="deleteTpl(i)"
                                  class="btn btn-ghost btn-xs text-error"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
          <button @click="addRow" class="btn btn-ghost btn-sm mt-2">＋ 添加国家</button>
        </div>
      </div>
    </div>

    <CountryModal
      @close="showCountryModal = false"
      :allKeys="allKeys"
      :countryId="editingCountryId"
      :open="showCountryModal"
    />
    <FieldModal
      @close="showFieldModal = false"
      :cpId="cpId"
      :fieldIdx="editingFieldIdx"
      :open="showFieldModal"
    />
    <OptionGroupModal
      @close="showOptModal = false"
      :cpId="cpId"
      :open="showOptModal"
      :selectedGroupId="editingOptGroupId"
    />
    <TemplateModal
      @close="showTplModal = false"
      :cpId="cpId"
      :open="showTplModal"
      :templateIdx="editingTplIdx"
    />
    <ColEditorModal
      @close="showConfigColModal = false"
      @update="store.国家平台ColOrder = $event"
      @update-hidden="store.国家平台HiddenCols = $event"
      filterKey=""
      :hiddenKeys="store.国家平台HiddenCols"
      :items="allConfigColumns"
      :open="showConfigColModal"
    />
    <RemoteUrlModal @close="showRemoteModal = false" :open="showRemoteModal" />
  </div>
</template>
