<script setup>
import { computed, ref, watch } from 'vue'
import ImageUploader from '@/components/common/ImageUploader.vue'
import { useFileIO } from '@/composables/useFileIO'
import { useImageHost } from '@/composables/useImageHost'
import { useListStore } from '@/stores/list'

const listStore = useListStore()
const { openListExcel, saveListExcel } = useFileIO()
const { getImageUrls } = useImageHost()

/** @type {import('vue').Ref<string>} 当前选中的记录 ID */
const selectedRecordId = ref('')
/** @type {import('vue').Ref<boolean>} 是否显示详情弹窗 */
const showDetailModal = ref(false)
/** @type {import('vue').Ref<object | null>} 正在编辑的记录 */
const editingRecord = ref(null)
/** @type {import('vue').Ref<object>} 编辑表单数据 */
const editForm = ref({})
/** @type {import('vue').Ref<string[]>} 查看模式下的图片预览 URL */
const viewImageUrls = ref([])

/** 是否显示空文件提示 */
const showNoFile = computed(() => !listStore.filePath && listStore.records.length === 0)

/** 从第一条记录提取的列头列表（排除 id） */
const headers = computed(() => {
  if (listStore.records.length === 0)
    return []
  return Object.keys(listStore.records[0]).filter(k => k !== 'id')
})

/**
 * 删除指定记录。
 * @param {string} id - 记录 ID
 */
function handleDelete(id) {
  // eslint-disable-next-line no-alert
  if (window.confirm('确定删除这条记录吗？')) {
    listStore.removeRecord(id)
    if (selectedRecordId.value === id) {
      selectedRecordId.value = ''
    }
  }
}

/**
 * 打开记录详情弹窗。
 * @param {object} record - 记录对象
 */
function openDetail(record) {
  selectedRecordId.value = record.id
  showDetailModal.value = true
}

/**
 * 打开记录编辑模式。
 * @param {object} record - 记录对象
 */
function openEdit(record) {
  selectedRecordId.value = record.id
  editingRecord.value = record
  editForm.value = { ...record }
  showDetailModal.value = true
}

/** 保存编辑并关闭弹窗。 */
function saveEdit() {
  if (editingRecord.value) {
    listStore.updateRecord(editingRecord.value.id, editForm.value)
  }
  editingRecord.value = null
  editForm.value = {}
  showDetailModal.value = false
}

/**
 * 判断记录是否包含图片。
 * @param {object} record - 记录对象
 * @returns {boolean} 是否有图片
 */
function hasImages(record) {
  return record.images && typeof record.images === 'string' && record.images.trim() !== ''
}

function parseSkuData(record) {
  try {
    if (!record.skuData || typeof record.skuData !== 'string' || !record.skuData.trim())
      return {}
    const obj = JSON.parse(record.skuData)
    if (typeof obj === 'object' && obj !== null && !Array.isArray(obj))
      return obj
    return {}
  }
  catch {
    return {}
  }
}

function hasSkuData(record) {
  const sd = parseSkuData(record)
  return Object.keys(sd).length > 0
}

watch(showDetailModal, async (val) => {
  if (val && !editingRecord.value) {
    const record = listStore.records.find(r => r.id === selectedRecordId.value)
    if (record && hasImages(record)) {
      viewImageUrls.value = await getImageUrls(record.images)
    }
    else {
      viewImageUrls.value = []
    }
  }
})
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">
        列表
      </h1>
      <div class="flex gap-2" data-tour="list-toolbar">
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
      <div v-if="listStore.filePath" data-tour="list-filepath" class="text-sm text-base-content/60 mb-4">
        文件：{{ listStore.filePath }}
      </div>

      <div v-if="listStore.records.length === 0" class="text-center py-20 text-base-content/50">
        暂无记录，请前往“新建”页面添加记录。
      </div>

      <div v-else class="overflow-x-auto" data-tour="list-table">
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

    <div v-if="showDetailModal" class="modal modal-open" data-tour="list-detail-modal">
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
              <ImageUploader v-model="editForm[h]" />
            </template>
            <template v-else-if="h === 'variants' || h === 'skuData'">
              <textarea v-model="editForm[h]" class="textarea textarea-bordered textarea-sm w-full" rows="4" />
            </template>
            <template v-else>
              <input v-model="editForm[h]" type="text" class="input input-bordered input-sm w-full">
            </template>
          </div>
        </div>

        <div v-else class="space-y-2">
          <div v-for="h in headers" :key="h" class="flex">
            <span class="font-medium text-sm w-32 flex-shrink-0">{{ h }}:</span>
            <template v-if="h === 'images' && viewImageUrls.length > 0">
              <div class="flex gap-2 flex-wrap">
                <img
                  v-for="(url, i) in viewImageUrls"
                  :key="i"
                  :src="url"
                  class="w-24 h-24 object-cover rounded border"
                  @error="($event.target).style.display = 'none'"
                >
              </div>
            </template>
            <template v-else-if="h === 'skuData' && hasSkuData(listStore.records.find(r => r.id === selectedRecordId))">
              <table class="table table-xs">
                <thead>
                  <tr>
                    <th class="text-xs">
                      组合
                    </th>
                    <th class="text-xs">
                      SKU款号
                    </th>
                    <th class="text-xs">
                      图片
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(sku, key) in parseSkuData(listStore.records.find(r => r.id === selectedRecordId))" :key="key">
                    <td class="text-xs font-mono">
                      {{ key }}
                    </td>
                    <td class="text-xs">
                      {{ sku.sku || '-' }}
                    </td>
                    <td>
                      <div class="flex gap-1 flex-wrap">
                        <img
                          v-for="(url, i) in (sku.images ? sku.images.split(',').map(s => s.trim()).filter(Boolean) : [])"
                          :key="i"
                          class="w-10 h-10 object-cover rounded border"
                          :src="url"
                          @error="($event.target).style.display = 'none'"
                        >
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
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
