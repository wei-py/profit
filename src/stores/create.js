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

  const configStore = useConfigStore()

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
      if (skipped.length > 0) {}
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

  /** 执行规则引擎计算，将结果写入 results 和 errors。 */
  function calculate() {
    calculating.value = true
    errors.value = []

    try {
      const { results: engineResults, errors: engineErrors } = execute(
        configStore.config.fields,
        currentRules.value,
        configStore.config.lookupTables,
        userInputs.value,
      )
      results.value = engineResults
      errors.value = engineErrors
    }
    catch (e) {
      errors.value = [e.message || '计算失败']
    }
    finally {
      calculating.value = false
    }
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
      if (skipped.length > 0) {}
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
    selectedPreset,
    currentRules,
    selectPreset,
    updateInput,
    calculate,
    getRecord,
    reset,
    resetToDefaults,
  }
})
