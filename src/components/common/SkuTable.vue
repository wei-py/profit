<script setup>
import { computed } from 'vue'
import ImageUploader from './ImageUploader.vue'

const props = defineProps({
  skuCombos: { type: Array, default: () => [] },
  skuData: { type: Object, default: () => ({}) },
  skuResults: { type: Object, default: () => ({}) },
  baseSku: { type: String, default: '' },
  defaultValues: { type: Object, default: () => ({}) },
  allFieldKeys: { type: Array, default: () => [] },
  selectedFieldKeys: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:selectedFieldKeys', 'updateSkuField', 'updateSkuImages'])

const resultKeys = computed(() => {
  const keys = new Set()
  for (const results of Object.values(props.skuResults)) {
    if (results && typeof results === 'object') {
      for (const k of Object.keys(results)) {
        keys.add(k)
      }
    }
  }
  return [...keys]
})

function genAutoSku(combo) {
  if (!props.baseSku)
    return combo.key
  return `${props.baseSku}-${combo.key.replace(/,/g, '-')}`
}

function getSkuField(comboKey, field) {
  const sku = props.skuData[comboKey]
  if (!sku)
    return ''
  return sku[field] || ''
}

function getOverrideValue(comboKey, field) {
  const sku = props.skuData[comboKey]
  if (!sku || !sku.overrides)
    return ''
  return sku.overrides[field] || ''
}

function getDefaultValue(field) {
  const val = props.defaultValues[field]
  return val !== undefined && val !== null ? String(val) : ''
}

function onFieldInput(comboKey, field, event) {
  emit('updateSkuField', comboKey, field, event.target.value)
}

function toggleFieldKey(key) {
  const current = [...props.selectedFieldKeys]
  const idx = current.indexOf(key)
  if (idx >= 0) {
    current.splice(idx, 1)
  }
  else {
    current.push(key)
  }
  emit('update:selectedFieldKeys', current)
}

function getResultValue(comboKey, resultKey) {
  const results = props.skuResults[comboKey]
  if (!results)
    return ''
  return results[resultKey] !== undefined ? String(results[resultKey]) : ''
}
</script>

<template>
  <div v-if="skuCombos.length > 0" class="space-y-2">
    <div class="flex items-center gap-2 flex-wrap">
      <span class="text-xs text-base-content/50">显示字段:</span>
      <div v-for="key in allFieldKeys" :key="key" class="form-control">
        <label class="label cursor-pointer py-0 px-1 gap-1">
          <input
            type="checkbox"
            class="checkbox checkbox-xs"
            :checked="selectedFieldKeys.includes(key)"
            @change="toggleFieldKey(key)"
          >
          <span class="label-text text-xs">{{ key }}</span>
        </label>
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="table table-xs">
        <thead>
          <tr>
            <th class="text-xs">
              组合
            </th>
            <th class="text-xs">
              SKU款号
            </th>
            <th class="text-xs">
              图片
            </th>
            <th
              v-for="key in selectedFieldKeys"
              :key="key"
              class="text-xs"
            >
              {{ key }}
            </th>
            <th
              v-for="rk in resultKeys"
              :key="rk"
              class="text-xs text-primary"
            >
              {{ rk }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="combo in skuCombos" :key="combo.key" class="align-top">
            <td class="text-xs font-mono whitespace-nowrap">
              {{ combo.key }}
            </td>
            <td>
              <input
                :value="getSkuField(combo.key, 'sku') || genAutoSku(combo)"
                class="input input-bordered input-xs w-28"
                :placeholder="genAutoSku(combo)"
                @input="onFieldInput(combo.key, 'sku', $event)"
              >
            </td>
            <td>
              <div class="flex gap-1 items-start flex-wrap max-w-48">
                <ImageUploader
                  :model-value="getSkuField(combo.key, 'images')"
                  @update:model-value="emit('updateSkuImages', combo.key, $event)"
                />
              </div>
            </td>
            <td v-for="key in selectedFieldKeys" :key="key">
              <input
                :value="getOverrideValue(combo.key, key)"
                class="input input-bordered input-xs w-20"
                :placeholder="getDefaultValue(key) || '继承'"
                @input="onFieldInput(combo.key, key, $event)"
              >
            </td>
            <td
              v-for="rk in resultKeys"
              :key="rk"
              class="text-xs font-mono whitespace-nowrap"
            >
              {{ getResultValue(combo.key, rk) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
