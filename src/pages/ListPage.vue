<script setup>
import { previewImages } from "hevue-img-preview/v3";
import { computed, nextTick, ref, watch } from "vue";
import { vDraggable } from "vue-draggable-plus";
import ColEditorModal from "@/components/common/ColEditorModal.vue";
import FieldInput from "@/components/common/FieldInput.vue";
import OptionTreeSelect from "@/components/common/OptionTreeSelect.vue";
import PaginationBar from "@/components/common/PaginationBar.vue";
import ReverseCalcModal from "@/components/list/ReverseCalcModal.vue";
import TraceModal from "@/components/list/TraceModal.vue";
import { useFileIO } from "@/composables/useFileIO";
import { useTour } from "@/composables/useTour";
import {
  groupRecordsByProductId,
  inferVariantAttributes,
  makeRecordProductKey,
  makeVariantKeyFromAttrs,
  makeVariantKeyFromRow,
  normalizeProductId,
  normalizeVariantValues,
} from "@/domain/product-records";
import { useConfigStore } from "@/stores/config";
import { useCreateStore } from "@/stores/create";
import { useListStore } from "@/stores/list";
import { FONT_TABLE_XS, LINE_HEIGHT_TABLE_XS, measureTextHeight } from "@/utils/textMeasure";

const configStore = useConfigStore();
const createStore = useCreateStore();
const listStore = useListStore();
const { openListExcel, saveListExcel } = useFileIO();
const { startTour } = useTour();

const productHelpSteps = [
  {
    element: "[data-tour=\"product-editor\"]",
    popover: {
      description:
        "先选择国家平台和模板，再填写商品 ID、商品名称、商品级字段和变体属性。读取商品记录后这里会切换为修改商品。",
      title: "商品编辑区",
    },
  },
  {
    element: "[data-tour=\"product-actions\"]",
    popover: {
      description: "生成 SKU、计算、保存到列表/保存修改都在这里。",
      title: "商品操作",
    },
  },
];
const productFieldHelpSteps = [
  {
    element: "[data-tour=\"product-fields\"]",
    popover: {
      description: "商品级字段会写入当前商品的所有 SKU。下拉字段会自动使用配置里的选项树。",
      title: "商品级字段",
    },
  },
];
const variantHelpSteps = [
  {
    element: "[data-tour=\"product-variants\"]",
    popover: {
      description: "每个变体属性一行，例如颜色=红|蓝，尺码=S|M。点击生成 SKU 后会生成组合。",
      title: "变体属性",
    },
  },
];
const skuHelpSteps = [
  {
    element: "[data-tour=\"sku-toolbar\"]",
    popover: {
      description: "SKU 列表支持表格/卡片、编辑列、分页和拖拽排序。",
      title: "SKU 列表操作区",
    },
  },
  {
    element: "[data-tour=\"sku-table\"]",
    popover: {
      description: "输入每个 SKU 的字段，点击计算得到输出结果。拖动左侧三条杠调整 SKU 顺序。",
      title: "SKU 明细",
    },
  },
];
const recordsHelpSteps = [
  {
    element: "[data-tour=\"records-toolbar\"]",
    popover: {
      description: "商品记录默认表格显示。可以切换卡片、编辑列和分页查看。",
      title: "商品记录操作区",
    },
  },
  {
    element: "[data-tour=\"records-table\"]",
    popover: {
      description:
        "同商品 ID 的 SKU 会作为一整块显示和拖拽。点击操作列的复制图标可读取整组数据到上方修改。",
      title: "商品记录列表",
    },
  },
];

const baseDragOpts = {
  animation: 150,
  chosenClass: "drag-chosen",
  dragClass: "drag-drag",
  fallbackOnBody: true,
  forceFallback: true,
  ghostClass: "drag-ghost",
};

const isDraggingSku = ref(false);
const isDraggingRecordGroup = ref(false);
const editingSourceProductId = ref("");
const editingRecordUids = ref(new Set());
const isEditingProduct = computed(
  () => !!editingSourceProductId.value || editingRecordUids.value.size > 0,
);

const skuDragOpts = {
  ...baseDragOpts,
  draggable: ".sku-draggable-row",
  handle: ".sku-drag-handle",
  onEnd: onSkuDragEnd,
  onStart: () => {
    isDraggingSku.value = true;
  },
};

const recordGroupDragOpts = {
  ...baseDragOpts,
  draggable: ".product-record-group",
  handle: ".record-group-drag-handle",
  onEnd: onRecordGroupDragEnd,
  onStart: () => {
    isDraggingRecordGroup.value = true;
  },
};
const RESERVED_LIST_COLUMNS = new Set(["_uid", "操作"]);

const showCreatePanel = ref(true);

watch(
  () => createStore.selectedTemplateId,
  (id) => {
    if (id)
      createStore.generateSkus();
  },
);

const enabledCountries = computed(() => configStore["国家平台"].filter(c => c.启用 === "是"));
const availableTemplates = computed(() =>
  createStore.selectedCountryId
    ? configStore.getCalculationConfigsByCountry(createStore.selectedCountryId)
    : [],
);
const countryOptions = computed(() =>
  enabledCountries.value.map(c => ({
    label: `${c.国家} - ${c.平台}`,
    value: c.编号,
  })),
);
const templateOptions = computed(() =>
  availableTemplates.value.map(t => ({
    label: t.模板名称,
    value: t.模板编号,
  })),
);

function handleCalculate() {
  createStore.calculateAll();
}
async function handleSaveToList() {
  if (!createStore.lastCalculatedAt)
    await createStore.calculateAll();
  const rows = createStore.productRows();
  if (!rows.length)
    return;

  if (isEditingProduct.value) {
    listStore.replaceRecordsByProductId(
      editingSourceProductId.value || createStore.productId,
      rows,
    );
  }
  else {
    listStore.addRecords(rows);
  }

  clearEditMode();
}

function handleCountrySelect(countryId) {
  clearEditMode();
  createStore.selectCountry(countryId);
}

function handleTemplateSelect(templateId) {
  clearEditMode();
  createStore.selectTemplate(templateId);
}

function batchSetSkuInput(fieldKey) {
  const val = createStore.skus[0]?.inputs[fieldKey];
  if (val === undefined || val === "")
    return;
  for (const sku of createStore.skus) sku.inputs[fieldKey] = val;
}

// ── Modal state ──
const showCalcModal = ref(false);
const calcSkuIndex = ref(-1);
const showTraceModal = ref(false);
const traceSkuKey = ref("");
const traceFieldKey = ref("");
const showColModal = ref(false);
const skuColModal = ref(false);
const skuColOrder = ref([]);
const skuHiddenKeys = ref([]);
const skuViewMode = ref("table");
const recordViewMode = ref("table");
const skuCardExpanded = ref(localStorage.getItem("skuCardExpanded") === "true");
const recordCardExpanded = ref(localStorage.getItem("recordCardExpanded") === "true");
const createPanelTitle = computed(() => (isEditingProduct.value ? "修改商品" : "新建商品"));

watch(skuCardExpanded, v => localStorage.setItem("skuCardExpanded", String(v)));
watch(recordCardExpanded, v => localStorage.setItem("recordCardExpanded", String(v)));

const skuAllFields = computed(() => {
  const fields = [];
  for (const f of createStore.skuInputFields) fields.push(f.字段键);
  fields.push("图片");
  for (const f of createStore.skuOutputFields) fields.push(f.字段键);
  return fields;
});

const skuColDisplay = computed(() => {
  const all = skuAllFields.value;
  const order
    = skuColOrder.value.length && skuColOrder.value.length === all.length ? skuColOrder.value : all;
  const hiddenSet = new Set(skuHiddenKeys.value);
  return order.filter(k => !hiddenSet.has(k));
});

watch(
  skuAllFields,
  (v) => {
    if (!skuColOrder.value.length || skuColOrder.value.length !== v.length) {
      skuColOrder.value = [...v];
    }
  },
  { immediate: true },
);

const currentPage = ref(1);
const pageSize = ref(20);

const recordGroups = computed(() => {
  const groups = [];
  const groupByKey = new Map();
  for (const row of listStore.records) {
    const key = makeRecordProductKey(row);
    let group = groupByKey.get(key);
    if (!group) {
      group = {
        key,
        rows: [],
      };
      groupByKey.set(key, group);
      groups.push(group);
    }
    group.rows.push(row);
  }
  return groups;
});

function buildRecordGroupPages(groups, maxRows) {
  const size = Math.max(1, Number(maxRows) || 20);
  const pages = [];
  let page = [];
  let rowsCount = 0;

  for (const group of groups) {
    const groupSize = Math.max(1, group.rows.length);
    if (page.length && rowsCount + groupSize > size) {
      pages.push(page);
      page = [];
      rowsCount = 0;
    }
    page.push(group);
    rowsCount += groupSize;
  }

  if (page.length)
    pages.push(page);
  return pages;
}

const recordGroupPages = computed(() => buildRecordGroupPages(recordGroups.value, pageSize.value));
const totalPages = computed(() => recordGroupPages.value.length || 1);
const pagedRecordGroups = ref([]);

function syncPagedRecordGroups() {
  if (isDraggingRecordGroup.value)
    return;
  pagedRecordGroups.value = [...(recordGroupPages.value[currentPage.value - 1] || [])];
}

watch([recordGroupPages, currentPage, pageSize], syncPagedRecordGroups, { immediate: true });

const skuPage = ref(1);
const skuPageSize = ref(20);
const skuPageOffset = computed(() => (skuPage.value - 1) * skuPageSize.value);
const pagedSkus = ref([]);

function syncPagedSkus() {
  if (isDraggingSku.value)
    return;
  const start = skuPageOffset.value;
  pagedSkus.value = createStore.skus
    .slice(start, start + skuPageSize.value)
    .map((sku, i) => ({ origIdx: start + i, sku }));
}

watch(
  [() => createStore.skus.map(sku => sku.key).join("\u001F"), skuPage, skuPageSize],
  syncPagedSkus,
  { immediate: true },
);

const skuTotalPages = computed(() => Math.ceil(createStore.skus.length / skuPageSize.value) || 1);

watch(pageSize, () => {
  if (currentPage.value > totalPages.value)
    currentPage.value = totalPages.value;
});

watch(
  () => createStore.skus.length,
  () => {
    if (skuPage.value > skuTotalPages.value)
      skuPage.value = skuTotalPages.value || 1;
  },
);

watch(skuPageSize, () => {
  if (skuPage.value > skuTotalPages.value)
    skuPage.value = skuTotalPages.value;
});

watch(
  () => listStore.records.length,
  () => {
    if (listStore.records.length)
      listStore.syncColumnOrder();
    if (currentPage.value > totalPages.value)
      currentPage.value = totalPages.value || 1;
  },
);

const listColumns = computed(() => {
  if (!listStore.records.length)
    return [];
  const hiddenSet = new Set(listStore.hiddenColumns);
  return listStore.columnOrder.filter(k => !RESERVED_LIST_COLUMNS.has(k) && !hiddenSet.has(k));
});

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

function onSkuDragEnd(evt) {
  ensureDraggedItemPosition(pagedSkus, evt, item => item?.sku?.key, ".sku-draggable-row");
  const offset = skuPageOffset.value;
  const count = Math.min(skuPageSize.value, Math.max(0, createStore.skus.length - offset));
  const nextRows = pagedSkus.value.map(item => item?.sku).filter(Boolean);
  createStore.skus.splice(offset, count, ...nextRows);
  isDraggingSku.value = false;
  syncPagedSkus();
}

function onRecordGroupDragEnd(evt) {
  ensureDraggedItemPosition(pagedRecordGroups, evt, group => group?.key, ".product-record-group");
  const currentGroups = recordGroups.value;
  const firstPageGroup = recordGroupPages.value[currentPage.value - 1]?.[0];
  const startIndex = firstPageGroup
    ? currentGroups.findIndex(group => group.key === firstPageGroup.key)
    : -1;

  if (startIndex >= 0) {
    const nextGroups = [...currentGroups];
    nextGroups.splice(startIndex, pagedRecordGroups.value.length, ...pagedRecordGroups.value);
    const nextRecords = nextGroups.flatMap(group => group.rows);
    listStore.records.splice(0, listStore.records.length, ...nextRecords);
  }

  isDraggingRecordGroup.value = false;
  syncPagedRecordGroups();
}

function findRecordIndex(row) {
  return listStore.records.findIndex(item => item?._uid === row?._uid);
}

function loadRecordBackByRow(row) {
  const idx = findRecordIndex(row);
  if (idx >= 0)
    loadRecordBack(idx);
}

function removeRecordByRow(row) {
  const idx = findRecordIndex(row);
  if (idx >= 0)
    listStore.removeRecord(idx);
}

const recordProductStripeMap = computed(() => {
  const map = new Map();
  let index = 0;
  for (const row of listStore.records) {
    const key = makeRecordProductKey(row);
    if (!map.has(key))
      map.set(key, index++);
  }
  return map;
});

function isRecordInEditingGroup(row) {
  const productId = normalizeProductId(row?.["商品ID"]);
  if (editingSourceProductId.value && productId)
    return productId === editingSourceProductId.value;
  return editingRecordUids.value.has(row?._uid);
}

function recordVisualClass(row) {
  if (isRecordInEditingGroup(row))
    return "record-selected";
  const idx = recordProductStripeMap.value.get(makeRecordProductKey(row)) || 0;
  return idx % 2 === 0 ? "record-stripe-even" : "record-stripe-odd";
}

function clearEditMode() {
  editingSourceProductId.value = "";
  editingRecordUids.value = new Set();
}

function openCalcModal(si) {
  calcSkuIndex.value = si;
  showCalcModal.value = true;
}

function openTrace(sku, fieldKey) {
  traceSkuKey.value = sku.key;
  traceFieldKey.value = fieldKey;
  showTraceModal.value = true;
}

function openImagePreview(src) {
  previewImages({
    clickMaskCLose: true,
    disableTransition: true,
    imgList: [src],
    keyboard: true,
    nowImgIndex: 0,
  });
}

function handleImageUpload(sku, event) {
  const file = event.target.files[0];
  if (!file)
    return;
  const reader = new FileReader();
  reader.onload = () => {
    sku.images = reader.result;
  };
  reader.readAsDataURL(file);
}
function clearImage(sku) {
  sku.images = "";
}

function isImage(val) {
  if (typeof val === "string" && val.startsWith("data:image/"))
    return true;
  if (typeof val === "string" && (val.startsWith("asset://") || val.includes("/images/"))) {
    return true;
  }
  return false;
}

function isDispimg(val) {
  return typeof val === "string" && val.startsWith("=DISPIMG(");
}
function isSkuInputCol(fk) {
  return createStore.skuInputFields.some(f => f.字段键 === fk);
}
function getSkuField(fk) {
  return createStore.skuInputFields.find(f => f.字段键 === fk) || {};
}
function isPercentCol(fk) {
  return createStore.skuOutputFields.some(f => f.字段键 === fk && f.单位 === "%");
}

function formatSkuResultText(sku, fk) {
  if (sku.error)
    return sku.error;
  if (sku.results[fk] === undefined)
    return "";
  if (isPercentCol(fk))
    return `${(sku.results[fk] * 100).toFixed(2)}%`;
  if (typeof sku.results[fk] === "number")
    return sku.results[fk].toFixed(2);
  return String(sku.results[fk]);
}

const skuRowHeights = computed(() => {
  return createStore.skus.map((sku) => {
    let maxH = 0;
    for (const a of createStore.variantAttributes) {
      if (a.name.trim()) {
        const h = measureTextHeight(
          String(sku.attrs[a.name.trim()] || ""),
          60,
          LINE_HEIGHT_TABLE_XS,
          FONT_TABLE_XS,
        );
        if (h > maxH)
          maxH = h;
      }
    }
    for (const fk of skuColDisplay.value) {
      if (fk === "图片" || isSkuInputCol(fk))
        continue;
      const text = formatSkuResultText(sku, fk);
      if (!text)
        continue;
      const h = measureTextHeight(text, 120, LINE_HEIGHT_TABLE_XS, FONT_TABLE_XS);
      if (h > maxH)
        maxH = h;
    }
    return Math.max(32, maxH + 8);
  });
});

async function loadRecordBack(idx) {
  const row = listStore.records[idx];
  if (!row || !row["国家平台编号"] || !row["模板编号"])
    return;

  const productId = normalizeProductId(row["商品ID"]);
  const relatedRows = groupRecordsByProductId(listStore.records, productId, row);

  createStore.selectCountry(row["国家平台编号"]);
  createStore.selectTemplate(row["模板编号"]);
  await nextTick();

  const firstRow = relatedRows[0] || row;
  createStore.productId = firstRow["商品ID"] || "";
  createStore.productName = firstRow["商品名称"] || "";

  for (const k of Object.keys(createStore.productInputs)) delete createStore.productInputs[k];
  for (const f of createStore.productFields)
    createStore.productInputs[f.字段键] = firstRow[f.字段键] ?? "";

  const variantAttrs = inferVariantAttributes(
    relatedRows,
    configStore.getFieldsByCountry(createStore.selectedCountryId),
  );
  createStore.variantAttributes = variantAttrs;
  if (!variantAttrs.length && relatedRows.length > 1)
    buildSkuRowsWithoutVariants(relatedRows);
  else createStore.generateSkus();

  const skuByKey = new Map(
    createStore.skus.map(sku => [makeVariantKeyFromAttrs(sku.attrs, variantAttrs), sku]),
  );
  relatedRows.forEach((sourceRow, rowIndex) => {
    const key = makeVariantKeyFromRow(sourceRow, variantAttrs);
    const sku = variantAttrs.length
      ? skuByKey.get(key)
      : createStore.skus[rowIndex] || createStore.skus[0];
    if (!sku)
      return;

    sku.skuCode = sourceRow["SKU码"] || "";
    sku.images = sourceRow["图片"] || "";
    for (const f of createStore.skuInputFields) sku.inputs[f.字段键] = sourceRow[f.字段键] ?? "";
    for (const f of createStore.skuOutputFields) {
      if (sourceRow[f.字段键] !== undefined)
        sku.results[f.字段键] = sourceRow[f.字段键];
    }
  });

  editingSourceProductId.value = productId;
  editingRecordUids.value = new Set(relatedRows.map(r => r._uid));
  showCreatePanel.value = true;
}

function buildSkuRowsWithoutVariants(rows) {
  createStore.generateSkus();
  const baseInputs = { ...(createStore.skus[0]?.inputs || {}) };
  createStore.skus.splice(
    0,
    createStore.skus.length,
    ...rows.map((row, index) => ({
      attrs: {},
      error: "",
      images: "",
      inputs: { ...baseInputs },
      key: row["SKU码"] || `row_${index + 1}`,
      results: {},
      skuCode: row["SKU码"] || "",
    })),
  );
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="flex items-center justify-between mb-4">
      <h1 class="font-bold text-2xl">商品列表</h1>
      <div class="flex gap-2" data-tour="list-toolbar">
        <button
          @click="startTour('list')"
          class="btn btn-circle btn-ghost btn-sm"
          title="商品页引导"
        >
          ?
        </button>
        <button @click="openListExcel" class="btn btn-outline btn-sm">打开列表</button>
        <button @click="saveListExcel" class="btn btn-outline btn-sm">保存列表</button>
        <button @click="showCreatePanel = !showCreatePanel" class="btn btn-primary btn-sm">
          {{ showCreatePanel ? "收起 ▲" : "＋ 新建" }}
        </button>
      </div>
    </div>

    <div class="flex-1 space-y-4">
      <!-- 新建面板 -->
      <div
        v-if="showCreatePanel"
        class="bg-base-100 border border-base-300 card card-sm"
        data-tour="product-editor"
      >
        <div class="card-body">
          <div class="flex items-center justify-between gap-2">
            <h2 class="card-title text-lg">
              {{ createPanelTitle }}
              <span
                v-if="isEditingProduct"
                class="badge badge-primary badge-sm"
              >商品ID：{{ editingSourceProductId || createStore.productId }}</span>
            </h2>
            <div class="flex gap-1 items-center">
              <button
                @click="startTour(productHelpSteps)"
                class="btn btn-circle btn-ghost btn-xs"
                title="商品编辑帮助"
              >
                ?
              </button>
              <button
                v-if="isEditingProduct"
                @click="clearEditMode"
                class="btn btn-ghost btn-xs"
                title="退出修改状态"
              >
                退出修改
              </button>
            </div>
          </div>
          <div class="flex flex-wrap gap-4 items-start" data-tour="product-preset">
            <div class="flex flex-col gap-1">
              <label class="label py-1"><span class="label-text">国家平台</span></label>
              <OptionTreeSelect
                @update:model-value="handleCountrySelect($event)"
                :modelValue="createStore.selectedCountryId"
                :options="countryOptions"
                placeholder="-- 选择 --"
              />
            </div>
            <div v-if="createStore.selectedCountryId" class="flex flex-col gap-1">
              <label class="label py-1"><span class="label-text">模板</span></label>
              <OptionTreeSelect
                @update:model-value="handleTemplateSelect($event)"
                :modelValue="createStore.selectedTemplateId"
                :options="templateOptions"
                placeholder="-- 选择 --"
              />
            </div>
            <div class="flex flex-col gap-1">
              <label class="label py-1"><span class="label-text">商品ID</span></label>
              <input
                v-model="createStore.productId"
                class="input input-bordered input-sm w-20"
                placeholder="P001"
              >
            </div>
            <div class="flex flex-col gap-1">
              <label class="label py-1"><span class="label-text">商品名称</span></label>
              <input
                v-model="createStore.productName"
                class="input input-bordered input-sm w-28"
                placeholder="如：T恤"
              >
            </div>
          </div>

          <template v-if="createStore.selectedTemplateId">
            <div class="flex flex-col gap-4 mt-4 lg:flex-row">
              <div class="w-full shrink-0 space-y-2 lg:w-60">
                <div class="flex items-center justify-between" data-tour="product-fields">
                  <div class="font-semibold text-sm">商品级字段</div>
                  <button
                    @click="startTour(productFieldHelpSteps)"
                    class="btn btn-circle btn-ghost btn-xs"
                    title="商品级字段帮助"
                  >
                    ?
                  </button>
                </div>
                <FieldInput
                  @update:model-value="createStore.productInputs[f.字段键] = $event"
                  v-for="f in createStore.productFields"
                  :key="f.字段键"
                  :field="f"
                  :modelValue="createStore.productInputs[f.字段键]"
                  :optionConfigs="configStore['选项配置']"
                />
                <div class="flex flex-col gap-1 pt-3">
                  <label class="label py-0"><span class="label-text text-xs">SKU前缀</span></label>
                  <input
                    v-model="createStore.skuPrefix"
                    class="input input-bordered input-sm w-20"
                    placeholder="如: RS"
                  >
                </div>
                <div class="flex items-center justify-between pt-2" data-tour="product-variants">
                  <div class="font-semibold text-sm">变体属性</div>
                  <button
                    @click="startTour(variantHelpSteps)"
                    class="btn btn-circle btn-ghost btn-xs"
                    title="变体帮助"
                  >
                    ?
                  </button>
                </div>
                <div
                  v-for="(attr, i) in createStore.variantAttributes"
                  :key="i"
                  class="flex gap-1 items-center"
                >
                  <input
                    v-model="attr.name"
                    class="input input-bordered input-sm w-16"
                    placeholder="颜色"
                  >
                  <input
                    v-model="attr.values"
                    @input="attr.values = normalizeVariantValues(attr.values)"
                    class="flex-1 input input-bordered input-sm min-w-0"
                    placeholder="红|蓝"
                  >
                  <button
                    @click="createStore.removeVariantAttribute(i)"
                    class="btn btn-ghost btn-sm h-9 min-h-9 px-2 text-error"
                  >
                    ✕
                  </button>
                </div>
                <button @click="createStore.addVariantAttribute" class="btn btn-ghost btn-xs">
                  ＋ 变体属性
                </button>
                <div class="flex gap-2 pt-3" data-tour="product-actions">
                  <button @click="createStore.generateSkus()" class="btn btn-sm">生成SKU</button>
                  <button
                    @click="handleCalculate"
                    class="btn btn-primary btn-sm"
                    :disabled="createStore.calculating"
                  >
                    计算
                  </button>
                  <button @click="handleSaveToList" class="btn btn-sm btn-success">
                    {{ isEditingProduct ? "保存修改" : "保存到列表" }}
                  </button>
                </div>
              </div>

              <div class="min-w-0 flex-1 overflow-x-auto">
                <div class="flex items-center justify-between mb-1" data-tour="sku-toolbar">
                  <span class="font-semibold text-sm">SKU 列表</span>
                  <div class="flex gap-1 items-center text-xs">
                    <button
                      @click="startTour(skuHelpSteps)"
                      class="btn btn-circle btn-ghost btn-xs"
                      title="SKU 帮助"
                    >
                      ?
                    </button>
                    <span>表格</span>
                    <input
                      @change="skuViewMode = $event.target.checked ? 'card' : 'table'"
                      :checked="skuViewMode === 'card'"
                      class="toggle toggle-sm"
                      type="checkbox"
                    >
                    <span>卡片</span>
                    <button
                      v-if="skuViewMode === 'card'"
                      @click="skuCardExpanded = !skuCardExpanded"
                      class="btn btn-ghost btn-xs"
                      :title="skuCardExpanded ? '收起' : '展开'"
                    >
                      {{ skuCardExpanded ? "收起" : "展开" }}
                    </button>
                    <span
                      v-if="createStore.skus.length"
                      class="mx-1 opacity-40"
                    >{{ skuPage }}/{{ skuTotalPages }}</span>
                    <button @click="skuColModal = true" class="btn btn-ghost btn-xs">
                      ⚙️ 编辑列
                    </button>
                  </div>
                </div>
                <template v-if="skuViewMode === 'table' && createStore.skus.length">
                  <table class="table table-xs" data-tour="sku-table">
                    <thead>
                      <tr>
                        <th class="bg-base-100 left-0 sticky w-10 z-10" />
                        <th class="w-8 text-xs">反推</th>
                        <th class="text-xs">SKU码</th>
                        <th
                          v-for="a in createStore.variantAttributes.filter((a) => a.name.trim())"
                          :key="a.name"
                        >
                          {{ a.name.trim() }}
                        </th>
                        <th v-for="fk in skuColDisplay" :key="fk">
                          <div class="flex gap-0 items-center">
                            <span class="text-xs">{{ fk }}</span>
                            <button
                              v-if="isSkuInputCol(fk)"
                              @click="batchSetSkuInput(fk)"
                              class="btn btn-ghost btn-xs hover:opacity-100 opacity-30 px-0"
                              title="统一"
                            >
                              ⇅
                            </button>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody v-draggable="[pagedSkus, skuDragOpts]">
                      <tr
                        v-for="item in pagedSkus"
                        :key="item.sku.key"
                        class="sku-draggable-row"
                        :data-drag-key="item.sku.key"
                        :style="{ height: `${skuRowHeights[item.origIdx]}px` }"
                      >
                        <td class="bg-base-100 left-0 sticky z-10">
                          <span
                            class="sku-drag-handle flex hover:text-base-content cursor-grab items-center justify-center px-1 py-0.5 select-none text-base-content/30"
                          >☰</span>
                        </td>
                        <td>
                          <button
                            @click="openCalcModal(item.origIdx)"
                            class="btn btn-ghost btn-xs"
                            title="反推计算"
                          >
                            🧮
                          </button>
                        </td>
                        <td>
                          <input
                            v-model="item.sku.skuCode"
                            class="input input-bordered input-xs w-20"
                            placeholder="SKU"
                          >
                        </td>
                        <td
                          v-for="a in createStore.variantAttributes.filter((a) => a.name.trim())"
                          :key="a.name"
                          class="text-xs"
                        >
                          {{ item.sku.attrs[a.name.trim()] }}
                        </td>
                        <td v-for="fk in skuColDisplay" :key="fk">
                          <template v-if="isSkuInputCol(fk)">
                            <FieldInput
                              @update:model-value="item.sku.inputs[fk] = $event"
                              :field="getSkuField(fk)"
                              :modelValue="item.sku.inputs[fk]"
                              noLabel
                              :optionConfigs="configStore['选项配置']"
                            />
                          </template>
                          <template v-else-if="fk === '图片'">
                            <div v-if="item.sku.images" class="group h-10 relative w-10">
                              <img
                                @click="openImagePreview(item.sku.images)"
                                class="border cursor-pointer h-10 object-contain bg-base-100 w-10"
                                :src="item.sku.images"
                              >
                              <button
                                @click="clearImage(item.sku)"
                                class="-right-1 -top-1 absolute bg-base-100 btn btn-ghost btn-xs group-hover:opacity-100 h-4 min-h-0 opacity-0 p-0 rounded-full w-4"
                              >
                                ✕
                              </button>
                            </div>
                            <label
                              v-else
                              class="border border-dashed btn btn-ghost btn-xs cursor-pointer h-10 p-0 text-base-content/30 text-lg w-10"
                              title="上传图片"
                            >＋<input
                              @change="handleImageUpload(item.sku, $event)"
                              accept="image/*"
                              class="hidden"
                              type="file"
                            ></label>
                          </template>
                          <template v-else>
                            <span v-if="item.sku.error" class="text-error text-xs">{{
                              item.sku.error
                            }}</span>
                            <template v-else-if="item.sku.results[fk] !== undefined">
                              {{
                                isPercentCol(fk)
                                  ? `${(item.sku.results[fk] * 100).toFixed(2)}%`
                                  : typeof item.sku.results[fk] === "number"
                                    ? item.sku.results[fk].toFixed(2)
                                    : item.sku.results[fk]
                              }}
                              <button
                                v-if="item.sku.traces?.[fk]"
                                @click="openTrace(item.sku, fk)"
                                class="btn btn-ghost btn-xs ml-1 text-base-content/40"
                              >
                                ?
                              </button>
                            </template>
                            <span v-else class="text-base-content/30">—</span>
                          </template>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </template>

                <template v-else-if="skuViewMode === 'card' && createStore.skus.length">
                  <div
                    v-draggable="[pagedSkus, skuDragOpts]"
                    class="gap-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                    data-tour="sku-table"
                  >
                    <div
                      v-for="item in pagedSkus"
                      :key="item.sku.key"
                      class="sku-draggable-row bg-base-200 border border-base-300 flex flex-col gap-1 p-2 rounded text-xs"
                      :data-drag-key="item.sku.key"
                    >
                      <div class="flex gap-1 items-center">
                        <span
                          class="sku-drag-handle cursor-grab select-none text-base-content/30"
                          title="拖动排序"
                        >☰</span>
                        <span class="font-semibold text-xs truncate">{{
                          item.sku.skuCode || "-"
                        }}</span>
                        <button
                          @click="openCalcModal(item.origIdx)"
                          class="btn btn-ghost btn-xs ml-auto"
                          title="反推计算"
                        >
                          🧮
                        </button>
                      </div>
                      <div
                        v-if="createStore.variantAttributes.filter((a) => a.name.trim()).length"
                        class="flex flex-wrap gap-1"
                      >
                        <span
                          v-for="a in createStore.variantAttributes.filter((a) => a.name.trim())"
                          :key="a.name"
                          class="badge badge-xs badge-outline"
                        >
                          {{ a.name.trim() }}: {{ item.sku.attrs[a.name.trim()] }}
                        </span>
                      </div>
                      <template v-if="skuCardExpanded">
                        <div
                          v-for="fk in skuColDisplay"
                          :key="fk"
                          class="border-t border-base-300 pt-0.5"
                        >
                          <template v-if="isSkuInputCol(fk)">
                            <div class="flex gap-1 items-center justify-between">
                              <span class="shrink-0 w-[40%] opacity-60 truncate">{{ fk }}</span>
                              <FieldInput
                                @update:model-value="item.sku.inputs[fk] = $event"
                                :field="getSkuField(fk)"
                                :modelValue="item.sku.inputs[fk]"
                                noLabel
                                :optionConfigs="configStore['选项配置']"
                              />
                            </div>
                          </template>
                          <template v-else-if="fk === '图片'">
                            <div v-if="item.sku.images" class="group h-10 relative w-10">
                              <img
                                @click="openImagePreview(item.sku.images)"
                                class="border cursor-pointer h-10 object-contain bg-base-100 w-10"
                                :src="item.sku.images"
                              >
                              <button
                                @click="clearImage(item.sku)"
                                class="-right-1 -top-1 absolute bg-base-100 btn btn-ghost btn-xs group-hover:opacity-100 h-4 min-h-0 opacity-0 p-0 rounded-full w-4"
                              >
                                ✕
                              </button>
                            </div>
                            <label
                              v-else
                              class="border border-dashed btn btn-ghost btn-xs cursor-pointer h-8 p-0 text-base-content/30 text-lg w-8"
                              title="上传图片"
                            >＋<input
                              @change="handleImageUpload(item.sku, $event)"
                              accept="image/*"
                              class="hidden"
                              type="file"
                            ></label>
                          </template>
                          <template v-else>
                            <div class="flex justify-between">
                              <span class="opacity-60">{{ fk }}</span>
                              <span v-if="item.sku.error" class="text-error">{{
                                item.sku.error
                              }}</span>
                              <span v-else-if="item.sku.results[fk] !== undefined">
                                {{
                                  isPercentCol(fk)
                                    ? `${(item.sku.results[fk] * 100).toFixed(2)}%`
                                    : typeof item.sku.results[fk] === "number"
                                      ? item.sku.results[fk].toFixed(2)
                                      : item.sku.results[fk]
                                }}
                                <button
                                  v-if="item.sku.traces?.[fk]"
                                  @click="openTrace(item.sku, fk)"
                                  class="btn btn-ghost btn-xs ml-1 text-base-content/40"
                                >
                                  ?
                                </button>
                              </span>
                              <span v-else class="text-base-content/30">—</span>
                            </div>
                          </template>
                        </div>
                      </template>
                    </div>
                  </div>
                </template>

                <div v-if="!createStore.skus.length" class="mt-2 text-base-content/40 text-sm">
                  选择模板后自动生成 SKU，或点击「生成SKU」手动刷新
                </div>
                <PaginationBar
                  v-if="createStore.skus.length"
                  v-model:currentPage="skuPage"
                  v-model:pageSize="skuPageSize"
                  class="justify-end mt-2"
                  showJump
                  :totalPages="skuTotalPages"
                />
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- 商品列表 -->
      <div class="bg-base-100 border border-base-300 card card-sm">
        <div class="card-body">
          <div class="flex items-center justify-between" data-tour="records-toolbar">
            <h2 class="card-title text-lg">商品记录（{{ listStore.records.length }} 行）</h2>
            <div class="flex gap-1 items-center text-xs">
              <button
                @click="startTour(recordsHelpSteps)"
                class="btn btn-circle btn-ghost btn-xs"
                title="商品记录帮助"
              >
                ?
              </button>
              <span>表格</span>
              <input
                @change="recordViewMode = $event.target.checked ? 'card' : 'table'"
                :checked="recordViewMode === 'card'"
                class="toggle toggle-sm"
                type="checkbox"
              >
              <span>卡片</span>
              <button
                v-if="recordViewMode === 'card'"
                @click="recordCardExpanded = !recordCardExpanded"
                class="btn btn-ghost btn-xs"
                :title="recordCardExpanded ? '收起' : '展开'"
              >
                {{ recordCardExpanded ? "收起" : "展开" }}
              </button>
              <span
                v-if="listStore.records.length"
                class="mx-1 opacity-40"
              >{{ currentPage }}/{{ totalPages }}</span>
              <button @click="showColModal = true" class="btn btn-ghost btn-xs">⚙️ 编辑列</button>
            </div>
          </div>
          <div v-if="!listStore.records.length" class="text-base-content/40 text-sm">暂无</div>
          <template v-else>
            <div v-if="recordViewMode === 'table'" class="overflow-x-auto">
              <table
                v-draggable="[pagedRecordGroups, recordGroupDragOpts]"
                class="table table-sm product-record-table"
                data-tour="records-table"
              >
                <thead>
                  <tr>
                    <th class="bg-base-100 left-0 sticky w-10 z-10" />
                    <th v-for="col in listColumns" :key="col" class="bg-base-100 sticky top-0 z-10">
                      {{ col }}
                    </th>
                    <th class="record-action-head">操作</th>
                  </tr>
                </thead>
                <tbody
                  v-for="group in pagedRecordGroups"
                  :key="group.key"
                  class="product-record-group"
                  :data-drag-key="group.key"
                >
                  <tr
                    v-for="(row, rowIdx) in group.rows"
                    :key="row._uid"
                    class="product-record-row"
                    :class="recordVisualClass(row)"
                  >
                    <td class="record-drag-cell left-0 sticky z-10">
                      <span
                        v-if="rowIdx === 0"
                        class="record-group-drag-handle flex hover:text-base-content cursor-grab items-center justify-center px-1 py-0.5 select-none text-base-content/30"
                        data-tour="record-group-drag"
                        title="拖动整个商品ID分组"
                      >☰</span>
                    </td>
                    <td v-for="col in listColumns" :key="col" class="whitespace-nowrap">
                      <template v-if="isImage(row[col])">
                        <img
                          @click="openImagePreview(row[col])"
                          class="border cursor-pointer h-10 object-contain bg-base-100 w-10"
                          :src="row[col]"
                        >
                      </template>
                      <template v-else-if="isDispimg(row[col])"> 📷 </template>
                      <template v-else>
                        {{ row[col] }}
                      </template>
                    </td>
                    <td class="record-action-cell">
                      <div class="flex justify-center gap-1" data-tour="record-actions">
                        <button
                          @click="loadRecordBackByRow(row)"
                          class="btn btn-ghost btn-xs"
                          title="读取同商品ID并加载到修改面板"
                        >
                          📋
                        </button>
                        <button
                          @click="removeRecordByRow(row)"
                          class="btn btn-ghost btn-xs text-error"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div
              v-else
              v-draggable="[pagedRecordGroups, recordGroupDragOpts]"
              class="gap-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            >
              <div
                v-for="group in pagedRecordGroups"
                :key="group.key"
                class="product-record-group product-record-card border border-base-300 flex flex-col gap-1 p-2 rounded text-xs"
                :class="recordVisualClass(group.rows[0])"
                :data-drag-key="group.key"
              >
                <div class="flex gap-2 items-center border-b border-base-300 pb-1">
                  <span
                    class="record-group-drag-handle cursor-grab select-none text-base-content/30"
                    data-tour="record-group-drag"
                    title="拖动整个商品ID分组"
                  >☰</span>
                  <span class="font-semibold truncate">{{
                    group.rows[0]?.["商品ID"] || group.rows[0]?.["商品名称"] || "-"
                  }}</span>
                  <span class="badge badge-xs badge-outline ml-auto">{{ group.rows.length }} SKU</span>
                </div>
                <div
                  v-for="row in group.rows"
                  :key="row._uid"
                  class="border-b border-base-300/60 flex flex-col gap-1 pb-1 last:border-b-0"
                >
                  <div class="flex gap-2 items-start">
                    <div class="min-w-0 flex-1">
                      <div v-if="row['商品名称']" class="text-base-content/60 truncate">
                        {{ row["商品名称"] }}
                      </div>
                      <div v-if="row['SKU码']" class="badge badge-xs badge-outline">
                        {{ row["SKU码"] }}
                      </div>
                    </div>
                    <img
                      v-if="isImage(row['图片'])"
                      @click="openImagePreview(row['图片'])"
                      class="border cursor-pointer h-14 object-contain bg-base-100 w-14"
                      :src="row['图片']"
                    >
                    <div
                      v-else-if="isDispimg(row['图片'])"
                      class="border flex h-14 items-center justify-center text-base-content/40 w-14"
                    >
                      📷
                    </div>
                  </div>
                  <template v-if="recordCardExpanded">
                    <div
                      v-for="col in listColumns"
                      :key="col"
                      class="border-t border-base-300 flex justify-between pt-0.5"
                    >
                      <span class="opacity-60 truncate mr-1">{{ col }}</span>
                      <span class="text-right truncate">
                        <template v-if="isImage(row[col])">📷</template>
                        <template v-else-if="isDispimg(row[col])">📷</template>
                        <template v-else>{{ row[col] || "—" }}</template>
                      </span>
                    </div>
                  </template>
                  <div class="flex gap-1 mt-1" data-tour="record-actions">
                    <button
                      @click="loadRecordBackByRow(row)"
                      class="btn btn-ghost btn-xs flex-1"
                      title="读取同商品ID并加载到修改面板"
                    >
                      📋
                    </button>
                    <button @click="removeRecordByRow(row)" class="btn btn-ghost btn-xs text-error">
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <PaginationBar
              v-if="listStore.records.length"
              v-model:currentPage="currentPage"
              v-model:pageSize="pageSize"
              class="justify-end mt-2"
              showJump
              :totalPages="totalPages"
            />
          </template>
        </div>
      </div>
    </div>

    <ReverseCalcModal
      @close="showCalcModal = false"
      :open="showCalcModal"
      :skuIndex="calcSkuIndex"
    />
    <TraceModal
      @close="showTraceModal = false"
      :fieldKey="traceFieldKey"
      :open="showTraceModal"
      :skuKey="traceSkuKey"
    />
    <ColEditorModal
      @close="showColModal = false"
      @update="listStore.columnOrder = $event"
      @update-hidden="listStore.hiddenColumns = $event"
      :hiddenKeys="listStore.hiddenColumns"
      :items="listStore.columnOrder"
      :open="showColModal"
      title="编辑列顺序"
    />
    <ColEditorModal
      @close="skuColModal = false"
      @update="skuColOrder = $event"
      @update-hidden="skuHiddenKeys = $event"
      :hiddenKeys="skuHiddenKeys"
      :items="skuColOrder"
      :open="skuColModal"
      title="SKU 列顺序"
    />
  </div>
</template>
