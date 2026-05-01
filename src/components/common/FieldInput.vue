<script setup>
import { computed } from 'vue'

const props = defineProps({
  field: { type: Object, required: true },
  modelValue: { default: '' },
  optionGroups: { type: Array, default: () => [] },
  optionItems: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:modelValue'])

const ftype = computed(() => props.field.type || props.field.类型)
const fname = computed(() => props.field.fieldName || props.field.字段名称)
const funit = computed(() => props.field.unit || props.field.单位)
const frequired = computed(() => props.field.required || props.field.必填 === '是')
const fdesc = computed(() => props.field.description || props.field.说明 || '')

const options = computed(() => {
  const gid = props.field.optionGroupId || props.field.选项组编号
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
      <span class="label-text">{{ fname }}</span>
      <span v-if="funit" class="label-text-alt opacity-60">{{ funit }}</span>
    </label>

    <select v-if="ftype === 'select' || ftype === '下拉'" class="select select-bordered" :value="modelValue" :required="frequired" @change="onInput">
      <option value="">-- 选择 --</option>
      <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
    </select>

    <div v-else-if="ftype === 'boolean' || ftype === '布尔'" class="flex items-center gap-2">
      <input type="checkbox" class="toggle toggle-sm" :checked="modelValue === '是' || modelValue === true || modelValue === 'true'" @change="emit('update:modelValue', $event.target.checked ? '是' : '否')">
      <span class="text-sm">{{ modelValue === '是' || modelValue === true || modelValue === 'true' ? '是' : '否' }}</span>
    </div>

    <input v-else-if="ftype === 'number' || ftype === '数字'" type="number" step="any" class="input input-bordered" :value="modelValue" :required="frequired" :placeholder="fdesc" @input="onInput">

    <input v-else type="text" class="input input-bordered" :value="modelValue" :required="frequired" :placeholder="fdesc" @input="onInput">
  </div>
</template>
