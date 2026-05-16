<script setup>
import { computed } from "vue";

const props = defineProps({
  field: {
    required: true,
    type: Object,
  },
  modelValue: { default: "" },
  noLabel: {
    default: false,
    type: Boolean,
  },
  optionGroups: {
    type: Array,
    default: () => [],
  },
  optionItems: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["update:modelValue"]);

const ftype = computed(() => props.field.type || props.field.类型);
const fname = computed(() => props.field.fieldName || props.field.字段名称);
const funit = computed(() => props.field.unit || props.field.单位);
const frequired = computed(() => props.field.required || props.field.必填 === "是");
const fdesc = computed(() => props.field.description || props.field.说明 || "");

const options = computed(() => {
  const gid = props.field.optionGroupId || props.field.选项组编号;
  if (!gid)
    return [];
  // 新数据模型：optionItems [{所属分组, 选项值, 显示名, 启用}]
  if (props.optionItems.length) {
    return props.optionItems
      .filter(i => i.所属分组 === gid && i.启用 !== "否" && i.启用 !== "FALSE")
      .map(i => ({
        label: i.显示名 || i.选项值,
        value: i.选项值,
      }));
  }
  // 旧模型兼容
  const group = props.optionGroups.find(g => String(g.groupId || g.编号) === String(gid));
  if (!group || !group.items)
    return [];
  return group.items
    .filter(i => i.enabled !== false)
    .map(i => ({
      label: i.itemLabel || i.itemValue,
      value: i.itemValue,
    }));
});

function onInput(e) {
  emit("update:modelValue", e.target.value);
}
function _onCheck(e) {
  emit("update:modelValue", e.target.checked);
}
</script>

<template>
  <div v-if="!noLabel" class="form-control">
    <label class="label py-1">
      <span class="label-text">{{ fname }}</span>
      <span v-if="funit" class="label-text-alt opacity-60">{{ funit }}</span>
    </label>

    <select
      v-if="ftype === 'select' || ftype === '下拉'"
      @change="onInput"
      class="select select-bordered select-xs w-full"
      :required="frequired"
      :value="modelValue"
    >
      <option value="">-- 选择 --</option>
      <option v-for="opt in options" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>

    <div v-else-if="ftype === 'boolean' || ftype === '布尔'" class="flex gap-2 items-center">
      <input
        @change="emit('update:modelValue', $event.target.checked ? '是' : '否')"
        :checked="modelValue === '是' || modelValue === true || modelValue === 'true'"
        class="toggle toggle-sm"
        type="checkbox"
      >
      <span class="text-sm">{{
        modelValue === "是" || modelValue === true || modelValue === "true" ? "是" : "否"
      }}</span>
    </div>

    <input
      v-else-if="ftype === 'number' || ftype === '数字'"
      @input="onInput"
      class="input input-bordered input-xs w-full"
      :placeholder="fdesc"
      :required="frequired"
      step="any"
      type="number"
      :value="modelValue"
    >

    <input
      v-else
      @input="onInput"
      class="input input-bordered input-xs w-full"
      :placeholder="fdesc"
      :required="frequired"
      type="text"
      :value="modelValue"
    >
  </div>

  <template v-else>
    <select
      v-if="ftype === 'select' || ftype === '下拉'"
      @change="onInput"
      class="select select-bordered select-xs"
      :value="modelValue"
    >
      <option value="">--</option>
      <option v-for="opt in options" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>

    <div v-else-if="ftype === 'boolean' || ftype === '布尔'" class="flex items-center">
      <input
        @change="emit('update:modelValue', $event.target.checked ? '是' : '否')"
        :checked="modelValue === '是' || modelValue === true || modelValue === 'true'"
        class="toggle toggle-xs"
        type="checkbox"
      >
    </div>

    <input
      v-else-if="ftype === 'number' || ftype === '数字'"
      @input="onInput"
      class="input input-bordered input-xs"
      step="any"
      type="number"
      :value="modelValue"
    >

    <input
      v-else
      @input="onInput"
      class="input input-bordered input-xs"
      type="text"
      :value="modelValue"
    >
  </template>
</template>
