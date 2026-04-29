<script setup>
import { computed, ref, watch } from 'vue'
import EditableTable from '@/components/common/EditableTable.vue'
import { useFileIO } from '@/composables/useFileIO'
import { useConfigStore } from '@/stores/config'
import { validateOptionGroup } from '@/utils/validate'

const configStore = useConfigStore()
const { openConfigExcel, saveConfigExcel } = useFileIO()

/** @type {import('vue').Ref<string>} 当前选中的分组 ID */
const selectedGroupId = ref('')
/** @type {import('vue').Ref<boolean>} 是否显示分组编辑弹窗 */
const showGroupModal = ref(false)
/** @type {import('vue').Ref<object | null>} 正在编辑的分组对象 */
const editingGroup = ref(null)
/** @type {import('vue').Ref<object>} 分组表单数据 */
const groupForm = ref({ groupName: '', description: '' })
/** @type {import('vue').Ref<string[]>} 分组表单校验错误 */
const groupErrors = ref([])

/** 是否显示无配置提示 */
const showNoConfig = computed(() => !configStore.loaded)

/**
 * 为所有选项项补充 _uid 唯一标识。
 */
function ensureUids() {
  for (const group of configStore.config.optionGroups) {
    for (const item of (group.items || [])) {
      if (!item._uid) {
        item._uid = `uid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      }
    }
  }
}

watch(() => configStore.loaded, (loaded) => {
  if (!loaded)
    return
  ensureUids()
  const cached = localStorage.getItem(CACHE_GROUP_KEY)
  if (cached && configStore.config.optionGroups.some(g => g.groupId === cached)) {
    selectedGroupId.value = cached
  }
}, { immediate: true })

watch(selectedGroupId, (val) => {
  localStorage.setItem(CACHE_GROUP_KEY, val)
})

/** 当前选中的分组对象 */
const selectedGroup = computed(() =>
  configStore.config.optionGroups.find(g => g.groupId === selectedGroupId.value),
)

/** 选项项表格列定义 */
const itemColumns = [
  { key: 'itemLabel', prop: 'itemLabel', label: '显示名' },
  { key: 'itemValue', prop: 'itemValue', label: '值' },
  { key: 'sort', prop: 'sort', label: '排序', type: 'number' },
  { key: 'enabled', prop: 'enabled', label: '启用', type: 'boolean' },
  { key: 'remark', prop: 'remark', label: '备注' },
]

/** 打开新建分组弹窗。 */
function openNewGroup() {
  editingGroup.value = null
  groupForm.value = { groupName: '', description: '' }
  groupErrors.value = []
  showGroupModal.value = true
}

/**
 * 打开编辑分组弹窗。
 * @param {object} group - 待编辑的分组对象
 */
function openEditGroup(group) {
  editingGroup.value = group
  groupForm.value = { groupName: group.groupName, description: group.description }
  groupErrors.value = []
  showGroupModal.value = true
}

/** 校验并保存分组（新建或更新）。 */
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

/**
 * 删除指定分组。
 * @param {object} group - 待删除的分组对象
 */
function deleteGroup(group) {
  configStore.config.optionGroups = configStore.config.optionGroups.filter(g => g.groupId !== group.groupId)
  if (selectedGroupId.value === group.groupId) {
    selectedGroupId.value = ''
  }
}

/** 为当前选中分组添加一条空选项项。 */
function handleItemAdd() {
  if (!selectedGroup.value)
    return
  const newItem = {
    _uid: `uid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    groupId: selectedGroupId.value,
    itemValue: '',
    itemLabel: '',
    sort: (selectedGroup.value.items || []).length + 1,
    enabled: true,
    remark: '',
  }
  selectedGroup.value.items.push(newItem)
}

/**
 * 更新选项项行数据。
 * @param {object} row - 更新后的行数据
 */
function handleItemUpdate(row) {
  if (!selectedGroup.value)
    return
  const idx = selectedGroup.value.items.findIndex(i => i._uid === row._uid)
  if (idx !== -1) {
    selectedGroup.value.items[idx] = row
  }
}

/**
 * 删除选项项。
 * @param {object} row - 待删除的行数据
 */
function handleItemDelete(row) {
  if (!selectedGroup.value)
    return
  selectedGroup.value.items = selectedGroup.value.items.filter(i => i._uid !== row._uid)
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">
        选项
      </h1>
      <div class="flex gap-2" data-tour="option-toolbar">
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

    <div v-else class="flex-1 min-h-0 flex gap-6">
      <div class="w-64 flex-shrink-0 min-h-0">
        <div class="card bg-base-100 border border-base-300 h-full" data-tour="option-group-list">
          <div class="card-body flex-1 flex-col min-h-0 p-3">
            <h3 class="font-medium text-sm mb-1 flex-shrink-0">
              分组
            </h3>
            <div class="flex-1 min-h-0 overflow-y-auto">
              <ul class="menu menu-vertical gap-0.5 w-full">
                <!-- <template v-for="i in 10"> -->
                <li v-for="g in configStore.config.optionGroups" :key="g.groupId">
                  <button
                    :class="{ active: selectedGroupId === g.groupId }"
                    @click="selectedGroupId = g.groupId"
                  >
                    <span>{{ g.groupName }}</span>
                  </button>
                </li>
                <!-- </template> -->
                <li v-if="configStore.config.optionGroups.length === 0">
                  <span class="text-base-content/50">暂无分组</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div class="flex-1 min-w-0 min-h-0 flex flex-col">
        <div v-if="!selectedGroup" class="card bg-base-100 border border-base-300">
          <div class="card-body text-center py-20 text-base-content/50">
            请选择一个分组，或新建一个分组。
          </div>
        </div>

        <div v-else class="card bg-base-100 border border-base-300 flex-1 min-h-0">
          <div class="card-body flex-1 flex-col min-h-0">
            <div data-tour="option-detail-header" class="flex items-center justify-between mb-4 flex-shrink-0">
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

            <div class="flex-1 min-h-0">
              <EditableTable
                :columns="itemColumns"
                :rows="selectedGroup.items || []"
                id-key="_uid"
                @add="handleItemAdd"
                @update="handleItemUpdate"
                @delete="handleItemDelete"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showGroupModal" class="modal modal-open" data-tour="option-edit-modal">
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
