<script setup>
import { computed, ref } from 'vue'
import EditableTable from '@/components/common/EditableTable.vue'
import { useFileIO } from '@/composables/useFileIO'
import { useConfigStore } from '@/stores/config'
import { validateOptionGroup } from '@/utils/validate'

const configStore = useConfigStore()
const { openConfigExcel, saveConfigExcel } = useFileIO()

const selectedGroupId = ref('')
const showGroupModal = ref(false)
const editingGroup = ref(null)
const groupForm = ref({ groupName: '', description: '' })
const groupErrors = ref([])

const showNoConfig = computed(() => !configStore.loaded)

const selectedGroup = computed(() =>
  configStore.config.optionGroups.find(g => g.groupId === selectedGroupId.value),
)

const itemColumns = [
  { key: 'itemLabel', prop: 'itemLabel', label: '显示名' },
  { key: 'itemValue', prop: 'itemValue', label: '值' },
  { key: 'sort', prop: 'sort', label: '排序', type: 'number' },
  { key: 'enabled', prop: 'enabled', label: '启用', type: 'boolean' },
]

function openNewGroup() {
  editingGroup.value = null
  groupForm.value = { groupName: '', description: '' }
  groupErrors.value = []
  showGroupModal.value = true
}

function openEditGroup(group) {
  editingGroup.value = group
  groupForm.value = { groupName: group.groupName, description: group.description }
  groupErrors.value = []
  showGroupModal.value = true
}

function saveGroup() {
  const errs = validateOptionGroup(groupForm.value)
  if (errs.length > 0) {
    groupErrors.value = errs
    return
  }

  if (editingGroup.value) {
    editingGroup.value.groupName = groupForm.value.groupName
    editingGroup.value.description = groupForm.value.description
  }
  else {
    const id = `grp_${Date.now()}`
    configStore.config.optionGroups.push({
      groupId: id,
      ...groupForm.value,
      items: [],
    })
    selectedGroupId.value = id
  }
  showGroupModal.value = false
}

function deleteGroup(group) {
  configStore.config.optionGroups = configStore.config.optionGroups.filter(g => g.groupId !== group.groupId)
  if (selectedGroupId.value === group.groupId) {
    selectedGroupId.value = ''
  }
}

function handleItemAdd() {
  if (!selectedGroup.value)
    return
  const newItem = {
    groupId: selectedGroupId.value,
    itemValue: '',
    itemLabel: '',
    sort: (selectedGroup.value.items || []).length + 1,
    enabled: true,
  }
  selectedGroup.value.items.push(newItem)
}

function handleItemUpdate(row) {
  if (!selectedGroup.value)
    return
  const idx = selectedGroup.value.items.findIndex(i => i.itemValue === row.itemValue && i.groupId === row.groupId)
  if (idx !== -1) {
    selectedGroup.value.items[idx] = row
  }
}

function handleItemDelete(row) {
  if (!selectedGroup.value)
    return
  selectedGroup.value.items = selectedGroup.value.items.filter(i =>
    !(i.itemValue === row.itemValue && i.groupId === row.groupId),
  )
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">
        选项
      </h1>
      <div class="flex gap-2">
        <button v-if="showNoConfig" class="btn btn-primary btn-sm" @click="openConfigExcel">
          打开配置
        </button>
        <button v-else class="btn btn-primary btn-sm" @click="openNewGroup">
          + 新建分组
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
        <div class="card bg-base-100 border border-base-300">
          <div class="card-body">
            <h2 class="card-title text-base mb-2">
              分组
            </h2>
            <ul class="menu menu-vertical gap-0.5 max-h-96 overflow-auto">
              <li v-for="g in configStore.config.optionGroups" :key="g.groupId">
                <button
                  :class="{ active: selectedGroupId === g.groupId }"
                  @click="selectedGroupId = g.groupId"
                >
                  <span>{{ g.groupName }}</span>
                </button>
              </li>
              <li v-if="configStore.config.optionGroups.length === 0">
                <span class="text-base-content/50">暂无分组</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div class="lg:col-span-2">
        <div v-if="!selectedGroup" class="card bg-base-100 border border-base-300">
          <div class="card-body text-center py-20 text-base-content/50">
            请选择一个分组，或新建一个分组。
          </div>
        </div>

        <div v-else class="card bg-base-100 border border-base-300">
          <div class="card-body">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h2 class="text-lg font-bold">
                  {{ selectedGroup.groupName }}
                </h2>
                <p class="text-sm text-base-content/60">
                  {{ selectedGroup.description }}
                </p>
              </div>
              <div class="flex gap-1">
                <button class="btn btn-ghost btn-sm" @click="openEditGroup(selectedGroup)">
                  编辑
                </button>
                <button class="btn btn-ghost btn-sm text-error" @click="deleteGroup(selectedGroup)">
                  删除
                </button>
              </div>
            </div>

            <EditableTable
              :columns="itemColumns"
              :rows="selectedGroup.items || []"
              id-key="itemValue"
              @add="handleItemAdd"
              @update="handleItemUpdate"
              @delete="handleItemDelete"
            />
          </div>
        </div>
      </div>
    </div>

    <div v-if="showGroupModal" class="modal modal-open">
      <div class="modal-box">
        <h3 class="text-lg font-bold mb-4">
          {{ editingGroup ? '编辑' : '新建' }}分组
        </h3>
        <div class="space-y-3">
          <div v-for="err in groupErrors" :key="err" class="alert alert-warning py-1 text-sm">
            {{ err }}
          </div>
          <div>
            <label class="label text-xs pb-1">名称</label>
            <input v-model="groupForm.groupName" type="text" class="input input-bordered w-full">
          </div>
          <div>
            <label class="label text-xs pb-1">说明</label>
            <textarea v-model="groupForm.description" class="textarea textarea-bordered w-full" rows="2" />
          </div>
        </div>
        <div class="modal-action">
          <button class="btn btn-ghost btn-sm" @click="showGroupModal = false">
            取消
          </button>
          <button class="btn btn-primary btn-sm" @click="saveGroup">
            保存
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="showGroupModal = false" />
    </div>
  </div>
</template>
