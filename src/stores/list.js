import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as XLSX from 'xlsx'
import { buildListWorkbookBuffer } from '@/services/excel-writer'

export const useListStore = defineStore('list', () => {
  const filePath = ref('')
  const records = ref([])
  const loading = ref(false)
  const error = ref('')

  const defaultHeaders = [
    { key: 'id', prop: 'id' },
    { key: 'name', prop: 'name' },
    { key: 'sku', prop: 'sku' },
    { key: 'cost', prop: 'cost' },
    { key: 'weight', prop: 'weight' },
    { key: 'images', prop: 'images' },
    { key: 'variants', prop: 'variants' },
  ]

  function loadFromBuffer(buffer, path) {
    loading.value = true
    error.value = ''
    try {
      const wb = XLSX.read(buffer, { type: 'array' })
      const wsName = wb.SheetNames[0] || 'records'
      const ws = wb.Sheets[wsName]
      if (ws) {
        records.value = XLSX.utils.sheet_to_json(ws, { defval: '' })
      }
      else {
        records.value = []
      }
      filePath.value = path || ''
    }
    catch (e) {
      error.value = e.message || '加载列表失败'
      throw e
    }
    finally {
      loading.value = false
    }
  }

  function addRecord(record) {
    records.value.push({ id: Date.now().toString(), ...record })
  }

  function removeRecord(id) {
    records.value = records.value.filter(r => r.id !== id)
  }

  function updateRecord(id, data) {
    const idx = records.value.findIndex(r => r.id === id)
    if (idx !== -1) {
      records.value[idx] = { ...records.value[idx], ...data }
    }
  }

  function getExportBuffer(headers) {
    let h
    if (headers && headers.length > 0) {
      h = typeof headers[0] === 'string'
        ? headers.map(k => ({ key: k, prop: k }))
        : headers
    }
    else {
      h = defaultHeaders
    }
    return buildListWorkbookBuffer(records.value, h)
  }

  function clear() {
    filePath.value = ''
    records.value = []
    error.value = ''
  }

  return {
    filePath,
    records,
    loading,
    error,
    loadFromBuffer,
    addRecord,
    removeRecord,
    updateRecord,
    getExportBuffer,
    clear,
  }
})
