<script setup>
import { computed, ref } from 'vue'
import EditableTable from '@/components/common/EditableTable.vue'
import { useFileIO } from '@/composables/useFileIO'
import { useConfigStore } from '@/stores/config'
import { validatePreset } from '@/utils/validate'

const configStore = useConfigStore()
const { openConfigExcel, saveConfigExcel } = useFileIO()

const searchQuery = ref('')
const selectedPresetId = ref('')
const showPresetModal = ref(false)
const editingPreset = ref(null)
const presetForm = ref({ presetName: '', country: '', platform: '', ruleSetId: '', enabled: true })
const presetErrors = ref([])

const showNoConfig = computed(() => !configStore.loaded)

const filteredPresets = computed(() => {
  const q = searchQuery.value.toLowerCase()
  return configStore.config.presets.filter(p =>
    !q
    || p.presetName.toLowerCase().includes(q)
    || (p.country || '').toLowerCase().includes(q)
    || (p.platform || '').toLowerCase().includes(q),
  )
})

const selectedPreset = computed(() =>
  configStore.config.presets.find(p => p.presetId === selectedPresetId.value),
)

const paramColumns = [
  { key: 'paramName', prop: 'paramName', label: '名称' },
  { key: 'type', prop: 'type', label: '类型' },
  { key: 'unit', prop: 'unit', label: '单位' },
  { key: 'fieldKey', prop: 'fieldKey', label: '字段键' },
  { key: 'optionGroupId', prop: 'optionGroupId', label: '选项组' },
  { key: 'defaultValue', prop: 'defaultValue', label: '默认值' },
  { key: 'sort', prop: 'sort', label: '排序', type: 'number' },
  { key: 'isRequired', prop: 'isRequired', label: '必填', type: 'boolean' },
]

function openNewPreset() {
  editingPreset.value = null
  presetForm.value = { presetName: '', country: '', platform: '', ruleSetId: '', enabled: true }
  presetErrors.value = []
  showPresetModal.value = true
}

function openEditPreset(preset) {
  editingPreset.value = preset
  presetForm.value = { ...preset }
  presetErrors.value = []
  showPresetModal.value = true
}

function savePreset() {
  const errs = validatePreset(presetForm.value)
  if (errs.length > 0) {
    presetErrors.value = errs
    return
  }

  if (editingPreset.value) {
    Object.assign(editingPreset.value, presetForm.value)
  }
  else {
    const id = `preset_${Date.now()}`
    configStore.config.presets.push({
      presetId: id,
      ...presetForm.value,
      params: [],
    })
  }
  showPresetModal.value = false
}

function deletePreset(preset) {
  configStore.config.presets = configStore.config.presets.filter(p => p.presetId !== preset.presetId)
  if (selectedPresetId.value === preset.presetId) {
    selectedPresetId.value = ''
  }
}

function handleParamAdd() {
  if (!selectedPreset.value)
    return
  const id = `param_${Date.now()}`
  selectedPreset.value.params.push({
    paramId: id,
    presetId: selectedPresetId.value,
    fieldKey: '',
    paramName: '',
    type: 'text',
    unit: '',
    optionGroupId: '',
    defaultValue: '',
    sort: selectedPreset.value.params.length + 1,
    isRequired: false,
  })
}

function handleParamUpdate(row) {
  if (!selectedPreset.value)
    return
  const idx = selectedPreset.value.params.findIndex(p => p.paramId === row.paramId)
  if (idx !== -1) {
    selectedPreset.value.params[idx] = row
  }
}

function handleParamDelete(row) {
  if (!selectedPreset.value)
    return
  selectedPreset.value.params = selectedPreset.value.params.filter(p => p.paramId !== row.paramId)
}

function handleFillDefaults() {
  if (!selectedPreset.value)
    return
  const existingKeys = new Set(selectedPreset.value.params.map(p => p.fieldKey))
  for (const field of configStore.config.fields) {
    if (!existingKeys.has(field.fieldKey)) {
      selectedPreset.value.params.push({
        paramId: `param_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        presetId: selectedPresetId.value,
        fieldKey: field.fieldKey,
        paramName: field.fieldName,
        type: field.type,
        unit: field.unit,
        optionGroupId: field.optionGroupId,
        defaultValue: '',
        sort: selectedPreset.value.params.length + 1,
        isRequired: field.required,
      })
    }
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">
        预设
      </h1>
      <div class="flex gap-2" data-tour="preset-toolbar">
        <button v-if="showNoConfig" class="btn btn-primary btn-sm" @click="openConfigExcel">
          打开配置
        </button>
        <button v-else class="btn btn-primary btn-sm" @click="openNewPreset">
          + 新建预设
        </button>
        <button v-if="!showNoConfig" class="btn btn-ghost btn-sm" @click="saveConfigExcel">
          保存配置
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

    <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-1">
        <div class="card bg-base-100 border border-base-300" data-tour="preset-list">
          <div class="card-body">
            <input
              v-model="searchQuery"
              data-tour="preset-search"
              type="text"
              class="input input-bordered input-sm w-full"
              placeholder="搜索预设..."
            >
            <ul class="menu menu-vertical gap-0.5 mt-2 max-h-96 overflow-auto">
              <li v-for="p in filteredPresets" :key="p.presetId">
                <button
                  :class="{ active: selectedPresetId === p.presetId }"
                  @click="selectedPresetId = p.presetId"
                >
                  <div class="flex justify-between items-center w-full">
                    <span>{{ p.presetName }}</span>
                    <span class="text-xs opacity-60">{{ p.country }}</span>
                  </div>
                </button>
              </li>
              <li v-if="filteredPresets.length === 0">
                <span class="text-base-content/50">未找到预设</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div class="lg:col-span-2">
        <div v-if="!selectedPreset" class="card bg-base-100 border border-base-300">
          <div class="card-body text-center py-20 text-base-content/50">
            请从左侧选择一个预设，或新建一个预设。
          </div>
        </div>

        <div v-else class="card bg-base-100 border border-base-300" data-tour="preset-param-table">
          <div class="card-body">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h2 class="text-lg font-bold">
                  {{ selectedPreset.presetName }}
                </h2>
                <p class="text-sm text-base-content/60">
                  {{ selectedPreset.country }} / {{ selectedPreset.platform }}
                </p>
              </div>
              <div class="flex gap-1">
                <button class="btn btn-ghost btn-sm" @click="openEditPreset(selectedPreset)">
                  编辑
                </button>
                <button class="btn btn-ghost btn-sm text-error" @click="deletePreset(selectedPreset)">
                  删除
                </button>
              </div>
            </div>

            <div class="flex justify-between items-center mb-2">
              <h3 class="font-medium">
                参数
              </h3>
              <button class="btn btn-ghost btn-xs" @click="handleFillDefaults">
                补全默认参数
              </button>
            </div>

            <EditableTable
              :columns="paramColumns"
              :rows="selectedPreset.params"
              id-key="paramId"
              @add="handleParamAdd"
              @update="handleParamUpdate"
              @delete="handleParamDelete"
            />
          </div>
        </div>
      </div>
    </div>

    <div v-if="showPresetModal" class="modal modal-open">
      <div class="modal-box">
        <h3 class="text-lg font-bold mb-4">
          {{ editingPreset ? '编辑' : '新建' }}预设
        </h3>
        <div class="space-y-3">
          <div v-for="err in presetErrors" :key="err" class="alert alert-warning py-1 text-sm">
            {{ err }}
          </div>
          <div>
            <label class="label text-xs pb-1">名称</label>
            <input v-model="presetForm.presetName" type="text" class="input input-bordered w-full">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label text-xs pb-1">国家</label>
              <input v-model="presetForm.country" type="text" class="input input-bordered w-full">
            </div>
            <div>
              <label class="label text-xs pb-1">平台</label>
              <input v-model="presetForm.platform" type="text" class="input input-bordered w-full">
            </div>
          </div>
          <div>
            <label class="label text-xs pb-1">规则集</label>
            <select v-model="presetForm.ruleSetId" class="select select-bordered w-full">
              <option value="">
                -- 请选择 --
              </option>
              <option v-for="rs in configStore.config.ruleSets" :key="rs.ruleSetId" :value="rs.ruleSetId">
                {{ rs.name }}
              </option>
            </select>
          </div>
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="presetForm.enabled" type="checkbox" class="toggle toggle-sm">
            <span class="text-sm">启用</span>
          </label>
        </div>
        <div class="modal-action">
          <button class="btn btn-ghost btn-sm" @click="showPresetModal = false">
            取消
          </button>
          <button class="btn btn-primary btn-sm" @click="savePreset">
            保存
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="showPresetModal = false" />
    </div>
  </div>
</template>
