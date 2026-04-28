<script setup>
import { computed, ref } from 'vue'
import FieldInput from '@/components/common/FieldInput.vue'
import { useFileIO } from '@/composables/useFileIO'
import { useConfigStore } from '@/stores/config'
import { useCreateStore } from '@/stores/create'
import { useListStore } from '@/stores/list'
import { validateUserInputs } from '@/utils/validate'

const configStore = useConfigStore()
const createStore = useCreateStore()
const listStore = useListStore()
const { openConfigExcel } = useFileIO()

const showNoConfig = computed(() => !configStore.loaded)
const showNoPreset = computed(() => !createStore.selectedPresetId)

const validationErrors = ref([])

const presetParams = computed(() => {
  const preset = createStore.selectedPreset
  if (!preset || !preset.params)
    return []
  return preset.params
})

const paramFields = computed(() => {
  return presetParams.value.map((param) => {
    const field = configStore.getField(param.fieldKey)
    return {
      ...param,
      fieldName: field?.fieldName || param.paramName || param.fieldKey,
      type: param.type || field?.type || 'text',
      unit: param.unit || field?.unit || '',
      optionGroupId: param.optionGroupId || field?.optionGroupId || '',
      required: param.isRequired,
    }
  })
})

function handleCalculate() {
  validationErrors.value = []
  const preset = createStore.selectedPreset
  if (!preset)
    return

  const errs = validateUserInputs(createStore.userInputs, paramFields.value)
  if (errs.length > 0) {
    validationErrors.value = errs
    return
  }

  createStore.calculate()
}

function handleSaveToList() {
  const record = createStore.getRecord()
  listStore.addRecord(record)
}

function handlePresetChange(e) {
  createStore.selectPreset(e.target.value)
  validationErrors.value = []
}

function formatPresetLabel(p) {
  const cp = configStore.getCountryPlatform(p.cpId)
  if (!cp)
    return ''
  return `(${cp.country} - ${cp.platform})`
}

const selectedPresetCp = computed(() => {
  if (!createStore.selectedPreset?.cpId)
    return null
  return configStore.getCountryPlatform(createStore.selectedPreset.cpId)
})
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">
        新建
      </h1>
      <div v-if="showNoConfig" class="flex gap-2">
        <button class="btn btn-primary btn-sm" @click="openConfigExcel">
          打开配置
        </button>
      </div>
    </div>

    <div v-if="showNoConfig" class="text-center py-20 text-base-content/50">
      <p class="mb-4">
        请先打开配置 Excel 文件以开始使用。
      </p>
      <button class="btn btn-primary" @click="openConfigExcel">
        打开配置 Excel
      </button>
    </div>

    <div v-else class="flex gap-6">
      <div class="flex-1 min-w-0 space-y-6">
        <div class="card bg-base-100 border border-base-300">
          <div class="card-body">
            <h2 class="card-title text-lg">
              选择预设
            </h2>
            <select
              data-tour="create-preset-select"
              class="select select-bordered w-full max-w-md"
              :value="createStore.selectedPresetId"
              @change="handlePresetChange"
            >
              <option value="">
                -- 选择预设 --
              </option>
              <option
                v-for="p in configStore.enabledPresets"
                :key="p.presetId"
                :value="p.presetId"
              >
                {{ p.presetName }} {{ formatPresetLabel(p) }}
              </option>
            </select>
          </div>
        </div>

        <div class="card bg-base-100 border border-base-300" data-tour="create-basic-info">
          <div class="card-body">
            <h2 class="card-title text-lg">
              基础信息
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="form-control w-full">
                <label class="label py-1">
                  <span class="label-text">名称</span>
                </label>
                <input
                  v-model="createStore.basicInfo.name"
                  type="text"
                  class="input input-bordered w-full"
                  placeholder="产品名称"
                >
              </div>
              <div class="form-control w-full">
                <label class="label py-1">
                  <span class="label-text">款号</span>
                </label>
                <input
                  v-model="createStore.basicInfo.sku"
                  type="text"
                  class="input input-bordered w-full"
                  placeholder="SKU"
                >
              </div>
              <div class="form-control w-full">
                <label class="label py-1">
                  <span class="label-text">成本</span>
                  <span class="label-text-alt opacity-60">元</span>
                </label>
                <input
                  v-model.number="createStore.basicInfo.cost"
                  type="number"
                  step="any"
                  class="input input-bordered w-full"
                  placeholder="0.00"
                >
              </div>
              <div class="form-control w-full">
                <label class="label py-1">
                  <span class="label-text">重量</span>
                  <span class="label-text-alt opacity-60">g</span>
                </label>
                <input
                  v-model.number="createStore.basicInfo.weight"
                  type="number"
                  step="any"
                  class="input input-bordered w-full"
                  placeholder="0"
                >
              </div>
            </div>
          </div>
        </div>

        <div v-if="!showNoPreset" class="card bg-base-100 border border-base-300" data-tour="create-params">
          <div class="card-body">
            <h2 class="card-title text-lg">
              输入参数
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldInput
                v-for="param in paramFields"
                :key="param.paramId"
                :field="param"
                :model-value="createStore.userInputs[param.fieldKey]"
                :option-groups="configStore.config.optionGroups"
                @update:model-value="createStore.updateInput(param.fieldKey, $event)"
              />
            </div>

            <div v-if="validationErrors.length > 0" class="mt-4">
              <div v-for="err in validationErrors" :key="err" class="alert alert-warning py-1 text-sm">
                {{ err }}
              </div>
            </div>

            <div v-if="createStore.errors.length > 0" class="mt-4">
              <div v-for="err in createStore.errors" :key="err" class="alert alert-error py-1 text-sm">
                {{ err }}
              </div>
            </div>

            <div class="card-actions mt-4">
              <button
                data-tour="create-calculate"
                class="btn btn-primary"
                :disabled="createStore.calculating"
                @click="handleCalculate"
              >
                <span v-if="createStore.calculating" class="loading loading-spinner loading-xs mr-1" />
                计算
              </button>
            </div>
          </div>
        </div>

        <div class="card bg-base-100 border border-base-300" data-tour="create-images">
          <div class="card-body">
            <h2 class="card-title text-lg">
              图片
            </h2>
            <textarea
              v-model="createStore.images"
              class="textarea textarea-bordered w-full"
              rows="3"
              placeholder="图片URL，多个请用逗号分隔"
            />
            <div v-if="createStore.images" class="mt-2 flex gap-2 flex-wrap">
              <img
                v-for="(img, i) in createStore.images.split(',').map(s => s.trim()).filter(Boolean)"
                :key="i"
                :src="img"
                class="w-20 h-20 object-cover rounded border"
                @error="($event.target).style.display = 'none'"
              >
            </div>
          </div>
        </div>

        <div class="card bg-base-100 border border-base-300" data-tour="create-variants">
          <div class="card-body">
            <h2 class="card-title text-lg">
              变体
            </h2>
            <textarea
              v-model="createStore.variants"
              class="textarea textarea-bordered w-full font-mono"
              rows="4"
              placeholder="JSON 格式，如 {&quot;颜色&quot;: [&quot;红&quot;,&quot;蓝&quot;], &quot;尺寸&quot;: [&quot;S&quot;,&quot;M&quot;,&quot;L&quot;]}"
            />
          </div>
        </div>
      </div>

      <div class="w-64 flex-shrink-0 space-y-6">
        <div v-if="!showNoPreset" class="card bg-base-100 border border-base-300" data-tour="create-results">
          <div class="card-body">
            <h2 class="card-title text-lg">
              计算结果
            </h2>
            <div v-if="Object.keys(createStore.results).length === 0" class="text-base-content/50 text-sm">
              计算后结果将显示在此处。
            </div>
            <div v-else class="space-y-2">
              <div v-for="(val, key) in createStore.results" :key="key" class="flex justify-between items-center">
                <span class="text-sm font-medium">{{ key }}</span>
                <span class="text-sm">{{ val }}</span>
              </div>
            </div>

            <div v-if="Object.keys(createStore.results).length > 0" class="card-actions mt-4">
              <button class="btn btn-success btn-sm" @click="handleSaveToList">
                保存到列表
              </button>
            </div>
          </div>
        </div>

        <div class="card bg-base-100 border border-base-300" data-tour="create-preset-info">
          <div class="card-body">
            <h2 class="card-title text-lg">
              预设信息
            </h2>
            <div v-if="showNoPreset" class="text-base-content/50 text-sm">
              选择一个预设以查看详情。
            </div>
            <div v-else-if="createStore.selectedPreset">
              <div class="text-sm space-y-1">
                <div><strong>名称：</strong> {{ createStore.selectedPreset.presetName }}</div>
                <div v-if="selectedPresetCp">
                  <strong>国家：</strong> {{ selectedPresetCp.country }}
                </div>
                <div v-if="selectedPresetCp">
                  <strong>平台：</strong> {{ selectedPresetCp.platform }}
                </div>
                <div><strong>规则集：</strong> {{ configStore.getRuleSet(createStore.selectedPreset.ruleSetId)?.name || createStore.selectedPreset.ruleSetId }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
