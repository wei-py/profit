import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { readWorkbookBuffer } from '@/services/excel-reader'
import { buildWorkbookBuffer } from '@/services/excel-writer'

export const useConfigStore = defineStore('config', () => {
  const filePath = ref('')
  const workbook = ref(null)
  const loading = ref(false)
  const error = ref('')

  const config = ref({
    presets: [],
    optionGroups: [],
    fields: [],
    ruleSets: [],
    rules: [],
    lookupTables: [],
    countryPlatforms: [],
  })

  const loaded = computed(() => workbook.value !== null)

  const inputFields = computed(() =>
    config.value.fields.filter(f => f.ruleMode === 'input'),
  )

  const outputFields = computed(() =>
    config.value.fields.filter(f => f.ruleMode === 'output'),
  )

  const enabledPresets = computed(() =>
    config.value.presets.filter(p => p.enabled),
  )

  const enabledRules = computed(() =>
    config.value.rules.filter(r => r.enabled),
  )

  function getOptionGroup(groupId) {
    return config.value.optionGroups.find(g => g.groupId === String(groupId))
  }

  function getField(fieldKey) {
    return config.value.fields.find(f => f.fieldKey === fieldKey)
  }

  function getRuleSet(ruleSetId) {
    return config.value.ruleSets.find(r => r.ruleSetId === String(ruleSetId))
  }

  function getRulesByRuleSet(ruleSetId) {
    return config.value.rules.filter(r => r.ruleSetId === String(ruleSetId))
  }

  function getCountryPlatform(cpId) {
    return config.value.countryPlatforms.find(cp => cp.cpId === String(cpId))
  }

  const enabledCountryPlatforms = computed(() =>
    config.value.countryPlatforms.filter(cp => cp.enabled),
  )

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

  function getExportBuffer() {
    return buildWorkbookBuffer(config.value)
  }

  function setFilePath(path) {
    filePath.value = path
  }

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
