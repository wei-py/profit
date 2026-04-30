<script setup>
import { computed, ref } from 'vue'
import EditableTable from '@/components/common/EditableTable.vue'
import { useConfigStore } from '@/stores/config'

const store = useConfigStore()
const selectedCountryId = ref(store['国家平台'].find(c => c.启用 === '是')?.编号 || '')

const enabledCountries = computed(() =>
  store['国家平台'].filter(c => c.启用 === '是' || c.启用 === 'TRUE'),
)

const countryGroups = computed(() =>
  store.getOptionGroupsByCountry(selectedCountryId.value),
)

const selectedGroupId = ref('')

const groupColumns = [
  { key: '编号', label: '编号', type: 'text' },
  { key: '名称', label: '名称', type: 'text' },
  { key: '所属国家平台', label: '所属国家平台', type: 'text' },
  { key: '说明', label: '说明', type: 'text' },
]

const itemColumns = [
  { key: '所属分组', label: '所属分组', type: 'text' },
  { key: '选项值', label: '选项值', type: 'text' },
  { key: '显示名', label: '显示名', type: 'text' },
  { key: '排序', label: '排序', type: 'number' },
  { key: '启用', label: '启用', type: 'boolean' },
  { key: '备注', label: '备注', type: 'text' },
]

const filteredItems = computed(() => {
  if (!selectedGroupId.value) return []
  return store.getOptionItemsByGroup(selectedGroupId.value)
})

function handleCountryChange(e) {
  selectedCountryId.value = e.target.value
  selectedGroupId.value = ''
}

function onAddGroup() {
  const cpId = selectedCountryId.value
  store['选项组'].push({ 编号: '', 名称: '', 所属国家平台: cpId, 说明: '' })
}

function onUpdateGroup({ index, row }) {
  const idx = store['选项组'].indexOf(countryGroups.value[index])
  if (idx !== -1) store['选项组'][idx] = row
}

function onDeleteGroup({ index }) {
  const idx = store['选项组'].indexOf(countryGroups.value[index])
  if (idx !== -1) store['选项组'].splice(idx, 1)
}

function onAddItem() {
  store['选项值'].push({ 所属分组: selectedGroupId.value, 选项值: '', 显示名: '', 排序: '', 启用: '是', 备注: '' })
}

function onUpdateItem({ index, row }) {
  const idx = store['选项值'].indexOf(filteredItems.value[index])
  if (idx !== -1) store['选项值'][idx] = row
}

function onDeleteItem({ index }) {
  const idx = store['选项值'].indexOf(filteredItems.value[index])
  if (idx !== -1) store['选项值'].splice(idx, 1)
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <h1 class="text-2xl font-bold mb-4">选项管理</h1>

    <div class="mb-4">
      <label class="label py-1"><span class="label-text">选择国家平台</span></label>
      <select class="select select-bordered w-full max-w-xs" :value="selectedCountryId" @change="handleCountryChange">
        <option value="">-- 选择国家 --</option>
        <option v-for="c in enabledCountries" :key="c.编号" :value="c.编号">
          {{ c.国家 }} - {{ c.平台 }} ({{ c.货币 }})
        </option>
      </select>
    </div>

    <template v-if="selectedCountryId">
      <div class="flex-1 min-h-0 space-y-6 overflow-y-auto">
        <div class="card card-sm bg-base-100 border border-base-300">
          <div class="card-body">
            <h2 class="card-title text-lg">选项组</h2>
            <EditableTable
              :columns="groupColumns" :rows="countryGroups" id-key="编号"
              @add="onAddGroup" @update="onUpdateGroup" @delete="onDeleteGroup"
            />
          </div>
        </div>

        <div class="card card-sm bg-base-100 border border-base-300">
          <div class="card-body">
            <h2 class="card-title text-lg">
              选项值
              <select v-model="selectedGroupId" class="select select-bordered select-sm ml-4">
                <option value="">-- 选择选项组 --</option>
                <option v-for="g in countryGroups" :key="g.编号" :value="g.编号">
                  {{ g.名称 }} ({{ g.编号 }})
                </option>
              </select>
            </h2>
            <EditableTable
              v-if="selectedGroupId"
              :columns="itemColumns" :rows="filteredItems" id-key="选项值"
              @add="onAddItem" @update="onUpdateItem" @delete="onDeleteItem"
            />
            <p v-else class="text-base-content/50 text-sm">请先选择一个选项组</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
