import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { readWorkbookBuffer } from '@/services/excel-reader'
import { buildWorkbookBuffer } from '@/services/excel-writer'

export const useConfigStore = defineStore('config', () => {
  const filePath = ref('')
  const workbook = ref(null)
  const loading = ref(false)
  const error = ref('')

  // 核心数据（key 名与 Excel sheet 名一致）
  const 国家平台 = ref([])
  const 计算字段 = ref([])
  const 选项组 = ref([])
  const 选项值 = ref([])
  const 计算模板 = ref([])
  const 费用规则 = ref([])
  const 模板参数 = ref([])
  const lookupTables = ref({})

  const loaded = computed(() => 国家平台.value.length > 0)

  /** @param {ArrayBuffer} buffer */
  async function loadFromBuffer(buffer) {
    loading.value = true
    error.value = ''
    try {
      const config = readWorkbookBuffer(buffer)
      国家平台.value = config['国家平台'] || []
      计算字段.value = config['计算字段'] || []
      选项组.value = config['选项组'] || []
      选项值.value = config['选项值'] || []
      计算模板.value = config['计算模板'] || []
      费用规则.value = config['费用规则'] || []
      模板参数.value = config['模板参数'] || []
      lookupTables.value = config.lookupTables || {}
      workbook.value = buffer
    }
    catch (e) {
      error.value = e.message
    }
    finally {
      loading.value = false
    }
  }

  function getExportBuffer() {
    return buildWorkbookBuffer({
      '国家平台': 国家平台.value,
      '计算字段': 计算字段.value,
      '选项组': 选项组.value,
      '选项值': 选项值.value,
      '计算模板': 计算模板.value,
      '费用规则': 费用规则.value,
      '模板参数': 模板参数.value,
      lookupTables: lookupTables.value,
    })
  }

  // ── 便捷查询 ──

  /** 某国家下的启用模板 */
  function getTemplatesByCountry(cpId) {
    return 计算模板.value.filter(t => t.所属国家平台 === cpId && (t.启用 === '是' || t.启用 === 'TRUE'))
  }

  /** 某模板下的费用规则（按计算顺序排序） */
  function getFeeRulesByTemplate(templateId) {
    return 费用规则.value
      .filter(r => r.所属模板 === templateId)
      .sort((a, b) => Number(a.计算顺序) - Number(b.计算顺序))
  }

  /** 某国家下的字段 */
  function getFieldsByCountry(cpId) {
    return 计算字段.value.filter(f => f.所属国家平台 === cpId)
  }

  /** 某国家下的选项组 */
  function getOptionGroupsByCountry(cpId) {
    return 选项组.value.filter(g => g.所属国家平台 === cpId)
  }

  /** 某选项组下的选项值 */
  function getOptionItemsByGroup(groupId) {
    return 选项值.value.filter(i => i.所属分组 === groupId)
  }

  /** 按字段键查字段定义 */
  function getField(fieldKey, cpId) {
    return 计算字段.value.find(f => f.字段键 === fieldKey && f.所属国家平台 === cpId)
  }

  /** 某模板的参数默认值 */
  function getTemplateParams(templateId) {
    return 模板参数.value.filter(p => p.模板编号 === templateId)
  }

  /** 某国家下的启用字段 */
  function getEnabledFieldsByCountry(cpId) {
    return 计算字段.value.filter(f => f.所属国家平台 === cpId && (f.启用 === '是' || f.启用 === 'TRUE' || !f.启用))
  }

  function clear() {
    filePath.value = ''
    workbook.value = null
    国家平台.value = []
    计算字段.value = []
    选项组.value = []
    选项值.value = []
    计算模板.value = []
    费用规则.value = []
    模板参数.value = []
    lookupTables.value = {}
  }

  return {
    filePath, workbook, loading, error, loaded,
    '国家平台': 国家平台, '计算字段': 计算字段, '选项组': 选项组, '选项值': 选项值,
    '计算模板': 计算模板, '费用规则': 费用规则, '模板参数': 模板参数, lookupTables,
    loadFromBuffer, getExportBuffer, clear,
    getTemplatesByCountry, getFeeRulesByTemplate, getFieldsByCountry,
    getOptionGroupsByCountry, getOptionItemsByGroup, getField, getTemplateParams,
    getEnabledFieldsByCountry,
  }
})
