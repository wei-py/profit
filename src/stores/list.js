import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as XLSX from 'xlsx'
import { buildListWorkbookBuffer } from '@/services/excel-writer'

export const useListStore = defineStore('list', () => {
  /** @type {import('vue').Ref<string>} 当前列表文件路径 */
  const filePath = ref('')
  /** @type {import('vue').Ref<Array<object>>} 记录列表 */
  const records = ref([])
  /** @type {import('vue').Ref<boolean>} 是否正在加载 */
  const loading = ref(false)
  /** @type {import('vue').Ref<string>} 错误信息 */
  const error = ref('')

  /** 默认导出列头映射 */
  const defaultHeaders = [
    { key: 'id', prop: 'id' },
    { key: 'name', prop: 'name' },
    { key: 'sku', prop: 'sku' },
    { key: 'cost', prop: 'cost' },
    { key: 'weight', prop: 'weight' },
    { key: 'images', prop: 'images' },
    { key: 'variants', prop: 'variants' },
  ]

  /**
   * 从二进制缓冲区加载列表数据。
   * @param {ArrayBuffer} buffer - 文件二进制数据
   * @param {string} [path] - 文件路径
   */
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

  /**
   * 添加一条记录。
   * @param {object} record - 记录对象
   */
  function addRecord(record) {
    records.value.push({ id: Date.now().toString(), ...record })
  }

  /**
   * 按 ID 删除记录。
   * @param {string} id - 记录 ID
   */
  function removeRecord(id) {
    records.value = records.value.filter(r => r.id !== id)
  }

  /**
   * 按 ID 更新记录数据。
   * @param {string} id - 记录 ID
   * @param {object} data - 更新的数据
   */
  function updateRecord(id, data) {
    const idx = records.value.findIndex(r => r.id === id)
    if (idx !== -1) {
      records.value[idx] = { ...records.value[idx], ...data }
    }
  }

  /**
   * 获取记录列表的导出二进制缓冲区。
   * @param {Array} [headers] - 列头映射
   * @returns {Uint8Array} xlsx 二进制数据
   */
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

  /** 清空所有状态至初始值。 */
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
