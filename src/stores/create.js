import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { execute } from '@/services/rule-engine'
import { useConfigStore } from './config'

export const useCreateStore = defineStore('create', () => {
  /** @type {import('vue').Ref<string>} 当前选中的预设 ID */
  const selectedPresetId = ref('')
  /** @type {import('vue').Ref<object>} 用户输入键值对 */
  const userInputs = ref({})
  /** @type {import('vue').Ref<object>} 计算结果 */
  const results = ref({})
  /** @type {import('vue').Ref<string[]>} 计算错误列表 */
  const errors = ref([])
  /** @type {import('vue').Ref<boolean>} 是否正在计算中 */
  const calculating = ref(false)
  /** @type {import('vue').Ref<object>} 基础信息（名称、SKU、成本、重量） */
  const basicInfo = ref({ name: '', sku: '', cost: '', weight: '' })
  /** @type {import('vue').Ref<string>} 图片 URL（逗号分隔） */
  const images = ref('')
  /** @type {import('vue').Ref<string>} 变体 JSON 字符串 */
  const variants = ref('')
  /** @type {import('vue').Ref<string>} SKU 数据 JSON（每变体组合的 sku/images/overrides） */
  const skuData = ref('{}')
  /** @type {import('vue').Ref<object>} 每 SKU 计算结果（内存态，不持久化） */
  const skuResults = ref({})

  let variantIdCounter = 0
  let skuDataObj = {}

  const configStore = useConfigStore()

  function parseVariantRows(json) {
    if (!json || !json.trim())
      return []
    try {
      const obj = JSON.parse(json)
      if (typeof obj !== 'object' || obj === null || Array.isArray(obj))
        return []
      return Object.entries(obj).map(([key, val]) => ({
        id: ++variantIdCounter,
        key,
        options: Array.isArray(val) ? val.join(',') : String(val),
      }))
    }
    catch {
      return []
    }
  }

  function serializeVariantRows(rows) {
    const obj = {}
    for (const r of rows) {
      if (r.key.trim()) {
        obj[r.key.trim()] = r.options.split(',').map(s => s.trim()).filter(Boolean)
      }
    }
    return Object.keys(obj).length ? JSON.stringify(obj, null, 2) : ''
  }

  /** @type {import('vue').Ref<Array<{ id: number, key: string, options: string }>>} */
  const variantRows = ref(parseVariantRows(variants.value))

  /** 从 variantRows 笛卡尔积生成所有变体组合 */
  const generatedSkuCombos = computed(() => {
    const rows = variantRows.value.filter(r => r.key.trim() && r.options.trim())
    if (rows.length === 0)
      return []
    const arrays = rows.map(r => r.options.split(',').map(s => s.trim()).filter(Boolean))
    if (arrays.some(a => a.length === 0))
      return []
    const result = []
    function cartesian(idx, current) {
      if (idx === arrays.length) {
        const key = current.join(',')
        const values = {}
        rows.forEach((r, i) => {
          values[r.key.trim()] = current[i]
        })
        result.push({ key, values })
        return
      }
      for (const val of arrays[idx]) {
        cartesian(idx + 1, [...current, val])
      }
    }
    cartesian(0, [])
    return result
  })

  /** 所有可在 SKU 层覆盖的字段键（basicInfo 字段 + preset param fieldKeys） */
  const allOverrideFieldKeys = computed(() => {
    const keys = ['cost', 'weight']
    const preset = configStore.config.presets.find(p => p.presetId === selectedPresetId.value)
    if (preset && preset.params) {
      for (const param of preset.params) {
        if (param.fieldKey && !keys.includes(param.fieldKey)) {
          keys.push(param.fieldKey)
        }
      }
    }
    return keys
  })

  /** 当前选中的预设对象 */
  const selectedPreset = computed(() =>
    configStore.config.presets.find(p => p.presetId === selectedPresetId.value),
  )

  /** 当前预设关联的规则集 ID */
  const currentRuleSetId = computed(() =>
    selectedPreset.value?.ruleSetId || '',
  )

  /** 当前规则集下的规则列表 */
  const currentRules = computed(() =>
    configStore.getRulesByRuleSet(currentRuleSetId.value),
  )

  /**
   * 选择预设并初始化输入参数为默认值。
   * @param {string} presetId - 预设 ID
   */
  function selectPreset(presetId) {
    selectedPresetId.value = presetId
    userInputs.value = {}
    results.value = {}
    errors.value = []
    basicInfo.value = { name: '', sku: '', cost: '', weight: '' }
    images.value = ''
    variants.value = ''
    skuData.value = '{}'
    skuDataObj = {}
    skuResults.value = {}
    variantIdCounter = 0
    variantRows.value = []

    const preset = configStore.config.presets.find(p => p.presetId === presetId)
    if (preset && preset.params) {
      const skipped = []
      for (const param of preset.params) {
        if (!param.fieldKey) {
          skipped.push(param.paramName || param.paramId)
          continue
        }
        userInputs.value[param.fieldKey] = param.defaultValue ?? ''
      }
      if (skipped.length > 0) {
        // some params lack fieldKey, already handled in UI
      }
    }
  }

  /**
   * 更新某个字段的用户输入值。
   * @param {string} fieldKey - 字段键
   * @param {*} value - 新值
   */
  function updateInput(fieldKey, value) {
    userInputs.value[fieldKey] = value
  }

  /** 执行规则引擎计算，将结果写入 results 和 errors。有变体时逐 SKU 计算。 */
  function calculate() {
    calculating.value = true
    errors.value = []

    try {
      const combos = generatedSkuCombos.value
      const productDefaults = { ...basicInfo.value, ...userInputs.value }

      if (combos.length > 0) {
        const currentSkuData = parseSkuData(skuData.value)
        const newSkuResults = {}
        const newErrors = []

        for (const combo of combos) {
          const sku = currentSkuData[combo.key] || { overrides: {} }
          const mergedInputs = { ...productDefaults, ...(sku.overrides || {}) }
          try {
            const { results: engineResults, errors: engineErrors } = execute(
              configStore.config.fields,
              currentRules.value,
              configStore.config.lookupTables,
              mergedInputs,
            )
            newSkuResults[combo.key] = engineResults
            newErrors.push(...engineErrors.map(e => `[${combo.key}] ${e}`))
          }
          catch (e) {
            newErrors.push(`[${combo.key}] ${e.message || '计算失败'}`)
          }
        }
        skuResults.value = newSkuResults
        results.value = {}
        errors.value = newErrors
      }
      else {
        const { results: engineResults, errors: engineErrors } = execute(
          configStore.config.fields,
          currentRules.value,
          configStore.config.lookupTables,
          productDefaults,
        )
        results.value = engineResults
        errors.value = engineErrors
        skuResults.value = {}
      }
    }
    catch (e) {
      errors.value = [e.message || '计算失败']
    }
    finally {
      calculating.value = false
    }
  }

  function addVariantRow() {
    variantRows.value.push({ id: ++variantIdCounter, key: '', options: '' })
    variants.value = serializeVariantRows(variantRows.value)
    refreshSkuData()
  }

  function updateVariantRow(id, data) {
    const idx = variantRows.value.findIndex(r => r.id === id)
    if (idx !== -1) {
      variantRows.value[idx] = { ...variantRows.value[idx], ...data }
      variants.value = serializeVariantRows(variantRows.value)
      refreshSkuData()
    }
  }

  function deleteVariantRow(id) {
    variantRows.value = variantRows.value.filter(r => r.id !== id)
    variants.value = serializeVariantRows(variantRows.value)
    refreshSkuData()
  }

  function parseSkuData(json) {
    if (!json || !json.trim())
      return {}
    try {
      const obj = JSON.parse(json)
      if (typeof obj === 'object' && obj !== null && !Array.isArray(obj))
        return obj
      return {}
    }
    catch {
      return {}
    }
  }

  function initSkuData() {
    skuDataObj = parseSkuData(skuData.value)
  }
  initSkuData()

  function refreshSkuData() {
    const combos = generatedSkuCombos.value
    const current = parseSkuData(skuData.value)
    const merged = {}
    for (const combo of combos) {
      merged[combo.key] = current[combo.key] || { sku: '', images: '', overrides: {} }
    }
    skuData.value = Object.keys(merged).length ? JSON.stringify(merged) : '{}'
    skuDataObj = merged
  }

  function updateSkuField(comboKey, field, value) {
    if (!skuDataObj[comboKey])
      return
    if (field === 'sku' || field === 'images') {
      skuDataObj[comboKey][field] = value
    }
    else {
      if (!skuDataObj[comboKey].overrides)
        skuDataObj[comboKey].overrides = {}
      skuDataObj[comboKey].overrides[field] = value
    }
    skuData.value = JSON.stringify(skuDataObj)
  }

  function updateSkuImages(comboKey, imagesString) {
    updateSkuField(comboKey, 'images', imagesString)
  }

  /**
   * 获取整合后的完整记录对象，包含基础信息、输入、结果、图片和变体。
   * @returns {object} 完整记录
   */
  function getRecord() {
    return {
      ...basicInfo.value,
      ...userInputs.value,
      ...results.value,
      images: images.value,
      variants: variants.value,
      skuData: skuData.value,
    }
  }

  /** 重置所有状态至初始值。 */
  function reset() {
    selectedPresetId.value = ''
    userInputs.value = {}
    results.value = {}
    errors.value = []
    basicInfo.value = { name: '', sku: '', cost: '', weight: '' }
    images.value = ''
    variants.value = ''
    skuData.value = '{}'
    skuDataObj = {}
    skuResults.value = {}
    variantIdCounter = 0
    variantRows.value = []
  }

  /** 将 userInputs 重置为当前预设默认值，清空 results/errors，保留基础信息和预设选中。 */
  function resetToDefaults() {
    results.value = {}
    errors.value = []
    const preset = configStore.config.presets.find(p => p.presetId === selectedPresetId.value)
    if (preset && preset.params) {
      const skipped = []
      for (const param of preset.params) {
        if (!param.fieldKey) {
          skipped.push(param.paramName || param.paramId)
          continue
        }
        userInputs.value[param.fieldKey] = param.defaultValue ?? ''
      }
      if (skipped.length > 0) {
        // some params lack fieldKey, already handled in UI
      }
    }
  }

  return {
    selectedPresetId,
    userInputs,
    results,
    errors,
    calculating,
    basicInfo,
    images,
    variants,
    variantRows,
    skuData,
    skuResults,
    generatedSkuCombos,
    allOverrideFieldKeys,
    selectedPreset,
    currentRules,
    selectPreset,
    updateInput,
    calculate,
    getRecord,
    reset,
    resetToDefaults,
    addVariantRow,
    updateVariantRow,
    deleteVariantRow,
    refreshSkuData,
    updateSkuField,
    updateSkuImages,
  }
})
