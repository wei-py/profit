import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { execute } from '@/services/rule-engine'
import { useConfigStore } from './config'

export const useCreateStore = defineStore('create', () => {
  const configStore = useConfigStore()

  // ── 商品基本信息 ──
  const productId = ref('')
  const productName = ref('')
  const selectedCountryId = ref('')
  const selectedTemplateId = ref('')

  // ── 商品级字段值 ──
  const productInputs = reactive({})

  // ── 变体 ──
  const variantAttributes = ref([]) // [{name:'颜色', values:'红,蓝'}, ...]
  const skuPrefix = ref('')         // SKU 前缀

  // ── SKU ──
  const skus = reactive([]) // [{key, attrs, inputs, results, error, images, skuCode}]

  const calculating = ref(false)
  const lastCalculatedAt = ref('')

  // ── 计算属性 ──
  const selectedTemplate = computed(() =>
    configStore['计算模板'].find(t => t.编号 === selectedTemplateId.value),
  )

  const currentRules = computed(() =>
    configStore.getFeeRulesByTemplate(selectedTemplateId.value),
  )

  const productFields = computed(() =>
    selectedCountryId.value
      ? configStore.getFieldsByCountry(selectedCountryId.value).filter(f => f.层级 === '商品级' && f.输入输出 === '输入')
      : [],
  )

  const skuInputFields = computed(() =>
    selectedCountryId.value
      ? configStore.getFieldsByCountry(selectedCountryId.value).filter(f => f.层级 === 'SKU级' && f.输入输出 === '输入')
      : [],
  )

  const skuOutputFields = computed(() =>
    selectedCountryId.value
      ? configStore.getFieldsByCountry(selectedCountryId.value).filter(f => f.层级 === 'SKU级' && f.输入输出 === '输出')
      : [],
  )

  // ── 选择国家+模板 ──
  function selectCountry(countryId) {
    selectedCountryId.value = countryId
    selectedTemplateId.value = ''
    resetForm()
  }

  function selectTemplate(templateId) {
    selectedTemplateId.value = templateId
    resetForTemplate()
  }

  function resetForm() {
    productId.value = ''
    productName.value = ''
    for (const k of Object.keys(productInputs)) delete productInputs[k]
    variantAttributes.value = []
    skus.splice(0, skus.length)
    calculating.value = false
    lastCalculatedAt.value = ''
  }

  function resetForTemplate() {
    for (const k of Object.keys(productInputs)) delete productInputs[k]
    variantAttributes.value = []
    skus.splice(0, skus.length)
    calculating.value = false
    lastCalculatedAt.value = ''

    // 加载默认值（从选项组取第一个，或模板参数）
    for (const f of productFields.value) {
      if (f.默认值) productInputs[f.字段键] = f.默认值
      else if (f.类型 === '下拉' && f.选项组编号) {
        const items = configStore.getOptionItemsByGroup(f.选项组编号)
        if (items.length) productInputs[f.字段键] = items[0].选项值
      }
      else if (f.类型 === '数字') productInputs[f.字段键] = ''
      else productInputs[f.字段键] = ''
    }
  }

  // ── 变体操作 ──
  function addVariantAttribute() {
    variantAttributes.value = [...variantAttributes.value, { name: '', values: '' }]
  }

  function updateVariantAttribute(index, attr) {
    const arr = [...variantAttributes.value]
    arr[index] = { ...arr[index], ...attr }
    variantAttributes.value = arr
  }

  function removeVariantAttribute(index) {
    variantAttributes.value = variantAttributes.value.filter((_, i) => i !== index)
  }

  // ── 笛卡尔积生成 SKU ──
  function generateSkus() {
    const attrs = variantAttributes.value
      .filter(a => a.name.trim() && a.values.trim())
      .map(a => ({ name: a.name.trim(), values: a.values.split(',').map(s => s.trim()).filter(Boolean) }))

    const prefix = skuPrefix.value

    if (!attrs.length) {
      skus.splice(0, skus.length, {
        key: productName.value || '默认',
        attrs: {},
        inputs: makeDefaultSkuInputs(),
        results: {},
        error: '',
        images: '',
        skuCode: prefix ? `${prefix}001` : '',
      })
      return
    }

    const combos = attrs.reduce((rows, attr) =>
      rows.flatMap(row => attr.values.map(v => ({ ...row, [attr.name]: v }))),
      [{}],
    )

    const oldSkus = {}
    for (const s of skus) {
      if (s.key) oldSkus[s.key] = s.inputs
    }

    const newSkus = combos.map((combo, idx) => {
      const key = attrs.map(a => combo[a.name]).join(',')
      const num = String(idx + 1).padStart(3, '0')
      const parts = attrs.map(a => combo[a.name]).join('-')
      const code = prefix ? `${prefix}${num}-${parts}` : `${num}-${parts}`
      return {
        key,
        attrs: combo,
        inputs: oldSkus[key] || makeDefaultSkuInputs(),
        results: {},
        error: '',
        images: '',
        skuCode: code,
      }
    })
    skus.splice(0, skus.length, ...newSkus)
  }

  function makeDefaultSkuInputs() {
    const inputs = {}
    for (const f of skuInputFields.value) {
      if (f.默认值) inputs[f.字段键] = f.默认值
      else inputs[f.字段键] = ''
    }
    return inputs
  }

  function updateSkuInput(skuIndex, fieldKey, value) {
    if (!skus[skuIndex]) return
    skus[skuIndex].inputs[fieldKey] = value
  }

  function updateSkuField(skuIndex, field, value) {
    if (!skus[skuIndex]) return
    if (field === 'sku') skus[skuIndex].skuCode = value
    else if (field === 'images') skus[skuIndex].images = value
    else updateSkuInput(skuIndex, field, value)
  }

  // ── 计算 ──
  function calculateAll() {
    calculating.value = true

    // 确保已生成 SKU
    if (!skus.length) generateSkus()

    const rules = currentRules.value
    const tables = configStore.lookupTables

    for (const sku of skus) {
      try {
        const merged = { ...productInputs, ...sku.inputs }
        const { results, errors, traces } = execute(rules, tables, merged)
        sku.results = results
        sku.traces = traces
        sku.error = errors.length ? errors.join('; ') : ''
      }
      catch (e) {
        sku.error = e.message
        sku.results = {}
      }
    }

    calculating.value = false
    lastCalculatedAt.value = new Date().toISOString().slice(0, 19).replace('T', ' ')
  }

  // ── 展平为保存行 ──
  function productRows() {
    const now = lastCalculatedAt.value || new Date().toISOString().slice(0, 10)
    const cp = configStore['国家平台'].find(c => c.编号 === selectedCountryId.value)

    return skus.map(sku => ({
      '商品ID': productId.value,
      '商品名称': productName.value,
      '国家平台编号': selectedCountryId.value,
      '模板编号': selectedTemplateId.value,
      'SKU码': sku.skuCode || '',
      ...sku.attrs,
      ...productInputs,
      ...sku.inputs,
      ...sku.results,
      '图片': sku.images || '',  // 写入时嵌入浮动画片，单元格文本留空
      '计算时间': now,
    }))
  }

  function reset() {
    selectedCountryId.value = ''
    selectedTemplateId.value = ''
    resetForm()
  }

  return {
    productId, productName, selectedCountryId, selectedTemplateId,
    productInputs, variantAttributes, skus, skuPrefix, calculating, lastCalculatedAt,
    selectedTemplate, currentRules, productFields, skuInputFields, skuOutputFields,
    selectCountry, selectTemplate, reset, resetForm,
    addVariantAttribute, updateVariantAttribute, removeVariantAttribute,
    generateSkus, updateSkuInput, updateSkuField, calculateAll, productRows,
  }
})
