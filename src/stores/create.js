import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { execute } from '@/services/rule-engine'
import { useConfigStore } from './config'

export const useCreateStore = defineStore('create', () => {
  const selectedPresetId = ref('')
  const userInputs = ref({})
  const results = ref({})
  const errors = ref([])
  const calculating = ref(false)

  const configStore = useConfigStore()

  const selectedPreset = computed(() =>
    configStore.config.presets.find(p => p.presetId === selectedPresetId.value),
  )

  const currentRuleSetId = computed(() =>
    selectedPreset.value?.ruleSetId || '',
  )

  const currentRules = computed(() =>
    configStore.getRulesByRuleSet(currentRuleSetId.value),
  )

  function selectPreset(presetId) {
    selectedPresetId.value = presetId
    userInputs.value = {}
    results.value = {}
    errors.value = []

    const preset = configStore.config.presets.find(p => p.presetId === presetId)
    if (preset && preset.params) {
      for (const param of preset.params) {
        userInputs.value[param.fieldKey] = param.defaultValue ?? ''
      }
    }
  }

  function updateInput(fieldKey, value) {
    userInputs.value[fieldKey] = value
  }

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

  function getRecord() {
    return {
      ...userInputs.value,
      ...results.value,
    }
  }

  function reset() {
    selectedPresetId.value = ''
    userInputs.value = {}
    results.value = {}
    errors.value = []
  }

  return {
    selectedPresetId,
    userInputs,
    results,
    errors,
    calculating,
    selectedPreset,
    currentRules,
    selectPreset,
    updateInput,
    calculate,
    getRecord,
    reset,
  }
})
