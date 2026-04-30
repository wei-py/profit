<script setup>
import { computed, ref } from 'vue'
import FieldInput from '@/components/common/FieldInput.vue'
import ImageUploader from '@/components/common/ImageUploader.vue'
import SkuTable from '@/components/common/SkuTable.vue'
import { useFileIO } from '@/composables/useFileIO'
import { useConfigStore } from '@/stores/config'
import { useCreateStore } from '@/stores/create'
import { useListStore } from '@/stores/list'

const configStore = useConfigStore()
const createStore = useCreateStore()
const listStore = useListStore()
const { openListExcel, saveListExcel } = useFileIO()

const showCreatePanel = ref(true)

// ── 国家 / 模板下拉 ──
const enabledCountries = computed(() =>
  configStore['国家平台'].filter(c => c.启用 === '是' || c.启用 === 'TRUE'),
)

const availableTemplates = computed(() => {
  if (!createStore.selectedCountryId) return []
  return configStore.getTemplatesByCountry(createStore.selectedCountryId)
})

function handleCountryChange(e) {
  createStore.selectTemplate(e.target.value, '')
}

function handleTemplateChange(e) {
  createStore.selectTemplate(createStore.selectedCountryId, e.target.value)
}

// ── 商品级字段 ──
const productFields = computed(() => {
  if (!createStore.selectedCountryId) return []
  return configStore.getFieldsByCountry(createStore.selectedCountryId)
    .filter(f => f.层级 === '商品级' && (f.输入输出 === '输入' || f.输入输出 === 'input'))
})

// ── SKU 级输入字段 ──
const skuInputFields = computed(() => {
  if (!createStore.selectedCountryId) return []
  return configStore.getFieldsByCountry(createStore.selectedCountryId)
    .filter(f => f.层级 === 'SKU级' && (f.输入输出 === '输入' || f.输入输出 === 'input'))
})

function handleCalculate() {
  createStore.calculate()
}

// ── 保存到列表 ──
function handleSaveToList() {
  const combos = createStore.generatedSkuCombos
  const records = []
  const now = new Date().toISOString().slice(0, 10)
  const cp = configStore['国家平台'].find(c => c.编号 === createStore.selectedCountryId)

  if (combos.length > 0) {
    for (const combo of combos) {
      const sd = createStore.skuData[combo.key] || {}
      const results = createStore.skuResults[combo.key] || {}
      const row = {
        '商品ID': createStore.basicInfo.name ? createStore.basicInfo.name + '_' + Date.now() : '',
        '商品名称': createStore.basicInfo.name,
        '国家平台编号': createStore.selectedCountryId,
        '模板编号': createStore.selectedTemplateId,
        'SKU码': sd.sku || '',
        ...combo.values,
      }
      // 商品级字段
      for (const [k, v] of Object.entries(createStore.productInputs)) {
        row[k] = v
      }
      // SKU 级输入
      if (sd.overrides) {
        for (const [k, v] of Object.entries(sd.overrides)) {
          row[k] = v
        }
      }
      // 结果
      for (const [k, v] of Object.entries(results)) {
        row[k] = v
      }
      row['图片'] = sd.images || ''
      row['计算时间'] = now
      records.push(row)
    }
  }
  else {
    const row = {
      '商品ID': createStore.basicInfo.name ? createStore.basicInfo.name + '_' + Date.now() : '',
      '商品名称': createStore.basicInfo.name,
      '国家平台编号': createStore.selectedCountryId,
      '模板编号': createStore.selectedTemplateId,
      'SKU码': createStore.basicInfo.sku,
      ...createStore.productInputs,
      ...createStore.results,
      '图片': createStore.images,
      '计算时间': now,
    }
    records.push(row)
  }

  listStore.addRecords(records)
}

// ── 列表列头 ──
const listColumns = computed(() => {
  if (!listStore.records.length) return []
  return Object.keys(listStore.records[0]).filter(k => k !== 'id')
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
      <!-- 可展开新建面板 -->
      <div v-if="showCreatePanel" class="card card-sm bg-base-100 border border-base-300">
        <div class="card-body">
          <h2 class="card-title text-lg">新建商品</h2>

          <!-- 国家+模板 -->
          <div class="flex gap-4">
            <div class="form-control">
              <label class="label py-1"><span class="label-text">国家平台</span></label>
              <select class="select select-bordered" @change="handleCountryChange">
                <option value="">-- 选择国家 --</option>
                <option v-for="c in enabledCountries" :key="c.编号" :value="c.编号">{{ c.国家 }} - {{ c.平台 }}</option>
              </select>
            </div>
            <div class="form-control" v-if="createStore.selectedCountryId">
              <label class="label py-1"><span class="label-text">模板</span></label>
              <select class="select select-bordered" @change="handleTemplateChange">
                <option value="">-- 选择模板 --</option>
                <option v-for="t in availableTemplates" :key="t.编号" :value="t.编号">{{ t.名称 }}</option>
              </select>
            </div>
          </div>

          <template v-if="createStore.selectedTemplateId">
            <!-- 商品级字段 -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <FieldInput
                v-for="f in productFields" :key="f.字段键"
                :field="{ fieldKey: f.字段键, fieldName: f.字段名称, type: f.类型, required: f.必填 === '是', optionGroupId: f.选项组编号 }"
                :model-value="createStore.productInputs[f.字段键]"
                :option-groups="configStore['选项组']"
                @update:model-value="createStore.updateProductInput(f.字段键, $event)"
              />
            </div>

            <!-- 无变体时的 SKU 级字段（售价、成本价、重量 等） -->
            <div v-if="createStore.generatedSkuCombos.length === 0" class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <FieldInput
                v-for="f in skuInputFields" :key="f.字段键"
                :field="{ fieldKey: f.字段键, fieldName: f.字段名称, type: f.类型, required: f.必填 === '是', unit: f.单位 }"
                :model-value="createStore.productInputs[f.字段键]"
                @update:model-value="createStore.updateProductInput(f.字段键, $event)"
              />
            </div>

            <!-- 变体 -->
            <div class="mt-4">
              <h3 class="font-semibold mb-2">变体属性</h3>
              <table v-if="createStore.variantRows.length" class="table table-sm">
                <thead><tr><th>属性名</th><th>选项值（逗号分隔）</th><th>操作</th></tr></thead>
                <tbody>
                  <tr v-for="row in createStore.variantRows" :key="row.id">
                    <td><input class="input input-bordered input-sm w-full" :value="row.key"
                      placeholder="如：颜色" @input="createStore.updateVariantRow(row.id, { key: $event.target.value })"></td>
                    <td><input class="input input-bordered input-sm w-full" :value="row.options"
                      placeholder="如：红,蓝" @input="createStore.updateVariantRow(row.id, { options: $event.target.value })"></td>
                    <td><button class="btn btn-ghost btn-xs text-error" @click="createStore.deleteVariantRow(row.id)">删除</button></td>
                  </tr>
                </tbody>
              </table>
              <button class="btn btn-ghost btn-sm" @click="createStore.addVariantRow">+ 添加属性</button>
            </div>

            <!-- SKU 表 -->
            <SkuTable
              v-if="createStore.generatedSkuCombos.length > 0"
              :sku-combos="createStore.generatedSkuCombos"
              :sku-data="createStore.skuData"
              :sku-results="createStore.skuResults"
              :base-sku="createStore.basicInfo.sku"
              :default-values="{ ...createStore.productInputs }"
              :all-field-keys="skuInputFields.map(f => f.字段键)"
              :selected-field-keys="skuInputFields.map(f => f.字段键)"
              @update-sku-field="createStore.updateSkuField"
              @update-sku-images="createStore.updateSkuImages"
            />

            <!-- 操作按钮 -->
            <div class="flex gap-2 mt-4">
              <button class="btn btn-primary" :disabled="createStore.calculating" @click="handleCalculate">
                <span v-if="createStore.calculating" class="loading loading-spinner loading-xs mr-1" />计算
              </button>
              <button class="btn btn-success btn-sm" @click="handleSaveToList">保存到列表</button>
            </div>

            <!-- 计算结果 (无变体时) -->
            <div v-if="Object.keys(createStore.results).length > 0 && createStore.generatedSkuCombos.length === 0" class="mt-4">
              <div v-for="(val, key) in createStore.results" :key="key" class="flex justify-between max-w-xs">
                <span class="text-sm font-medium">{{ key }}</span>
                <span class="text-sm">{{ typeof val === 'number' ? val.toFixed(2) : val }}</span>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- 商品列表 -->
      <div class="card card-sm bg-base-100 border border-base-300">
        <div class="card-body">
          <h2 class="card-title text-lg">商品记录（{{ listStore.records.length }} 行）</h2>
          <div v-if="listStore.records.length === 0" class="text-base-content/50 text-sm">暂无商品，展开上方「新建」面板开始。</div>
          <div v-else class="overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th v-for="col in listColumns" :key="col">{{ col }}</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in listStore.records" :key="idx">
                  <td v-for="col in listColumns" :key="col">{{ row[col] }}</td>
                  <td><button class="btn btn-ghost btn-xs text-error" @click="listStore.removeRecord(idx)">删除</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
