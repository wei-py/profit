<script setup>
import { computed, ref, watch } from 'vue'
import FieldInput from '@/components/common/FieldInput.vue'
import { useFileIO } from '@/composables/useFileIO'
import { useConfigStore } from '@/stores/config'
import { useCreateStore } from '@/stores/create'
import { useListStore } from '@/stores/list'

const configStore = useConfigStore()
const createStore = useCreateStore()
const listStore = useListStore()
const { openListExcel, saveListExcel } = useFileIO()

const showCreatePanel = ref(true)

// 选模板后自动生成 SKU
watch(() => createStore.selectedTemplateId, (id) => { if (id) createStore.generateSkus() })

// ── 国家/模板 ──
const enabledCountries = computed(() => configStore['国家平台'].filter(c => c.启用 === '是'))
const availableTemplates = computed(() =>
  createStore.selectedCountryId ? configStore.getTemplatesByCountry(createStore.selectedCountryId) : [],
)

function handleCountryChange(e) { createStore.selectCountry(e.target.value) }
function handleTemplateChange(e) { createStore.selectTemplate(e.target.value) }

function handleCalculate() { createStore.calculateAll() }
function handleSaveToList() {
  if (!createStore.lastCalculatedAt) createStore.calculateAll()
  const rows = createStore.productRows()
  if (rows.length) listStore.addRecords(rows)
}

function moveUp(arr, i) { if (i > 0) { const tmp = arr[i]; arr[i] = arr[i - 1]; arr[i - 1] = tmp } }
function moveDown(arr, i) { if (i < arr.length - 1) { const tmp = arr[i]; arr[i] = arr[i + 1]; arr[i + 1] = tmp } }

function batchSetSkuInput(fieldKey) {
  const val = createStore.skus[0]?.inputs[fieldKey]
  if (val === undefined || val === '') return
  for (const sku of createStore.skus) sku.inputs[fieldKey] = val
}

// ── 计算过程弹窗 ──
const showTraceModal = ref(false)
const traceField = ref('')
const traceSkuKey = ref('')

function openTrace(sku, fieldKey) {
  traceSkuKey.value = sku.key
  traceField.value = fieldKey
  showTraceModal.value = true
}

// ── 图片上传/预览 ──
const previewImage = ref('')
const showImageModal = ref(false)
const imageZoom = ref(1)

function handleImageUpload(sku, event) {
  const file = event.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => { sku.images = reader.result }
  reader.readAsDataURL(file)
}
function openImagePreview(src) { previewImage.value = src; imageZoom.value = 1; showImageModal.value = true }
function clearImage(sku) { sku.images = '' }

function isImage(val) { return typeof val === 'string' && val.startsWith('data:image/') }

// ── 加载已有商品回新建面板 ──
function loadRecordBack(idx) {
  const row = listStore.records[idx]
  if (!row['国家平台编号'] || !row['模板编号']) return
  createStore.selectCountry(row['国家平台编号'])
  createStore.selectTemplate(row['模板编号'])
  // setTimeout to let template load first, then fill values
  setTimeout(() => {
    createStore.productId = row['商品ID'] || ''
    createStore.productName = row['商品名称'] || ''
    // 商品级字段
    for (const f of createStore.productFields) {
      if (row[f.字段键] !== undefined) createStore.productInputs[f.字段键] = row[f.字段键]
    }
    // 变体属性 - 从列名推断
    const knownKeys = new Set(['商品ID','商品名称','国家平台编号','模板编号','SKU码','图片','计算时间'])
    for (const k of Object.keys(row)) {
      if (!knownKeys.has(k) && createStore.skuInputFields.every(f => f.字段键 !== k) && createStore.skuOutputFields.every(f => f.字段键 !== k)) {
        // could be a variant attribute
      }
    }
    createStore.generateSkus()
    // 填 SKU 数据
    if (createStore.skus.length) {
      const sku = createStore.skus[0]
      sku.skuCode = row['SKU码'] || ''
      for (const f of createStore.skuInputFields) {
        if (row[f.字段键] !== undefined) sku.inputs[f.字段键] = row[f.字段键]
      }
      sku.images = row['图片'] || ''
    }
    showCreatePanel.value = true
  }, 50)
}

const listColumns = computed(() => {
  if (!listStore.records.length) return []
  const keys = new Set()
  for (const row of listStore.records) for (const k of Object.keys(row)) keys.add(k)
  return [...keys]
})
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">商品列表</h1>
      <div class="flex gap-2">
        <button class="btn btn-outline btn-sm" @click="openListExcel">打开列表</button>
        <button class="btn btn-outline btn-sm" @click="saveListExcel">保存列表</button>
        <button class="btn btn-primary btn-sm" @click="showCreatePanel = !showCreatePanel">
          {{ showCreatePanel ? '收起 ▲' : '＋ 新建' }}
        </button>
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto space-y-4">
      <!-- 新建面板 -->
      <div v-if="showCreatePanel" class="card card-sm bg-base-100 border border-base-300">
        <div class="card-body">
          <h2 class="card-title text-lg">新建商品</h2>

          <div class="flex gap-4 flex-wrap items-end">
            <div class="form-control">
              <label class="label py-1"><span class="label-text">国家平台</span></label>
              <select class="select select-bordered" :value="createStore.selectedCountryId" @change="handleCountryChange">
                <option value="">-- 选择 --</option>
                <option v-for="c in enabledCountries" :key="c.编号" :value="c.编号">{{ c.国家 }} - {{ c.平台 }}</option>
              </select>
            </div>
            <div class="form-control" v-if="createStore.selectedCountryId">
              <label class="label py-1"><span class="label-text">模板</span></label>
              <select class="select select-bordered" :value="createStore.selectedTemplateId" @change="handleTemplateChange">
                <option value="">-- 选择 --</option>
                <option v-for="t in availableTemplates" :key="t.编号" :value="t.编号">{{ t.名称 }}</option>
              </select>
            </div>
            <div class="form-control">
              <label class="label py-1"><span class="label-text">商品ID</span></label>
              <input v-model="createStore.productId" class="input input-bordered w-28" placeholder="P001">
            </div>
            <div class="form-control">
              <label class="label py-1"><span class="label-text">商品名称</span></label>
              <input v-model="createStore.productName" class="input input-bordered w-32" placeholder="如：T恤">
            </div>
          </div>

          <template v-if="createStore.selectedTemplateId">
            <div class="flex gap-4 mt-4">
              <!-- 左栏 -->
              <div class="w-60 flex-shrink-0 space-y-2">
                <div class="font-semibold text-sm">商品级字段</div>
                <FieldInput
                  v-for="f in createStore.productFields" :key="f.字段键"
                  :field="f"
                  :model-value="createStore.productInputs[f.字段键]"
                  :option-items="configStore['选项值']"
                  @update:model-value="createStore.productInputs[f.字段键] = $event"
                />

                <div class="font-semibold text-sm pt-3">变体属性</div>
                <div v-for="(attr, i) in createStore.variantAttributes" :key="i" class="flex gap-1">
                  <input :value="attr.name" class="input input-bordered input-sm w-16" placeholder="颜色"
                    @input="createStore.updateVariantAttribute(i, { name: $event.target.value })">
                  <input :value="attr.values" class="input input-bordered input-sm flex-1" placeholder="红,蓝"
                    @input="createStore.updateVariantAttribute(i, { values: $event.target.value })">
                  <button class="btn btn-ghost btn-xs text-error" @click="createStore.removeVariantAttribute(i)">✕</button>
                </div>
                <button class="btn btn-ghost btn-xs" @click="createStore.addVariantAttribute">＋ 变体属性</button>

                <div class="flex gap-2 pt-3">
                  <button class="btn btn-sm" @click="createStore.generateSkus()">生成SKU</button>
                  <button class="btn btn-primary btn-sm" :disabled="createStore.calculating" @click="handleCalculate">计算</button>
                  <button class="btn btn-success btn-sm" @click="handleSaveToList">保存到列表</button>
                </div>
              </div>

              <!-- SKU 表格 -->
              <div class="flex-1 min-w-0 overflow-x-auto">
                <table v-if="createStore.skus.length" class="table table-xs">
                  <thead>
                    <tr>
                      <th class="w-12"></th>
                      <th>SKU码</th>
                      <th v-for="a in createStore.variantAttributes.filter(a=>a.name.trim())" :key="a.name">{{ a.name.trim() }}</th>
                      <th v-for="f in createStore.skuInputFields" :key="f.字段键">
                        {{ f.字段名称 }}
                        <button class="btn btn-ghost btn-xs text-base-content/40" title="统一" @click="batchSetSkuInput(f.字段键)">⇅</button>
                      </th>
                      <th>图片</th>
                      <th v-for="f in createStore.skuOutputFields" :key="f.字段键">{{ f.字段名称 }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(sku, si) in createStore.skus" :key="sku.key">
                      <td>
                        <span class="flex flex-col leading-none">
                          <button class="btn btn-ghost btn-xs px-0 h-4 min-h-0" @click="moveUp(createStore.skus, si)">▲</button>
                          <button class="btn btn-ghost btn-xs px-0 h-4 min-h-0" @click="moveDown(createStore.skus, si)">▼</button>
                        </span>
                      </td>
                      <td><input v-model="sku.skuCode" class="input input-bordered input-xs w-20" placeholder="SKU"></td>
                      <td v-for="a in createStore.variantAttributes.filter(a=>a.name.trim())" :key="a.name" class="text-xs">{{ sku.attrs[a.name.trim()] }}</td>
                      <td v-for="f in createStore.skuInputFields" :key="f.字段键">
                        <input v-model="sku.inputs[f.字段键]" class="input input-bordered input-xs w-20" type="number" step="any">
                      </td>
                      <td class="w-16">
                        <div v-if="sku.images" class="relative group w-10 h-10">
                          <img :src="sku.images" class="w-10 h-10 object-cover rounded cursor-pointer border" @click="openImagePreview(sku.images)">
                          <button class="absolute -top-1 -right-1 btn btn-ghost btn-xs p-0 w-4 h-4 min-h-0 rounded-full bg-base-100 opacity-0 group-hover:opacity-100" @click="clearImage(sku)">✕</button>
                        </div>
                        <label v-else class="btn btn-ghost btn-xs w-10 h-10 p-0 border-dashed border text-base-content/30 text-lg cursor-pointer" title="上传图片">
                          ＋
                          <input type="file" accept="image/*" class="hidden" @change="handleImageUpload(sku, $event)">
                        </label>
                      </td>
                      <td v-for="f in createStore.skuOutputFields" :key="f.字段键" class="text-xs whitespace-nowrap">
                        <span v-if="sku.error" class="text-error text-xs">{{ sku.error }}</span>
                        <template v-else-if="sku.results[f.字段键] !== undefined">
                          {{ f.单位 === '%' ? (sku.results[f.字段键] * 100).toFixed(2) + '%' : typeof sku.results[f.字段键] === 'number' ? sku.results[f.字段键].toFixed(2) : sku.results[f.字段键] }}
                          <button v-if="sku.traces?.[f.字段键]" class="btn btn-ghost btn-xs text-base-content/40 ml-1" @click="openTrace(sku, f.字段键)">?</button>
                        </template>
                        <span v-else class="text-base-content/30">—</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div v-else class="text-sm text-base-content/40 mt-2">选择模板后自动生成 SKU，或点击「生成SKU」手动刷新</div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- 商品列表 -->
      <div class="card card-sm bg-base-100 border border-base-300">
        <div class="card-body">
          <h2 class="card-title text-lg">商品记录（{{ listStore.records.length }} 行）</h2>
          <div v-if="!listStore.records.length" class="text-sm text-base-content/40">暂无</div>
          <div v-else class="overflow-x-auto">
            <table class="table table-sm">
              <thead><tr><th class="w-10"></th><th v-for="col in listColumns" :key="col">{{ col }}</th><th class="sticky right-0 bg-base-100">操作</th></tr></thead>
              <tbody>
                <tr v-for="(row, idx) in listStore.records" :key="idx">
                  <td>
                    <span class="flex flex-col leading-none">
                      <button class="btn btn-ghost btn-xs px-0 h-4 min-h-0" @click="moveUp(listStore.records, idx)">▲</button>
                      <button class="btn btn-ghost btn-xs px-0 h-4 min-h-0" @click="moveDown(listStore.records, idx)">▼</button>
                    </span>
                  </td>
                  <td v-for="col in listColumns" :key="col" class="whitespace-nowrap">
                    <template v-if="isImage(row[col])">
                      <img :src="row[col]" class="w-10 h-10 object-cover rounded cursor-pointer border" @click="openImagePreview(row[col])">
                    </template>
                    <template v-else>{{ row[col] }}</template>
                  </td>
                  <td class="sticky right-0 bg-base-100">
                    <button class="btn btn-ghost btn-xs" @click="loadRecordBack(idx)" title="加载到新建面板">📋</button>
                    <button class="btn btn-ghost btn-xs text-error" @click="listStore.removeRecord(idx)">✕</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
    <!-- ═══ 图片预览弹窗 ═══ -->
    <dialog :open="showImageModal" class="modal">
      <div class="modal-box max-w-4xl p-2 bg-black/90">
        <div class="flex justify-end mb-2 gap-2">
          <button class="btn btn-ghost btn-sm text-white" @click="imageZoom = Math.max(0.25, imageZoom - 0.25)">🔍−</button>
          <button class="btn btn-ghost btn-sm text-white" @click="imageZoom = Math.min(3, imageZoom + 0.25)">🔍＋</button>
          <button class="btn btn-ghost btn-sm text-white" @click="showImageModal = false">✕</button>
        </div>
        <div class="overflow-auto max-h-[80vh] flex justify-center">
          <img :src="previewImage" :style="{ transform: `scale(${imageZoom})`, transition: 'transform 0.2s' }" class="max-w-full">
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showImageModal = false"><button>关闭</button></form>
    </dialog>

    <!-- ═══ 计算过程弹窗 ═══ -->
    <dialog :open="showTraceModal" class="modal">
      <div class="modal-box max-w-lg">
        <div class="flex items-center justify-between mb-4"><h3 class="text-lg font-bold">计算过程：{{ traceField }}</h3><button class="btn btn-ghost btn-sm btn-circle" @click="showTraceModal = false">✕</button></div>
        <div class="text-sm leading-relaxed whitespace-pre-wrap">
          {{ createStore.skus.find(s => s.key === traceSkuKey)?.traces?.[traceField] || '无计算记录' }}
        </div>
        <div class="modal-action">
          <button class="btn btn-sm" @click="showTraceModal = false">关闭</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showTraceModal = false"><button>关闭</button></form>
    </dialog>
  </div>
</template>
