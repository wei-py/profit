<script setup>
import { computed } from 'vue'
import EditableTable from '@/components/common/EditableTable.vue'
import { useFileIO } from '@/composables/useFileIO'
import { useConfigStore } from '@/stores/config'

const configStore = useConfigStore()
const { openConfigExcel, saveConfigExcel } = useFileIO()

const showNoConfig = computed(() => !configStore.loaded)

const typeOptions = [
  { value: 'text', label: 'text' },
  { value: 'number', label: 'number' },
  { value: 'select', label: 'select' },
  { value: 'boolean', label: 'boolean' },
  { value: 'date', label: 'date' },
  { value: 'image', label: 'image' },
]

const modeOptions = [
  { value: 'input', label: 'input' },
  { value: 'output', label: 'output' },
  { value: 'both', label: 'both' },
]

const fieldColumns = [
  { key: 'fieldKey', prop: 'fieldKey', label: '字段键' },
  { key: 'fieldName', prop: 'fieldName', label: '字段名' },
  { key: 'type', prop: 'type', label: '类型', type: 'select', options: typeOptions },
  { key: 'unit', prop: 'unit', label: '单位' },
  { key: 'optionGroupId', prop: 'optionGroupId', label: '选项组ID' },
  { key: 'ruleMode', prop: 'ruleMode', label: '规则模式', type: 'select', options: modeOptions },
  { key: 'required', prop: 'required', label: '必填', type: 'boolean' },
]

function handleFieldAdd() {
  configStore.config.fields.push({
    fieldKey: '',
    fieldName: '',
    type: 'text',
    unit: '',
    optionGroupId: '',
    ruleMode: 'input',
    required: false,
  })
}

function handleFieldUpdate(row) {
  const idx = configStore.config.fields.findIndex(f => f.fieldKey === row.fieldKey)
  if (idx !== -1) {
    configStore.config.fields[idx] = { ...row }
  }
}

function handleFieldDelete(row) {
  configStore.config.fields = configStore.config.fields.filter(f => f.fieldKey !== row.fieldKey)
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">
        字段
      </h1>
      <div class="flex gap-2">
        <button v-if="showNoConfig" class="btn btn-primary btn-sm" @click="openConfigExcel">
          打开配置
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

    <div v-else class="card bg-base-100 border border-base-300" data-tour="field-table">
      <div class="card-body">
        <EditableTable
          :columns="fieldColumns"
          :rows="configStore.config.fields"
          id-key="fieldKey"
          @add="handleFieldAdd"
          @update="handleFieldUpdate"
          @delete="handleFieldDelete"
        />
      </div>
    </div>
  </div>
</template>
