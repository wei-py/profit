import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { execute } from '@/services/rule-engine'
import { useConfigStore } from './config'

export const useCreateStore = defineStore('create', () => {
  const configStore = useConfigStore()

  const selectedCountryId = ref('')
  const selectedTemplateId = ref('')
  const productInputs = ref({})
  const results = ref({})
  const errors = ref([])
  const calculating = ref(false)
  const basicInfo = ref({ name: '', sku: '', cost: '', weight: '' })
  const images = ref('')

  // 变体
  const variantRows = ref([])
  let variantIdCounter = 0

  // SKU 数据
  const skuData = ref({})
  const skuResults = ref({})

  /** 笛卡尔积生成 SKU 组合 */
  const generatedSkuCombos = computed(() => {
    const rows = variantRows.value.filter(r => r.key.trim() && r.options.trim())
    if (!rows.length) return []
    const arrays = rows.map(r => r.options.split(',').map(s => s.trim()).filter(Boolean))
    if (arrays.some(a => !a.length)) return []
    const result = []
    function cartesian(idx, current) {
      if (idx === arrays.length) {
        const key = current.join(',')
        const values = {}
        rows.forEach((r, i) => { values[r.key.trim()] = current[i] })
        result.push({ key, values })
        return
      }
      for (const val of arrays[idx]) cartesian(idx + 1, [...current, val])
    }
    cartesian(0, [])
    return result
  })

  /** 当前选中模板 */
  const selectedTemplate = computed(() =>
    configStore['计算模板'].find(t => t.编号 === selectedTemplateId.value),
  )

  /** 当前费用规则 */
  const currentRules = computed(() =>
    configStore.getFeeRulesByTemplate(selectedTemplateId.value),
  )

  /** 选择国家+模板 */
  function selectTemplate(countryId, templateId) {
    selectedCountryId.value = countryId
    selectedTemplateId.value = templateId
    productInputs.value = {}
    results.value = {}
    errors.value = []
    basicInfo.value = { name: '', sku: '', cost: '', weight: '' }
    images.value = ''
    skuData.value = {}
    skuResults.value = {}
    variantRows.value = []
    variantIdCounter = 0

    // 加载模板参数默认值
    const params = configStore.getTemplateParams(templateId)
    for (const p of params) {
      productInputs.value[p.字段键] = p.默认值
    }
  }

  function updateProductInput(fieldKey, value) {
    productInputs.value[fieldKey] = value
  }

  /** 逐 SKU 计算 */
  function calculate() {
    calculating.value = true
    errors.value = []

    try {
      const combos = generatedSkuCombos.value
      const defaults = { ...basicInfo.value, ...productInputs.value }
      const lookupTbls = configStore.lookupTables

      if (combos.length > 0) {
        const newSkuResults = {}
        for (const combo of combos) {
          const sd = skuData.value[combo.key] || {}
          const mergedInputs = { ...defaults, ...(sd.overrides || {}) }
          try {
            const { results: r, errors: e } = execute(currentRules.value, lookupTbls, mergedInputs)
            newSkuResults[combo.key] = r
            errors.value.push(...e.map(err => `[${combo.key}] ${err}`))
          }
          catch (e) {
            errors.value.push(`[${combo.key}] ${e.message}`)
          }
        }
        skuResults.value = newSkuResults
        results.value = {}
      }
      else {
        const { results: r, errors: e } = execute(currentRules.value, lookupTbls, defaults)
        results.value = r
        errors.value = e
        skuResults.value = {}
      }
    }
    catch (e) {
      errors.value = [e.message]
    }
    finally {
      calculating.value = false
    }
  }

  // ── 变体操作 ──
  function addVariantRow() {
    variantRows.value.push({ id: ++variantIdCounter, key: '', options: '' })
  }
  function updateVariantRow(id, data) {
    const idx = variantRows.value.findIndex(r => r.id === id)
    if (idx !== -1) variantRows.value[idx] = { ...variantRows.value[idx], ...data }
  }
  function deleteVariantRow(id) {
    variantRows.value = variantRows.value.filter(r => r.id !== id)
  }

  // ── SKU 数据操作 ──
  function initSkuData() {
    const combos = generatedSkuCombos.value
    const merged = { ...skuData.value }
    for (const combo of combos) {
      if (!merged[combo.key]) merged[combo.key] = { sku: '', images: '', overrides: {} }
    }
    skuData.value = merged
  }
  function updateSkuField(comboKey, field, value) {
    if (!skuData.value[comboKey]) return
    if (field === 'sku' || field === 'images') {
      skuData.value[comboKey][field] = value
    }
    else {
      if (!skuData.value[comboKey].overrides) skuData.value[comboKey].overrides = {}
      skuData.value[comboKey].overrides[field] = value
    }
    skuData.value = { ...skuData.value }
  }
  function updateSkuImages(comboKey, imagesString) {
    updateSkuField(comboKey, 'images', imagesString)
  }

  function getRecord() {
    return {
      ...basicInfo.value,
      ...productInputs.value,
      ...results.value,
      images: images.value,
      skuResults: skuResults.value,
      variants: variantRows.value,
      skuData: skuData.value,
    }
  }

  function reset() {
    selectedCountryId.value = ''
    selectedTemplateId.value = ''
    productInputs.value = {}
    results.value = {}
    errors.value = []
    basicInfo.value = { name: '', sku: '', cost: '', weight: '' }
    images.value = ''
    skuData.value = {}
    skuResults.value = {}
    variantRows.value = []
    variantIdCounter = 0
  }

  return {
    selectedCountryId, selectedTemplateId, productInputs, results, errors, calculating,
    basicInfo, images, variantRows, skuData, skuResults,
    generatedSkuCombos, selectedTemplate, currentRules,
    selectTemplate, updateProductInput, calculate, getRecord, reset,
    addVariantRow, updateVariantRow, deleteVariantRow,
    initSkuData, updateSkuField, updateSkuImages,
  }
})
