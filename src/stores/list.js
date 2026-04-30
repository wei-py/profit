import { defineStore } from 'pinia'
import { ref } from 'vue'
import { readListWorkbook } from '@/services/excel-reader'
import { buildListWorkbookBuffer } from '@/services/excel-writer'

export const useListStore = defineStore('list', () => {
  const filePath = ref('')
  const records = ref([])
  const loading = ref(false)
  const error = ref('')

  async function loadFromBuffer(buffer) {
    loading.value = true
    error.value = ''
    try {
      records.value = readListWorkbook(buffer)
    }
    catch (e) {
      error.value = e.message
    }
    finally {
      loading.value = false
    }
  }

  function getExportBuffer() {
    return buildListWorkbookBuffer(records.value)
  }

  /** 添加一组展平的 SKU 行 */
  function addRecords(skuRows) {
    for (const row of skuRows) {
      records.value.push({ ...row })
    }
  }

  function removeRecord(index) {
    records.value.splice(index, 1)
  }

  function updateRecord(index, data) {
    records.value[index] = { ...records.value[index], ...data }
  }

  function clear() {
    filePath.value = ''
    records.value = []
  }

  return { filePath, records, loading, error,
    loadFromBuffer, getExportBuffer, addRecords, removeRecord, updateRecord, clear }
})
