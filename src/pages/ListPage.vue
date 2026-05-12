<script setup>
import { previewImages } from 'hevue-img-preview/v3'
import { computed, nextTick, ref, watch } from 'vue'
import ColEditorModal from '@/components/common/ColEditorModal.vue'
import FieldInput from '@/components/common/FieldInput.vue'
import ReverseCalcModal from '@/components/list/ReverseCalcModal.vue'
import TraceModal from '@/components/list/TraceModal.vue'
import { useFileIO } from '@/composables/useFileIO'
import { useSortable } from '@/composables/useSortable'
import { useConfigStore } from '@/stores/config'
import { useCreateStore } from '@/stores/create'
import { useListStore } from '@/stores/list'

const configStore = useConfigStore()
const createStore = useCreateStore()
const listStore = useListStore()
const { openListExcel, saveListExcel } = useFileIO()

const showCreatePanel = ref(true)

watch(
  () => createStore.selectedTemplateId,
  (id) => {
    if (id)
      createStore.generateSkus()
  },
)

const enabledCountries = computed(() => configStore['国家平台'].filter(c => c.启用 === '是'))
const availableTemplates = computed(() =>
  createStore.selectedCountryId
    ? configStore.getTemplatesByCountry(createStore.selectedCountryId)
    : [],
)

function handleCountryChange(e) {
  createStore.selectCountry(e.target.value)
}
function handleTemplateChange(e) {
  createStore.selectTemplate(e.target.value)
}
function handleCalculate() {
  createStore.calculateAll()
}
function handleSaveToList() {
  if (!createStore.lastCalculatedAt)
    createStore.calculateAll()
  const rows = createStore.productRows()
  if (rows.length)
    listStore.addRecords(rows)
}

function batchSetSkuInput(fieldKey) {
  const val = createStore.skus[0]?.inputs[fieldKey]
  if (val === undefined || val === '')
    return
  for (const sku of createStore.skus) sku.inputs[fieldKey] = val
}

// ── Modal state ──
const showCalcModal = ref(false)
const calcSkuIndex = ref(-1)
const showTraceModal = ref(false)
const traceSkuKey = ref('')
const traceFieldKey = ref('')
const showColModal = ref(false)
const skuColModal = ref(false)
const skuColOrder = ref([])
const skuTableBodyRef = ref(null)
const recordsTableBodyRef = ref(null)

const skuAllFields = computed(() => {
  const fields = []
  for (const f of createStore.skuInputFields) fields.push(f.字段键)
  fields.push('图片')
  for (const f of createStore.skuOutputFields) fields.push(f.字段键)
  return fields
})

const skuColDisplay = computed(() => {
  const all = skuAllFields.value
  return skuColOrder.value.length && skuColOrder.value.length === all.length
    ? skuColOrder.value
    : all
})

watch(skuAllFields, (v) => {
  if (!skuColOrder.value.length || skuColOrder.value.length !== v.length) {
    skuColOrder.value = [...v]
  }
}, { immediate: true })

useSortable(skuTableBodyRef, createStore.skus, { handle: '.drag-handle', animation: 200 })
useSortable(recordsTableBodyRef, listStore.records, { handle: '.drag-handle', animation: 200 })

const listColumns = computed(() => {
  if (!listStore.records.length)
    return []
  return listStore.columnOrder.filter(k => k !== '_uid')
})

watch(() => listStore.records.length, () => {
  if (listStore.records.length)
    listStore.syncColumnOrder()
})

function openCalcModal(si) {
  calcSkuIndex.value = si
  showCalcModal.value = true
}

function openTrace(sku, fieldKey) {
  traceSkuKey.value = sku.key
  traceFieldKey.value = fieldKey
  showTraceModal.value = true
}

function openImagePreview(src) {
  previewImages({
    imgList: [src],
    nowImgIndex: 0,
    clickMaskCLose: true,
    keyboard: true,
    disableTransition: true,
  })
}

function handleImageUpload(sku, event) {
  const file = event.target.files[0]
  if (!file)
    return
  const reader = new FileReader()
  reader.onload = () => {
    sku.images = reader.result
  }
  reader.readAsDataURL(file)
}
function clearImage(sku) {
  sku.images = ''
}

function isImage(val) {
  if (typeof val === 'string' && val.startsWith('data:image/'))
    return true
  if (typeof val === 'string' && (val.startsWith('asset://') || val.includes('/images/')))
    return true
  return false
}

function isDispimg(val) {
  return typeof val === 'string' && val.startsWith('=DISPIMG(')
}
function isSkuInputCol(fk) {
  return createStore.skuInputFields.some(f => f.字段键 === fk)
}
function isPercentCol(fk) {
  return createStore.skuOutputFields.some(f => f.字段键 === fk && f.单位 === '%')
}

async function loadRecordBack(idx) {
  const row = listStore.records[idx]
  if (!row['国家平台编号'] || !row['模板编号'])
    return
  createStore.selectCountry(row['国家平台编号'])
  createStore.selectTemplate(row['模板编号'])
  await nextTick()
  createStore.productId = row['商品ID'] || ''
  createStore.productName = row['商品名称'] || ''
  for (const f of createStore.productFields) {
    if (row[f.字段键] !== undefined)
      createStore.productInputs[f.字段键] = row[f.字段键]
  }
  createStore.generateSkus()
  if (createStore.skus.length) {
    const sku = createStore.skus[0]
    sku.skuCode = row['SKU码'] || ''
    for (const f of createStore.skuInputFields) {
      if (row[f.字段键] !== undefined)
        sku.inputs[f.字段键] = row[f.字段键]
    }
    sku.images = row['图片'] || ''
  }
  showCreatePanel.value = true
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">
        商品列表
      </h1>
      <div class="flex gap-2">
        <button class="btn btn-outline btn-sm" @click="openListExcel">
          打开列表
        </button>
        <button class="btn btn-outline btn-sm" @click="saveListExcel">
          保存列表
        </button>
        <button class="btn btn-primary btn-sm" @click="showCreatePanel = !showCreatePanel">
          {{ showCreatePanel ? "收起 ▲" : "＋ 新建" }}
        </button>
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto space-y-4">
      <!-- 新建面板 -->
      <div v-if="showCreatePanel" class="card card-sm bg-base-100 border border-base-300">
        <div class="card-body">
          <h2 class="card-title text-lg">
            新建商品
          </h2>
          <div class="flex gap-4 flex-wrap items-end">
            <div class="form-control">
              <label class="label py-1"><span class="label-text">国家平台</span></label>
              <select
                class="select select-bordered"
                :value="createStore.selectedCountryId"
                @change="handleCountryChange"
              >
                <option value="">
                  -- 选择 --
                </option>
                <option v-for="c in enabledCountries" :key="c.编号" :value="c.编号">
                  {{ c.国家 }} - {{ c.平台 }}
                </option>
              </select>
            </div>
            <div v-if="createStore.selectedCountryId" class="form-control">
              <label class="label py-1"><span class="label-text">模板</span></label>
              <select
                class="select select-bordered"
                :value="createStore.selectedTemplateId"
                @change="handleTemplateChange"
              >
                <option value="">
                  -- 选择 --
                </option>
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
              <div class="w-60 flex-shrink-0 space-y-2">
                <div class="font-semibold text-sm">
                  商品级字段
                </div>
                <FieldInput
                  v-for="f in createStore.productFields"
                  :key="f.字段键"
                  :field="f"
                  :model-value="createStore.productInputs[f.字段键]"
                  :option-items="configStore['选项值']"
                  @update:model-value="createStore.productInputs[f.字段键] = $event"
                />
                <div class="flex items-center gap-2 pt-3">
                  <span class="text-xs">SKU前缀</span>
                  <input
                    v-model="createStore.skuPrefix"
                    class="input input-bordered input-xs w-20"
                    placeholder="如: RS"
                  >
                </div>
                <div class="font-semibold text-sm pt-2">
                  变体属性
                </div>
                <div v-for="(attr, i) in createStore.variantAttributes" :key="i" class="flex gap-1">
                  <input
                    :value="attr.name"
                    class="input input-bordered input-sm w-16"
                    placeholder="颜色"
                    @input="createStore.updateVariantAttribute(i, { name: $event.target.value })"
                  >
                  <input
                    :value="attr.values"
                    class="input input-bordered input-sm flex-1"
                    placeholder="红,蓝"
                    @input="createStore.updateVariantAttribute(i, { values: $event.target.value })"
                  >
                  <button
                    class="btn btn-ghost btn-xs text-error"
                    @click="createStore.removeVariantAttribute(i)"
                  >
                    ✕
                  </button>
                </div>
                <button class="btn btn-ghost btn-xs" @click="createStore.addVariantAttribute">
                  ＋ 变体属性
                </button>
                <div class="flex gap-2 pt-3">
                  <button class="btn btn-sm" @click="createStore.generateSkus()">
                    生成SKU
                  </button>
                  <button
                    class="btn btn-primary btn-sm"
                    :disabled="createStore.calculating"
                    @click="handleCalculate"
                  >
                    计算
                  </button>
                  <button class="btn btn-success btn-sm" @click="handleSaveToList">
                    保存到列表
                  </button>
                </div>
              </div>

              <div class="flex-1 min-w-0 overflow-x-auto">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-sm font-semibold">SKU 列表</span>
                  <button class="btn btn-ghost btn-xs" @click="skuColModal = true">
                    ⚙️ 编辑列
                  </button>
                </div>
                <table v-if="createStore.skus.length" class="table table-xs">
                  <thead>
                    <tr>
                      <th class="w-10 sticky left-0 bg-base-100 z-10" />
                      <th>SKU码</th>
                      <th class="w-8" />
                      <th
                        v-for="a in createStore.variantAttributes.filter((a) => a.name.trim())"
                        :key="a.name"
                      >
                        {{ a.name.trim() }}
                      </th>
                      <th v-for="fk in skuColDisplay" :key="fk">
                        <div class="flex items-center gap-0">
                          <span class="text-xs">{{ fk }}</span>
                          <button
                            v-if="isSkuInputCol(fk)"
                            class="btn btn-ghost btn-xs px-0 opacity-30 hover:opacity-100"
                            title="统一"
                            @click="batchSetSkuInput(fk)"
                          >
                            ⇅
                          </button>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody ref="skuTableBodyRef">
                    <tr v-for="(sku, si) in createStore.skus" :key="sku.key" class="sortable-item">
                      <td class="sticky left-0 bg-base-100 z-10">
                        <span
                          class="drag-handle cursor-grab text-base-content/30 hover:text-base-content flex items-center justify-center select-none px-1 py-0.5"
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
                          class="btn btn-ghost btn-xs"
                          title="反推计算"
                          @click="openCalcModal(si)"
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
                            type="number"
                            step="any"
                          >
                        </template>
                        <template v-else-if="fk === '图片'">
                          <div v-if="sku.images" class="relative group w-10 h-10">
                            <img
                              :src="sku.images"
                              class="w-10 h-10 object-cover rounded cursor-pointer border"
                              @click="openImagePreview(sku.images)"
                            >
                            <button
                              class="absolute -top-1 -right-1 btn btn-ghost btn-xs p-0 w-4 h-4 min-h-0 rounded-full bg-base-100 opacity-0 group-hover:opacity-100"
                              @click="clearImage(sku)"
                            >
                              ✕
                            </button>
                          </div>
                          <label
                            v-else
                            class="btn btn-ghost btn-xs w-10 h-10 p-0 border-dashed border text-base-content/30 text-lg cursor-pointer"
                            title="上传图片"
                          >＋<input
                            type="file"
                            accept="image/*"
                            class="hidden"
                            @change="handleImageUpload(sku, $event)"
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
                              class="btn btn-ghost btn-xs text-base-content/40 ml-1"
                              @click="openTrace(sku, fk)"
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
                <div v-else class="text-sm text-base-content/40 mt-2">
                  选择模板后自动生成 SKU，或点击「生成SKU」手动刷新
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- 商品列表 -->
      <div class="card card-sm bg-base-100 border border-base-300">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <h2 class="card-title text-lg">
              商品记录（{{ listStore.records.length }} 行）
            </h2>
            <button class="btn btn-ghost btn-xs" @click="showColModal = true">
              ⚙️ 编辑列
            </button>
          </div>
          <div v-if="!listStore.records.length" class="text-sm text-base-content/40">
            暂无
          </div>
          <div v-else class="overflow-x-auto max-h-[70vh] overflow-y-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th class="w-10 sticky left-0 bg-base-100 z-10" />
                  <th v-for="col in listColumns" :key="col" class="sticky top-0 bg-base-100 z-10">
                    {{ col }}
                  </th>
                  <th class="sticky right-0 bg-base-100 z-10 w-24">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody ref="recordsTableBodyRef">
                <tr v-for="(row, idx) in listStore.records" :key="row._uid" class="sortable-item">
                  <td class="sticky left-0 bg-base-100 z-10">
                    <span
                      class="drag-handle cursor-grab text-base-content/30 hover:text-base-content flex items-center justify-center select-none px-1 py-0.5"
                      title="拖拽排序"
                    >☰</span>
                  </td>
                  <td v-for="col in listColumns" :key="col" class="whitespace-nowrap">
                    <template v-if="isImage(row[col])">
                      <img
                        :src="row[col]"
                        class="w-10 h-10 object-cover rounded cursor-pointer border"
                        @click="openImagePreview(row[col])"
                      >
                    </template>
                    <template v-else-if="isDispimg(row[col])">
                      📷
                    </template>
                    <template v-else>
                      {{ row[col] }}
                    </template>
                  </td>
                  <td class="sticky right-0 bg-base-100 z-10">
                    <div class="flex gap-1">
                      <button
                        class="btn btn-ghost btn-xs"
                        title="加载到新建面板"
                        @click="loadRecordBack(idx)"
                      >
                        📋
                      </button>
                      <button
                        class="btn btn-ghost btn-xs text-error"
                        @click="listStore.removeRecord(idx)"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <ReverseCalcModal
      :open="showCalcModal"
      :sku-index="calcSkuIndex"
      @close="showCalcModal = false"
    />
    <TraceModal
      :open="showTraceModal"
      :sku-key="traceSkuKey"
      :field-key="traceFieldKey"
      @close="showTraceModal = false"
    />
    <ColEditorModal
      :open="showColModal"
      title="编辑列顺序"
      :items="listStore.columnOrder"
      @update="listStore.columnOrder = $event"
      @close="showColModal = false"
    />
    <ColEditorModal
      :open="skuColModal"
      title="SKU 列顺序"
      :items="skuColOrder"
      @update="skuColOrder = $event"
      @close="skuColModal = false"
    />
  </div>
</template>
