import { defineStore } from 'pinia'
import { ref } from 'vue'
import { readListWorkbook } from '@/services/list-excel-reader'
import { buildListWorkbookBuffer } from '@/services/list-excel-writer'

let _uidCounter = 0
function genUid() {
  return ++_uidCounter
}

export const useListStore = defineStore('list', () => {
  const filePath = ref('')
  const records = ref([])
  const columnOrder = ref([])
  const loading = ref(false)
  const error = ref('')

  async function loadFromBuffer(buffer, p) {
    loading.value = true
    error.value = ''
    if (p)
      filePath.value = p
    try {
      const { records: rows, columnOrder: order } = await readListWorkbook(buffer)
      records.value = rows.map(r => ({ ...r, _uid: genUid() }))
      columnOrder.value = order
    }
    catch (e) {
      error.value = e.message
    }
    finally {
      loading.value = false
    }
  }

  async function getExportBuffer() {
    return await buildListWorkbookBuffer(records.value, columnOrder.value)
  }

  function addRecords(skuRows) {
    for (const row of skuRows) {
      records.value.push({ ...row, _uid: genUid() })
    }
    syncColumnOrder()
  }

  function removeRecord(index) {
    records.value.splice(index, 1)
  }

  function moveRecordToTop(index) {
    if (index <= 0) return
    const [moved] = records.value.splice(index, 1)
    records.value.unshift(moved)
  }

  function moveRecordToBottom(index) {
    if (index >= records.value.length - 1) return
    const [moved] = records.value.splice(index, 1)
    records.value.push(moved)
  }

  function updateRecord(index, data) {
    records.value[index] = { ...records.value[index], ...data }
  }

  function syncColumnOrder() {
    if (!records.value.length) {
      columnOrder.value = []
      return
    }
    const existing = new Set(columnOrder.value)
    const allKeys = new Set()
    for (const row of records.value) {
      for (const k of Object.keys(row)) {
        if (k !== '_uid')
          allKeys.add(k)
      }
    }
    const merged = [...columnOrder.value.filter(k => allKeys.has(k))]
    for (const k of allKeys) {
      if (!existing.has(k))
        merged.push(k)
    }
    columnOrder.value = merged
  }

  function clear() {
    filePath.value = ''
    records.value = []
    columnOrder.value = []
  }

  return {
    filePath,
    records,
    columnOrder,
    loading,
    error,
    loadFromBuffer,
    getExportBuffer,
    addRecords,
    removeRecord,
    moveRecordToTop,
    moveRecordToBottom,
    updateRecord,
    clear,
    syncColumnOrder,
  }
})
