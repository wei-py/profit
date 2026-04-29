<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import EditableTable from '@/components/common/EditableTable.vue'
import { useFileIO } from '@/composables/useFileIO'
import { useConfigStore } from '@/stores/config'
import { validatePreset } from '@/utils/validate'

const configStore = useConfigStore()
const { openConfigExcel, saveConfigExcel } = useFileIO()

/** @type {import('vue').Ref<string>} 搜索关键词 */
const searchQuery = ref('')
/** @type {import('vue').Ref<string>} 当前选中的预设 ID */
const selectedPresetId = ref('')
/** @type {import('vue').Ref<boolean>} 是否显示预设编辑弹窗 */
const showPresetModal = ref(false)
/** @type {import('vue').Ref<object | null>} 正在编辑的预设对象 */
const editingPreset = ref(null)
/** @type {import('vue').Ref<object>} 预设表单数据 */
const presetForm = ref({ presetName: '', cpId: '', ruleSetId: '', enabled: true })
/** @type {import('vue').Ref<string[]>} 预设表单校验错误 */
const presetErrors = ref([])

/** @type {import('vue').Ref<boolean>} 是否显示国家平台弹窗 */
const showCpModal = ref(false)

/** 国家平台表格列定义 */
const cpColumns = [
  { key: 'country', prop: 'country', label: '国家' },
  { key: 'platform', prop: 'platform', label: '平台' },
  { key: 'currency', prop: 'currency', label: '货币' },
  { key: 'enabled', prop: 'enabled', label: '启用', type: 'boolean' },
]

/** 是否显示无配置提示 */
const showNoConfig = computed(() => !configStore.loaded)

const CACHE_PRESET_KEY = 'profit-selected-preset-id'

onMounted(() => {
  if (!configStore.loaded)
    return
  const cached = localStorage.getItem(CACHE_PRESET_KEY)
  if (cached && configStore.config.presets.some(p => p.presetId === cached)) {
    selectedPresetId.value = cached
  }
})

watch(selectedPresetId, (val) => {
  localStorage.setItem(CACHE_PRESET_KEY, val)
})

/** 国家平台下拉选项 */
const cpOptions = computed(() =>
  configStore.enabledCountryPlatforms.map(cp => ({
    value: cp.cpId,
    label: `${cp.country} (${cp.platform})`,
  })),
)

/** 预设 ID -> 国家平台对象的映射 */
const presetCpMap = computed(() => {
  const map = {}
  for (const p of configStore.config.presets) {
    if (p.cpId) {
      const cp = configStore.getCountryPlatform(p.cpId)
      if (cp) {
        map[p.presetId] = cp
      }
    }
  }
  return map
})

/** 按搜索关键词过滤后的预设列表 */
const filteredPresets = computed(() => {
  const q = searchQuery.value.toLowerCase()
  if (!q)
    return configStore.config.presets
  return configStore.config.presets.filter((p) => {
    if (p.presetName.toLowerCase().includes(q))
      return true
    const cp = presetCpMap.value[p.presetId]
    if (cp) {
      if (cp.country.toLowerCase().includes(q))
        return true
      if (cp.platform.toLowerCase().includes(q))
        return true
    }
    return false
  })
})

/** 当前选中的预设对象 */
const selectedPreset = computed(() =>
  configStore.config.presets.find(p => p.presetId === selectedPresetId.value),
)

/** 当前选中预设关联的国家平台 */
const selectedPresetCp = computed(() => {
  if (!selectedPreset.value?.cpId)
    return null
  return configStore.getCountryPlatform(selectedPreset.value.cpId)
})

/** 参数表格列定义 */
const paramColumns = [
  { key: 'paramName', prop: 'paramName', label: '名称' },
  {
    key: 'type',
    prop: 'type',
    label: '类型',
    type: 'select',
    options: [
      { value: 'text', label: '文本' },
      { value: 'number', label: '数字' },
      { value: 'select', label: '下拉选择' },
      { value: 'boolean', label: '布尔' },
      { value: 'date', label: '日期' },
      { value: 'rule', label: '规则' },
    ],
  },
  { key: 'unit', prop: 'unit', label: '单位' },
  {
    key: 'optionGroupId',
    prop: 'optionGroupId',
    label: '选项组',
    type: 'select',
    getOptions: () => configStore.config.optionGroups.map(g => ({
      value: g.groupId,
      label: g.groupName,
    })),
  },
  {
    key: 'defaultValue',
    prop: 'defaultValue',
    label: '默认值',
    getType: row => row.type === 'select' ? 'select' : 'text',
    getOptions: (row) => {
      if (row.type !== 'select' || !row.optionGroupId)
        return []
      const group = configStore.getOptionGroup(row.optionGroupId)
      if (!group?.items)
        return []
      return group.items.filter(i => i.enabled !== false).map(i => ({
        value: i.itemValue,
        label: i.itemLabel || i.itemValue,
      }))
    },
  },
  { key: 'sort', prop: 'sort', label: '排序', type: 'number' },
  { key: 'isRequired', prop: 'isRequired', label: '必填', type: 'boolean' },
]

/** 打开新建预设弹窗。 */
function openNewPreset() {
  editingPreset.value = null
  presetForm.value = { presetName: '', cpId: '', ruleSetId: '', enabled: true }
  presetErrors.value = []
  showPresetModal.value = true
}

/** 保存配置并显示操作结果反馈。 */
async function handleSaveConfig() {
  const result = await saveConfigExcel()
  if (!result.success) {
    // eslint-disable-next-line no-alert
    alert(`保存失败${result.error ? `: ${result.error}` : ''}`)
  }
}

/**
 * 打开编辑预设弹窗。
 * @param {object} preset - 待编辑的预设对象
 */
function openEditPreset(preset) {
  editingPreset.value = preset
  presetForm.value = {
    presetName: preset.presetName,
    cpId: preset.cpId || '',
    ruleSetId: preset.ruleSetId,
    enabled: preset.enabled,
  }
  presetErrors.value = []
  showPresetModal.value = true
}

/** 校验并保存预设（新建或更新）。 */
function savePreset() {
  const errs = validatePreset(presetForm.value)
  if (errs.length > 0) {
    presetErrors.value = errs
    return
  }

  if (editingPreset.value) {
    editingPreset.value.presetName = presetForm.value.presetName
    editingPreset.value.cpId = presetForm.value.cpId
    editingPreset.value.ruleSetId = presetForm.value.ruleSetId
    editingPreset.value.enabled = presetForm.value.enabled
  }
  else {
    const id = `preset_${Date.now()}`
    configStore.config.presets.push({
      presetId: id,
      presetName: presetForm.value.presetName,
      cpId: presetForm.value.cpId,
      ruleSetId: presetForm.value.ruleSetId,
      enabled: presetForm.value.enabled,
      params: [],
    })
  }
  showPresetModal.value = false
}

/**
 * 删除指定预设。
 * @param {object} preset - 待删除的预设对象
 */
function deletePreset(preset) {
  configStore.config.presets = configStore.config.presets.filter(p => p.presetId !== preset.presetId)
  if (selectedPresetId.value === preset.presetId) {
    selectedPresetId.value = ''
  }
}

/** 为当前选中预设添加一条空参数。 */
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

/**
 * 更新参数行数据。
 * @param {object} row - 更新后的行数据
 */
function handleParamUpdate(row) {
  if (!selectedPreset.value)
    return
  const idx = selectedPreset.value.params.findIndex(p => p.paramId === row.paramId)
  if (idx !== -1) {
    selectedPreset.value.params[idx] = row
  }
}

/**
 * 删除参数行。
 * @param {object} row - 待删除的行数据
 */
function handleParamDelete(row) {
  if (!selectedPreset.value)
    return
  selectedPreset.value.params = selectedPreset.value.params.filter(p => p.paramId !== row.paramId)
}

/** 从字段定义中补全缺失的参数到当前预设。 */
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

/** 打开国家平台管理弹窗。 */
function openCpModal() {
  showCpModal.value = true
}

/** 新增一条国家平台记录。 */
function handleCpAdd() {
  const id = `cp_${String(configStore.config.countryPlatforms.length + 1).padStart(3, '0')}`
  configStore.config.countryPlatforms.push({
    cpId: id,
    country: '',
    platform: '',
    currency: '',
    enabled: true,
  })
}

/**
 * 更新国家平台记录。
 * @param {object} row - 更新后的行数据
 */
function handleCpUpdate(row) {
  const idx = configStore.config.countryPlatforms.findIndex(cp => cp.cpId === row.cpId)
  if (idx !== -1) {
    configStore.config.countryPlatforms[idx] = row
  }
}

/** @type {import('vue').Ref<object | null>} 待删除确认的国家平台 */
const cpDeleteConfirm = ref(null)

/**
 * 弹出删除国家平台确认。
 * @param {object} row - 待删除的行数据
 */
function handleCpDelete(row) {
  cpDeleteConfirm.value = row
}

/** 确认删除国家平台。 */
function confirmCpDelete() {
  if (!cpDeleteConfirm.value)
    return
  const row = cpDeleteConfirm.value
  configStore.config.countryPlatforms = configStore.config.countryPlatforms.filter(cp => cp.cpId !== row.cpId)
  cpDeleteConfirm.value = null
}

/** 取消删除国家平台。 */
function cancelCpDelete() {
  cpDeleteConfirm.value = null
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">
        预设
      </h1>
      <div class="flex gap-2" data-tour="preset-toolbar">
        <button v-if="showNoConfig" class="btn btn-primary btn-sm" @click="openConfigExcel">
          打开配置
        </button>
        <template v-else>
          <button class="btn btn-ghost btn-sm" @click="openCpModal">
            国家平台
          </button>
          <button class="btn btn-primary btn-sm" @click="openNewPreset">
            + 新建预设
          </button>
          <button class="btn btn-ghost btn-sm" @click="handleSaveConfig">
            保存配置
          </button>
        </template>
      </div>
    </div>

    <div v-if="showNoConfig" class="flex-1 flex items-center justify-center text-base-content/50">
      <div class="text-center">
        <p class="mb-4">
          请先打开配置 Excel 文件以开始使用。
        </p>
        <button class="btn btn-primary" @click="openConfigExcel">
          打开配置 Excel
        </button>
      </div>
    </div>

    <div v-else class="flex-1 min-h-0 flex gap-3">
      <div class="w-64 flex-shrink-0 min-h-0">
        <div class="card card-sm bg-base-100 border border-base-300 h-full" data-tour="preset-list">
          <div class="card-body flex-1 flex-col min-h-0 p-3">
            <input
              v-model="searchQuery"
              data-tour="preset-search"
              type="text"
              class="input input-bordered input-sm w-full flex-shrink-0"
              placeholder="搜索预设..."
            >
            <div class="flex-1 min-h-0 overflow-y-auto mt-2">
              <ul class="menu menu-vertical gap-0.5 w-full">
                <!-- <template v-for="i in 10"> -->
                <li v-for="p in filteredPresets" :key="p.presetId">
                  <button
                    :class="{ active: selectedPresetId === p.presetId }"
                    @click="selectedPresetId = p.presetId"
                  >
                    <div class="flex justify-between items-center w-full">
                      <span>{{ p.presetName }}</span>
                      <span class="text-xs opacity-60">{{ presetCpMap[p.presetId]?.country || '' }}</span>
                    </div>
                  </button>
                </li>
                <!-- </template> -->
                <li v-if="filteredPresets.length === 0">
                  <span class="text-base-content/50">未找到预设</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div class="flex-1 min-w-0 min-h-0 flex flex-col">
        <div v-if="!selectedPreset" class="card card-sm bg-base-100 border border-base-300">
          <div class="card-body text-center py-20 text-base-content/50">
            请从左侧选择一个预设，或新建一个预设。
          </div>
        </div>

        <div v-else class="card card-sm bg-base-100 border border-base-300 flex-1 min-h-0">
          <div class="card-body flex-1 flex-col min-h-0">
            <div data-tour="preset-detail-header" class="flex items-center justify-between mb-4 flex-shrink-0">
              <div>
                <h2 class="text-lg font-bold">
                  {{ selectedPreset.presetName }}
                </h2>
                <p class="text-sm text-base-content/60">
                  <template v-if="selectedPresetCp">
                    {{ selectedPresetCp.country }} / {{ selectedPresetCp.platform }}
                  </template>
                  <template v-else>
                    未设置国家平台
                  </template>
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

            <div class="flex justify-between items-center mb-2 flex-shrink-0">
              <h3 class="font-medium">
                参数
              </h3>
              <button data-tour="preset-fill-defaults" class="btn btn-ghost btn-xs" @click="handleFillDefaults">
                补全默认参数
              </button>
            </div>

            <div class="flex-1 min-h-0">
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
    </div>

    <div v-if="showPresetModal" class="modal modal-open" data-tour="preset-edit-modal">
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
          <div>
            <label class="label text-xs pb-1">国家平台</label>
            <div class="flex gap-1">
              <select v-model="presetForm.cpId" class="select select-bordered flex-1">
                <option value="">
                  -- 请选择 --
                </option>
                <option v-for="opt in cpOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
              <button class="btn btn-ghost btn-sm" title="新建国家平台" @click="openCpModal">
                +
              </button>
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

    <div v-if="showCpModal" class="modal modal-open">
      <div class="modal-box max-w-lg">
        <h3 class="text-lg font-bold mb-4">
          国家平台管理
        </h3>
        <EditableTable
          :columns="cpColumns"
          :rows="configStore.config.countryPlatforms"
          id-key="cpId"
          @add="handleCpAdd"
          @update="handleCpUpdate"
          @delete="handleCpDelete"
        />
        <div class="modal-action">
          <button class="btn btn-ghost btn-sm" @click="showCpModal = false">
            关闭
          </button>
        </div>

        <div v-if="cpDeleteConfirm" class="modal modal-open">
          <div class="modal-box">
            <h3 class="text-lg font-bold mb-4">
              确认删除
            </h3>
            <p class="text-sm">
              有 {{ configStore.config.presets.filter(p => p.cpId === cpDeleteConfirm.cpId).length }} 个预设引用了「{{ cpDeleteConfirm.country }} ({{ cpDeleteConfirm.platform }})」，删除后这些预设的国家平台将变为空。确认删除？
            </p>
            <div class="modal-action">
              <button class="btn btn-ghost btn-sm" @click="cancelCpDelete">
                取消
              </button>
              <button class="btn btn-error btn-sm" @click="confirmCpDelete">
                确认删除
              </button>
            </div>
          </div>
          <div class="modal-backdrop" @click="cancelCpDelete" />
        </div>
      </div>
      <div class="modal-backdrop" @click="showCpModal = false" />
    </div>
  </div>
</template>
