import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { readWorkbookBuffer } from '@/services/excel-reader'
import { buildWorkbookBuffer } from '@/services/excel-writer'

export const useConfigStore = defineStore('config', () => {
  /** @type {import('vue').Ref<string>} 当前配置文件路径 */
  const filePath = ref('')
  /** @type {import('vue').Ref<ArrayBuffer|null>} 当前工作簿原始数据 */
  const workbook = ref(null)
  /** @type {import('vue').Ref<boolean>} 是否正在加载 */
  const loading = ref(false)
  /** @type {import('vue').Ref<string>} 错误信息 */
  const error = ref('')

  /** @type {import('vue').Ref<object>} 完整配置对象 */
  const config = ref({
    presets: [],
    optionGroups: [],
    fields: [],
    ruleSets: [],
    rules: [],
    lookupTables: [],
    countryPlatforms: [],
  })

  /** 配置是否已加载 */
  const loaded = computed(() => workbook.value !== null)

  /** 输入型字段列表（ruleMode === 'input'） */
  const inputFields = computed(() =>
    config.value.fields.filter(f => f.ruleMode === 'input'),
  )

  /** 输出型字段列表（ruleMode === 'output'） */
  const outputFields = computed(() =>
    config.value.fields.filter(f => f.ruleMode === 'output'),
  )

  /** 已启用的预设列表 */
  const enabledPresets = computed(() =>
    config.value.presets.filter(p => p.enabled),
  )

  /** 已启用的规则列表 */
  const enabledRules = computed(() =>
    config.value.rules.filter(r => r.enabled),
  )

  /**
   * 按 ID 获取选项分组。
   * @param {string} groupId - 分组 ID
   * @returns {object | undefined} 匹配的分组对象
   */
  function getOptionGroup(groupId) {
    return config.value.optionGroups.find(g => g.groupId === String(groupId))
  }

  /**
   * 按字段键获取字段定义。
   * @param {string} fieldKey - 字段键
   * @returns {object | undefined} 匹配的字段对象
   */
  function getField(fieldKey) {
    return config.value.fields.find(f => f.fieldKey === fieldKey)
  }

  /**
   * 按 ID 获取规则集。
   * @param {string} ruleSetId - 规则集 ID
   * @returns {object | undefined} 匹配的规则集对象
   */
  function getRuleSet(ruleSetId) {
    return config.value.ruleSets.find(r => r.ruleSetId === String(ruleSetId))
  }

  /**
   * 按规则集 ID 获取其下所有规则。
   * @param {string} ruleSetId - 规则集 ID
   * @returns {Array} 规则列表
   */
  function getRulesByRuleSet(ruleSetId) {
    return config.value.rules.filter(r => r.ruleSetId === String(ruleSetId))
  }

  /**
   * 按 ID 获取国家平台。
   * @param {string} cpId - 国家平台 ID
   * @returns {object | undefined} 匹配的国家平台对象
   */
  function getCountryPlatform(cpId) {
    return config.value.countryPlatforms.find(cp => cp.cpId === String(cpId))
  }

  /** 已启用的国家平台列表 */
  const enabledCountryPlatforms = computed(() =>
    config.value.countryPlatforms.filter(cp => cp.enabled),
  )

  /**
   * 迁移旧格式预设中的 country/platform 字段为 cpId 引用。
   */
  function migratePresetCountries() {
    const presetsWithCountry = config.value.presets.filter(p => p.country && !p.cpId)
    if (presetsWithCountry.length === 0)
      return

    const seen = new Map()
    for (const cp of config.value.countryPlatforms) {
      seen.set(`${cp.country}||${cp.platform}`, cp.cpId)
    }

    let nextIdx = config.value.countryPlatforms.length
    for (const p of presetsWithCountry) {
      const key = `${p.country}||${p.platform}`
      let cpId = seen.get(key)
      if (!cpId) {
        cpId = `cp_${String(++nextIdx).padStart(3, '0')}`
        config.value.countryPlatforms.push({
          cpId,
          country: p.country,
          platform: p.platform,
          currency: '',
          enabled: true,
        })
        seen.set(key, cpId)
      }
      p.cpId = cpId
      delete p.country
      delete p.platform
    }
  }

  /**
   * 从二进制缓冲区加载配置。
   * @param {ArrayBuffer} buffer - 文件二进制数据
   * @param {string} [path] - 文件路径
   */
  function loadFromBuffer(buffer, path) {
    loading.value = true
    error.value = ''
    try {
      const data = readWorkbookBuffer(buffer)
      config.value = data
      filePath.value = path || ''
      workbook.value = buffer
      migratePresetCountries()
    }
    catch (e) {
      error.value = e.message || '加载配置失败'
      throw e
    }
    finally {
      loading.value = false
    }
  }

  /**
   * 获取当前配置的导出二进制缓冲区。
   * @returns {Uint8Array} xlsx 二进制数据
   */
  function getExportBuffer() {
    return buildWorkbookBuffer(config.value)
  }

  /**
   * 设置文件路径。
   * @param {string} path - 文件路径
   */
  function setFilePath(path) {
    filePath.value = path
  }

  /** 清空所有状态至初始值。 */
  function clear() {
    filePath.value = ''
    workbook.value = null
    error.value = ''
    config.value = {
      presets: [],
      optionGroups: [],
      fields: [],
      ruleSets: [],
      rules: [],
      lookupTables: [],
      countryPlatforms: [],
    }
  }

  return {
    filePath,
    workbook,
    loading,
    error,
    config,
    loaded,
    inputFields,
    outputFields,
    enabledPresets,
    enabledRules,
    enabledCountryPlatforms,
    getOptionGroup,
    getField,
    getRuleSet,
    getRulesByRuleSet,
    getCountryPlatform,
    loadFromBuffer,
    getExportBuffer,
    setFilePath,
    clear,
    migratePresetCountries,
  }
})
