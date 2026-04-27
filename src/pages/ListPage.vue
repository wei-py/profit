<script setup>
import { computed, ref } from 'vue'
import { useFileIO } from '@/composables/useFileIO'
import { useListStore } from '@/stores/list'

const listStore = useListStore()
const { openListExcel, saveListExcel } = useFileIO()

const selectedRecordId = ref('')
const showDetailModal = ref(false)
const editingRecord = ref(null)
const editForm = ref({})

const showNoFile = computed(() => !listStore.filePath && listStore.records.length === 0)

const headers = computed(() => {
  if (listStore.records.length === 0)
    return []
  return Object.keys(listStore.records[0]).filter(k => k !== 'id')
})

function handleDelete(id) {
  // eslint-disable-next-line no-alert
  if (window.confirm('确定删除这条记录吗？')) {
    listStore.removeRecord(id)
    if (selectedRecordId.value === id) {
      selectedRecordId.value = ''
    }
  }
}

function openDetail(record) {
  selectedRecordId.value = record.id
  showDetailModal.value = true
}

function openEdit(record) {
  selectedRecordId.value = record.id
  editingRecord.value = record
  editForm.value = { ...record }
  showDetailModal.value = true
}

function saveEdit() {
  if (editingRecord.value) {
    listStore.updateRecord(editingRecord.value.id, editForm.value)
  }
  editingRecord.value = null
  editForm.value = {}
  showDetailModal.value = false
}

function hasImages(record) {
  return record.images && typeof record.images === 'string' && record.images.trim() !== ''
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">
        列表
      </h1>
      <div class="flex gap-2">
        <button v-if="showNoFile" class="btn btn-primary btn-sm" @click="openListExcel">
          打开列表 Excel
        </button>
        <button v-else class="btn btn-primary btn-sm" @click="openListExcel">
          加载列表 Excel
        </button>
        <button v-if="!showNoFile" class="btn btn-ghost btn-sm" @click="saveListExcel(headers)">
          保存
        </button>
      </div>
    </div>

    <div v-if="showNoFile" class="text-center py-20 text-base-content/50">
      <p class="mb-4">
        当前未加载列表，请先打开或创建列表 Excel 文件。
      </p>
      <button class="btn btn-primary" @click="openListExcel">
        打开列表 Excel
      </button>
    </div>

    <div v-else>
      <div v-if="listStore.filePath" class="text-sm text-base-content/60 mb-4">
        文件：{{ listStore.filePath }}
      </div>

      <div v-if="listStore.records.length === 0" class="text-center py-20 text-base-content/50">
        暂无记录，请前往“新建”页面添加记录。
      </div>

      <div v-else class="overflow-x-auto">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>#</th>
              <th v-for="h in headers.slice(0, 8)" :key="h">
                {{ h }}
              </th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(record, idx) in listStore.records" :key="record.id">
              <td>{{ idx + 1 }}</td>
              <td v-for="h in headers.slice(0, 8)" :key="h" class="max-w-32 truncate">
                {{ record[h] }}
              </td>
              <td>
                <div class="flex gap-1">
                  <button class="btn btn-ghost btn-xs" @click="openDetail(record)">
                    查看
                  </button>
                  <button class="btn btn-ghost btn-xs" @click="openEdit(record)">
                    编辑
                  </button>
                  <button class="btn btn-ghost btn-xs text-error" @click="handleDelete(record.id)">
                    删除
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="showDetailModal" class="modal modal-open">
      <div class="modal-box max-w-3xl">
        <h3 class="text-lg font-bold mb-4">
          记录详情
        </h3>

        <div v-if="editingRecord" class="space-y-3">
          <div v-for="h in headers" :key="h" class="form-control">
            <label class="label py-0">
              <span class="label-text text-xs">{{ h }}</span>
            </label>
            <template v-if="h === 'images'">
              <textarea v-model="editForm[h]" class="textarea textarea-bordered textarea-sm w-full" rows="2" />
              <div v-if="hasImages(editForm)" class="mt-2 flex gap-2 flex-wrap">
                <img
                  v-for="(img, i) in editForm[h].split(',').map(s => s.trim()).filter(Boolean)"
                  :key="i"
                  :src="img"
                  class="w-20 h-20 object-cover rounded border"
                  @error="($event.target).style.display = 'none'"
                >
              </div>
            </template>
            <template v-else-if="h === 'variants'">
              <textarea v-model="editForm[h]" class="textarea textarea-bordered textarea-sm w-full" rows="2" />
            </template>
            <template v-else>
              <input v-model="editForm[h]" type="text" class="input input-bordered input-sm w-full">
            </template>
          </div>
        </div>

        <div v-else class="space-y-2">
          <div v-for="h in headers" :key="h" class="flex">
            <span class="font-medium text-sm w-32 flex-shrink-0">{{ h }}:</span>
            <template v-if="h === 'images' && hasImages(listStore.records.find(r => r.id === selectedRecordId))">
              <div class="flex gap-2 flex-wrap">
                <img
                  v-for="(img, i) in listStore.records.find(r => r.id === selectedRecordId)?.[h].split(',').map(s => s.trim()).filter(Boolean)"
                  :key="i"
                  :src="img"
                  class="w-24 h-24 object-cover rounded border"
                  @error="($event.target).style.display = 'none'"
                >
              </div>
            </template>
            <span v-else class="text-sm">{{ listStore.records.find(r => r.id === selectedRecordId)?.[h] }}</span>
          </div>
        </div>

        <div class="modal-action">
          <button class="btn btn-ghost btn-sm" @click="showDetailModal = false; editingRecord = null">
            关闭
          </button>
          <button v-if="editingRecord" class="btn btn-primary btn-sm" @click="saveEdit">
            保存
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="showDetailModal = false; editingRecord = null" />
    </div>
  </div>
</template>
