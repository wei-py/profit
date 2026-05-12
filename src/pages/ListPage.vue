<script setup>
import { previewImages } from "hevue-img-preview/v3";
import { computed, nextTick, ref, watch } from "vue";
import ColEditorModal from "@/components/common/ColEditorModal.vue";
import FieldInput from "@/components/common/FieldInput.vue";
import ReverseCalcModal from "@/components/list/ReverseCalcModal.vue";
import TraceModal from "@/components/list/TraceModal.vue";
import { useFileIO } from "@/composables/useFileIO";
import { useSortable } from "@/composables/useSortable";
import { useConfigStore } from "@/stores/config";
import { useCreateStore } from "@/stores/create";
import { useListStore } from "@/stores/list";
import { FONT_TABLE_XS, LINE_HEIGHT_TABLE_XS, measureTextHeight } from "@/utils/textMeasure";

const configStore = useConfigStore();
const createStore = useCreateStore();
const listStore = useListStore();
const { openListExcel, saveListExcel } = useFileIO();

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
    ? configStore.getTemplatesByCountry(createStore.selectedCountryId)
    : [],
);

function handleCountryChange(e) {
  createStore.selectCountry(e.target.value);
}
function handleTemplateChange(e) {
  createStore.selectTemplate(e.target.value);
}
function handleCalculate() {
  createStore.calculateAll();
}
function handleSaveToList() {
  if (!createStore.lastCalculatedAt)
    createStore.calculateAll();
  const rows = createStore.productRows();
  if (rows.length)
    listStore.addRecords(rows);
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
const skuTableBodyRef = ref(null);
const recordsTableBodyRef = ref(null);

const skuAllFields = computed(() => {
  const fields = [];
  for (const f of createStore.skuInputFields) fields.push(f.字段键);
  fields.push("图片");
  for (const f of createStore.skuOutputFields) fields.push(f.字段键);
  return fields;
});

const skuColDisplay = computed(() => {
  const all = skuAllFields.value;
  return skuColOrder.value.length && skuColOrder.value.length === all.length
    ? skuColOrder.value
    : all;
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

useSortable(skuTableBodyRef, createStore.skus, {
  animation: 200,
  handle: ".drag-handle",
});
const currentPage = ref(1);
const pageSize = ref(20);

const pageOffset = computed(() => (currentPage.value - 1) * pageSize.value);
useSortable(recordsTableBodyRef, listStore.records, {
  animation: 200,
  handle: ".drag-handle",
  onSplice: (oldVisualIdx, newVisualIdx) => {
    const offset = pageOffset.value;
    const [moved] = listStore.records.splice(offset + oldVisualIdx, 1);
    listStore.records.splice(offset + newVisualIdx, 0, moved);
  },
});

const totalPages = computed(() => Math.ceil(listStore.records.length / pageSize.value) || 1);
const pagedRecords = computed(() => {
  const start = pageOffset.value;
  return listStore.records.slice(start, start + pageSize.value);
});

watch(pageSize, () => {
  if (currentPage.value > totalPages.value)
    currentPage.value = totalPages.value;
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
  return listStore.columnOrder.filter(k => k !== "_uid");
});

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
  if (!row["国家平台编号"] || !row["模板编号"])
    return;
  createStore.selectCountry(row["国家平台编号"]);
  createStore.selectTemplate(row["模板编号"]);
  await nextTick();
  createStore.productId = row["商品ID"] || "";
  createStore.productName = row["商品名称"] || "";
  for (const f of createStore.productFields) {
    if (row[f.字段键] !== undefined)
      createStore.productInputs[f.字段键] = row[f.字段键];
  }
  createStore.generateSkus();
  if (createStore.skus.length) {
    const sku = createStore.skus[0];
    sku.skuCode = row["SKU码"] || "";
    for (const f of createStore.skuInputFields) {
      if (row[f.字段键] !== undefined)
        sku.inputs[f.字段键] = row[f.字段键];
    }
    sku.images = row["图片"] || "";
  }
  showCreatePanel.value = true;
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="flex items-center justify-between mb-4">
      <h1 class="font-bold text-2xl">商品列表</h1>
      <div class="flex gap-2">
        <button @click="openListExcel" class="btn btn-outline btn-sm">打开列表</button>
        <button @click="saveListExcel" class="btn btn-outline btn-sm">保存列表</button>
        <button @click="showCreatePanel = !showCreatePanel" class="btn btn-primary btn-sm">
          {{ showCreatePanel ? "收起 ▲" : "＋ 新建" }}
        </button>
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto space-y-4">
      <!-- 新建面板 -->
      <div v-if="showCreatePanel" class="bg-base-100 border border-base-300 card card-sm">
        <div class="card-body">
          <h2 class="card-title text-lg">新建商品</h2>
          <div class="flex flex-wrap gap-4 items-end">
            <div class="form-control">
              <label class="label py-1"><span class="label-text">国家平台</span></label>
              <select
                @change="handleCountryChange"
                class="select select-bordered"
                :value="createStore.selectedCountryId"
              >
                <option value="">-- 选择 --</option>
                <option v-for="c in enabledCountries" :key="c.编号" :value="c.编号">
                  {{ c.国家 }} - {{ c.平台 }}
                </option>
              </select>
            </div>
            <div v-if="createStore.selectedCountryId" class="form-control">
              <label class="label py-1"><span class="label-text">模板</span></label>
              <select
                @change="handleTemplateChange"
                class="select select-bordered"
                :value="createStore.selectedTemplateId"
              >
                <option value="">-- 选择 --</option>
                <option v-for="t in availableTemplates" :key="t.编号" :value="t.编号">
                  {{ t.名称 }}
                </option>
              </select>
            </div>
            <div class="form-control">
              <label class="label py-1"><span class="label-text">商品ID</span></label>
              <input
                v-model="createStore.productId"
                class="input input-bordered w-28"
                placeholder="P001"
              >
            </div>
            <div class="form-control">
              <label class="label py-1"><span class="label-text">商品名称</span></label>
              <input
                v-model="createStore.productName"
                class="input input-bordered w-32"
                placeholder="如：T恤"
              >
            </div>
          </div>

          <template v-if="createStore.selectedTemplateId">
            <div class="flex gap-4 mt-4">
              <div class="flex-shrink-0 space-y-2 w-60">
                <div class="font-semibold text-sm">商品级字段</div>
                <FieldInput
                  @update:model-value="createStore.productInputs[f.字段键] = $event"
                  v-for="f in createStore.productFields"
                  :key="f.字段键"
                  :field="f"
                  :modelValue="createStore.productInputs[f.字段键]"
                  :optionItems="configStore['选项值']"
                />
                <div class="flex gap-2 items-center pt-3">
                  <span class="text-xs">SKU前缀</span>
                  <input
                    v-model="createStore.skuPrefix"
                    class="input input-bordered input-xs w-20"
                    placeholder="如: RS"
                  >
                </div>
                <div class="font-semibold pt-2 text-sm">变体属性</div>
                <div v-for="(attr, i) in createStore.variantAttributes" :key="i" class="flex gap-1">
                  <input
                    @input="
                      createStore.updateVariantAttribute(i, {
                        name: $event.target.value,
                      })
                    "
                    class="input input-bordered input-sm w-16"
                    placeholder="颜色"
                    :value="attr.name"
                  >
                  <input
                    @input="
                      createStore.updateVariantAttribute(i, {
                        values: $event.target.value,
                      })
                    "
                    class="flex-1 input input-bordered input-sm"
                    placeholder="红,蓝"
                    :value="attr.values"
                  >
                  <button
                    @click="createStore.removeVariantAttribute(i)"
                    class="btn btn-ghost btn-xs text-error"
                  >
                    ✕
                  </button>
                </div>
                <button @click="createStore.addVariantAttribute" class="btn btn-ghost btn-xs">
                  ＋ 变体属性
                </button>
                <div class="flex gap-2 pt-3">
                  <button @click="createStore.generateSkus()" class="btn btn-sm">生成SKU</button>
                  <button
                    @click="handleCalculate"
                    class="btn btn-primary btn-sm"
                    :disabled="createStore.calculating"
                  >
                    计算
                  </button>
                  <button @click="handleSaveToList" class="btn btn-sm btn-success">
                    保存到列表
                  </button>
                </div>
              </div>

              <div class="flex-1 min-w-0 overflow-x-auto">
                <div class="flex items-center justify-between mb-1">
                  <span class="font-semibold text-sm">SKU 列表</span>
                  <button @click="skuColModal = true" class="btn btn-ghost btn-xs">
                    ⚙️ 编辑列
                  </button>
                </div>
                <table v-if="createStore.skus.length" class="table table-xs">
                  <thead>
                    <tr>
                      <th class="bg-base-100 left-0 sticky w-10 z-10" />
                      <th>SKU码</th>
                      <th class="w-8" />
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
                  <tbody ref="skuTableBodyRef">
                    <tr
                      v-for="(sku, si) in createStore.skus"
                      :key="sku.key"
                      class="sortable-item"
                      :style="{ height: `${skuRowHeights[si]}px` }"
                    >
                      <td class="bg-base-100 left-0 sticky z-10">
                        <span
                          class="cursor-grab drag-handle flex hover:text-base-content items-center justify-center px-1 py-0.5 select-none text-base-content/30"
                          title="拖拽排序"
                        >☰</span>
                      </td>
                      <td>
                        <input
                          v-model="sku.skuCode"
                          class="input input-bordered input-xs w-20"
                          placeholder="SKU"
                        >
                      </td>
                      <td>
                        <button
                          @click="openCalcModal(si)"
                          class="btn btn-ghost btn-xs"
                          title="反推计算"
                        >
                          🧮
                        </button>
                      </td>
                      <td
                        v-for="a in createStore.variantAttributes.filter((a) => a.name.trim())"
                        :key="a.name"
                        class="text-xs"
                      >
                        {{ sku.attrs[a.name.trim()] }}
                      </td>
                      <td v-for="fk in skuColDisplay" :key="fk">
                        <template v-if="isSkuInputCol(fk)">
                          <input
                            v-model="sku.inputs[fk]"
                            class="input input-bordered input-xs w-20"
                            step="any"
                            type="number"
                          >
                        </template>
                        <template v-else-if="fk === '图片'">
                          <div v-if="sku.images" class="group h-10 relative w-10">
                            <img
                              @click="openImagePreview(sku.images)"
                              class="border cursor-pointer h-10 object-cover rounded w-10"
                              :src="sku.images"
                            >
                            <button
                              @click="clearImage(sku)"
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
                            @change="handleImageUpload(sku, $event)"
                            accept="image/*"
                            class="hidden"
                            type="file"
                          ></label>
                        </template>
                        <template v-else>
                          <span v-if="sku.error" class="text-error text-xs">{{ sku.error }}</span>
                          <template v-else-if="sku.results[fk] !== undefined">
                            {{
                              isPercentCol(fk)
                                ? `${(sku.results[fk] * 100).toFixed(2)}%`
                                : typeof sku.results[fk] === "number"
                                  ? sku.results[fk].toFixed(2)
                                  : sku.results[fk]
                            }}
                            <button
                              v-if="sku.traces?.[fk]"
                              @click="openTrace(sku, fk)"
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
                <div v-else class="mt-2 text-base-content/40 text-sm">
                  选择模板后自动生成 SKU，或点击「生成SKU」手动刷新
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- 商品列表 -->
      <div class="bg-base-100 border border-base-300 card card-sm">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <h2 class="card-title text-lg">商品记录（{{ listStore.records.length }} 行）</h2>
            <div class="flex gap-2 items-center">
              <input
                v-model.number="pageSize"
                class="input input-bordered input-xs w-16"
                max="100"
                min="1"
              >
              <span class="text-xs">条/页</span>
              <button @click="showColModal = true" class="btn btn-ghost btn-xs">⚙️ 编辑列</button>
            </div>
          </div>
          <div v-if="!listStore.records.length" class="text-base-content/40 text-sm">暂无</div>
          <template v-else>
            <div class="overflow-x-auto">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th class="bg-base-100 left-0 sticky w-10 z-10" />
                    <th v-for="col in listColumns" :key="col" class="bg-base-100 sticky top-0 z-10">
                      {{ col }}
                    </th>
                    <th class="bg-base-100 right-0 sticky w-24 z-10">操作</th>
                  </tr>
                </thead>
                <tbody ref="recordsTableBodyRef">
                  <tr v-for="(row, pIdx) in pagedRecords" :key="row._uid" class="sortable-item">
                    <td class="bg-base-100 left-0 sticky z-10">
                      <span
                        class="cursor-grab drag-handle flex hover:text-base-content items-center justify-center px-1 py-0.5 select-none text-base-content/30"
                        title="拖拽排序"
                      >☰</span>
                    </td>
                    <td v-for="col in listColumns" :key="col" class="whitespace-nowrap">
                      <template v-if="isImage(row[col])">
                        <img
                          @click="openImagePreview(row[col])"
                          class="border cursor-pointer h-10 object-cover rounded w-10"
                          :src="row[col]"
                        >
                      </template>
                      <template v-else-if="isDispimg(row[col])"> 📷 </template>
                      <template v-else>
                        {{ row[col] }}
                      </template>
                    </td>
                    <td class="bg-base-100 right-0 sticky z-10">
                      <div class="flex gap-1">
                        <button
                          @click="loadRecordBack(pageOffset + pIdx)"
                          class="btn btn-ghost btn-xs"
                          title="加载到新建面板"
                        >
                          📋
                        </button>
                        <button
                          @click="listStore.removeRecord(pageOffset + pIdx)"
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
            <div class="flex gap-2 items-center justify-center mt-2">
              <button
                @click="currentPage--"
                class="btn btn-ghost btn-xs"
                :disabled="currentPage <= 1"
              >
                上一页
              </button>
              <span class="text-xs">{{ currentPage }} / {{ totalPages }}</span>
              <button
                @click="currentPage++"
                class="btn btn-ghost btn-xs"
                :disabled="currentPage >= totalPages"
              >
                下一页
              </button>
            </div>
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
      :items="listStore.columnOrder"
      :open="showColModal"
      title="编辑列顺序"
    />
    <ColEditorModal
      @close="skuColModal = false"
      @update="skuColOrder = $event"
      :items="skuColOrder"
      :open="skuColModal"
      title="SKU 列顺序"
    />
  </div>
</template>
