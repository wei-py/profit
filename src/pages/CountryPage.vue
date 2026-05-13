<script setup>
import { computed, ref, watch } from "vue";
import ColEditorModal from "@/components/common/ColEditorModal.vue";
import CountryModal from "@/components/country/CountryModal.vue";
import FieldModal from "@/components/country/FieldModal.vue";
import OptionGroupModal from "@/components/country/OptionGroupModal.vue";
import TemplateModal from "@/components/country/TemplateModal.vue";
import { vDraggable } from "vue-draggable-plus";
import { useFileIO } from "@/composables/useFileIO";
import { useConfigStore } from "@/stores/config";

const store = useConfigStore();
const { openConfigExcel, saveConfigExcel } = useFileIO();
const CORE_KEYS = ["编号", "国家", "平台", "货币", "货币符号", "汇率", "启用", "排序"];

const dragOpts = {
  animation: 150,
  chosenClass: "drag-chosen",
  dragClass: "drag-drag",
  fallbackOnBody: true,
  forceFallback: true,
  ghostClass: "drag-ghost",
  handle: ".drag-handle",
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
const expandedId = ref(null);
const cpId = computed(() => expandedId.value);

const configColumns = computed(() => {
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
watch(
  expOptGroupsSource,
  (v) => {
    localOptGroups.value = [...v];
  },
  { immediate: true },
);
function onOptGroupsDragEnd() {
  const other = store["选项组"].filter(g => g.所属国家平台 !== cpId.value);
  store["选项组"] = [...other, ...localOptGroups.value];
}

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
function deleteOpt(idx) {
  const groups = store.getOptionGroupsByCountry(cpId.value);
  const g = groups[idx];
  store["选项组"] = store["选项组"].filter(r => r.编号 !== g.编号);
  store["选项值"] = store["选项值"].filter(r => r.所属分组 !== g.编号);
  localOptGroups.value.splice(idx, 1);
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
const editingOptIdx = ref(-1);
const showTplModal = ref(false);
const editingTplIdx = ref(-1);
const showConfigColModal = ref(false);

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
  editingOptIdx.value = -1;
  showOptModal.value = true;
}
function openEditOpt(idx) {
  editingOptIdx.value = idx;
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
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="flex items-center justify-between mb-4">
      <h1 class="font-bold text-2xl">配置</h1>
      <div class="flex gap-2">
        <button @click="openConfigExcel" class="btn btn-outline btn-sm">打开配置</button>
        <button @click="saveConfigExcel" class="btn btn-outline btn-sm">保存配置</button>
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

    <div class="flex-1 min-h-0 overflow-auto space-y-4">
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
              <tbody>
                <template v-for="(row, ri) in store['国家平台']" :key="row.编号 || ri">
                  <tr
                    class="hover"
                    :class="{ 'bg-base-200': expandedId === row.编号 }"
                  >
                    <td>
                      <span
                        class="flex hover:text-base-content items-center justify-center px-1 py-0.5 select-none text-base-content/30"
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
                  <tr v-if="expandedId === row.编号">
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
                            <div v-else v-draggable="[localFields, { ...dragOpts, onEnd: onFieldsDragEnd }]">
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
                              <span class="font-semibold text-sm">选项组（{{ localOptGroups.length }}）</span>
                              <button @click="openNewOpt" class="btn btn-primary btn-xs">＋</button>
                            </div>
                            <div v-if="!localOptGroups.length" class="text-base-content/40 text-xs">
                              暂无
                            </div>
                            <div v-else v-draggable="[localOptGroups, { ...dragOpts, onEnd: onOptGroupsDragEnd }]">
                              <div
                                v-for="(g, i) in localOptGroups"
                                :key="g.编号 || i"
                                class="border-b border-base-200 flex items-center justify-between py-1 text-xs"
                              >
                                <span class="flex gap-2 items-center">
                                  <span
                                    class="drag-handle flex hover:text-base-content items-center px-1.5 py-0.5 select-none text-base-content/30"
                                  >☰</span>
                                  <span
                                    @click="openEditOpt(i)"
                                    class="cursor-pointer hover:text-primary"
                                  >
                                    {{ g.名称 || "(新)" }}
                                    <span class="text-base-content/40">{{ g.编号 }}</span></span>
                                </span>
                                <button
                                  @click="deleteOpt(i)"
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
                            <div v-else v-draggable="[localTemplates, { ...dragOpts, onEnd: onTemplatesDragEnd }]">
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
      :groupIdx="editingOptIdx"
      :open="showOptModal"
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
      :items="configColumns"
      :open="showConfigColModal"
      filterKey=""
    />
  </div>
</template>
