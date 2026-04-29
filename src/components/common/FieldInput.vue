<script setup>
import { computed } from 'vue'

/**
 * @property {object} field - 字段定义 { fieldKey, fieldName, type, optionGroupId, unit, required, description }
 * @property {*} [modelValue=''] - 绑定的值
 * @property {Array} [optionGroups=[]] - 选项分组列表
 */
const props = defineProps({
  field: { type: Object, required: true },
  modelValue: { default: '' },
  optionGroups: { type: Array, default: () => [] },
})

/**
 * @event update:modelValue - 值变更
 */
const emit = defineEmits(['update:modelValue'])

/** 当前字段的下拉选项列表 */
const options = computed(() => {
  if (!props.field.optionGroupId)
    return []
  const group = props.optionGroups.find(g => String(g.groupId) === String(props.field.optionGroupId))
  if (!group || !group.items)
    return []
  return group.items.filter(i => i.enabled !== false).map(i => ({
    value: i.itemValue,
    label: i.itemLabel || i.itemValue,
  }))
})

/**
 * 文本/下拉变更处理。
 * @param {Event} e - 输入事件
 */
function onInput(e) {
  emit('update:modelValue', e.target.value)
}

/**
 * 数字输入变更处理，空字符串保持为 ''，否则转为 Number。
 * @param {Event} e - 输入事件
 */
function onNumberInput(e) {
  const val = e.target.value
  emit('update:modelValue', val === '' ? '' : Number(val))
}

/**
 * 布尔值切换处理。
 * @param {Event} e - checkbox 变更事件
 */
function onBoolChange(e) {
  emit('update:modelValue', e.target.checked)
}
</script>

<template>
  <div class="form-control w-full">
    <label class="label py-1">
      <span class="label-text">{{ field.fieldName || field.paramName || field.fieldKey }}</span>
      <span v-if="field.required" class="label-text-alt text-error">*</span>
      <span v-if="field.unit" class="label-text-alt opacity-60">{{ field.unit }}</span>
    </label>

    <select
      v-if="field.type === 'select'"
      :value="modelValue"
      class="select select-bordered w-full"
      @change="onInput"
    >
      <option value="">
        {{ field.description || '请选择...' }}
      </option>
      <option v-for="opt in options" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>

    <input
      v-else-if="field.type === 'number'"
      :value="modelValue"
      type="number"
      step="any"
      class="input input-bordered w-full"
      :placeholder="field.description || ''"
      @input="onNumberInput"
    >

    <input
      v-else-if="field.type === 'date'"
      :value="modelValue"
      type="date"
      class="input input-bordered w-full"
      @input="onInput"
    >

    <div v-else-if="field.type === 'boolean'" class="flex items-center gap-2 py-2">
      <input
        :checked="modelValue === true"
        type="checkbox"
        class="toggle toggle-primary"
        @change="onBoolChange"
      >
      <span class="text-sm">{{ modelValue ? '是' : '否' }}</span>
    </div>

    <input
      v-else
      :value="modelValue"
      type="text"
      class="input input-bordered w-full"
      :placeholder="field.description || ''"
      @input="onInput"
    >
  </div>
</template>
