<script setup>
import { computed } from 'vue'

const props = defineProps({
  field: { type: Object, required: true },
  modelValue: { default: '' },
  optionGroups: { type: Array, default: () => [] },
  optionItems: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:modelValue'])

const options = computed(() => {
  const gid = props.field.optionGroupId
  if (!gid) return []
  // 新数据模型：optionItems [{所属分组, 选项值, 显示名, 启用}]
  if (props.optionItems.length) {
    return props.optionItems
      .filter(i => i.所属分组 === gid && i.启用 !== '否' && i.启用 !== 'FALSE')
      .map(i => ({ value: i.选项值, label: i.显示名 || i.选项值 }))
  }
  // 旧模型兼容
  const group = props.optionGroups.find(g => String(g.groupId || g.编号) === String(gid))
  if (!group || !group.items) return []
  return group.items.filter(i => i.enabled !== false).map(i => ({ value: i.itemValue, label: i.itemLabel || i.itemValue }))
})

function onInput(e) { emit('update:modelValue', e.target.value) }
function onCheck(e) { emit('update:modelValue', e.target.checked) }
</script>

<template>
  <div class="form-control">
    <label class="label py-1">
      <span class="label-text">{{ field.fieldName || field.字段名称 }}</span>
      <span v-if="field.unit || field.单位" class="label-text-alt opacity-60">{{ field.unit || field.单位 }}</span>
    </label>

    <!-- 下拉 -->
    <select
      v-if="field.type === 'select' || field.type === '下拉'"
      class="select select-bordered"
      :value="modelValue"
      :required="field.required || field.必填 === '是'"
      @change="onInput"
    >
      <option value="">-- 选择 --</option>
      <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
    </select>

    <!-- 布尔 / 勾选 -->
    <div v-else-if="field.type === 'boolean' || field.type === '布尔'" class="flex items-center gap-2">
      <input
        type="checkbox"
        class="toggle toggle-sm"
        :checked="modelValue === '是' || modelValue === true || modelValue === 'true'"
        @change="emit('update:modelValue', $event.target.checked ? '是' : '否')"
      >
      <span class="text-sm">{{ modelValue === '是' || modelValue === true || modelValue === 'true' ? '是' : '否' }}</span>
    </div>

    <!-- 数字 -->
    <input
      v-else-if="field.type === 'number' || field.type === '数字'"
      type="number"
      step="any"
      class="input input-bordered"
      :value="modelValue"
      :required="field.required || field.必填 === '是'"
      :placeholder="field.description || field.说明 || ''"
      @input="onInput"
    >

    <!-- 文本 / 默认 -->
    <input
      v-else
      type="text"
      class="input input-bordered"
      :value="modelValue"
      :required="field.required || field.必填 === '是'"
      :placeholder="field.description || field.说明 || ''"
      @input="onInput"
    >
  </div>
</template>
