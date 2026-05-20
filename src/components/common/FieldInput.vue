<script setup>
import { computed } from "vue";
import OptionTreeSelect from "@/components/common/OptionTreeSelect.vue";
import { getEnabledOptionItems, toSelectOptions } from "@/utils/optionCascade";

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
  optionConfigs: {
    type: Array,
    default: () => [],
  },
  optionGroups: {
    type: Array,
    default: () => [],
  },
  optionGroupsData: {
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

const isDropdown = computed(() => ftype.value === "select" || ftype.value === "下拉");
const groupId = computed(() => props.field.optionGroupId || props.field.选项组编号);
const hasOptionTreeData = computed(
  () => !!groupId.value && props.optionConfigs.length > 0,
);

const options = computed(() => getItems(groupId.value));

function getItems(gid) {
  if (!gid)
    return [];
  if (props.optionItems.length)
    return toSelectOptions(getEnabledOptionItems(props.optionItems, gid));

  const group = props.optionGroups.find(g => String(g.groupId || g.编号) === String(gid));
  if (!group || !group.items)
    return [];
  return group.items
    .filter(i => i.enabled !== false)
    .map(i => ({ label: i.itemLabel || i.itemValue, value: i.itemValue }));
}

function onInput(e) {
  emit("update:modelValue", e.target.value);
}
</script>

<template>
  <div v-if="!noLabel" class="form-control">
    <label class="label py-1">
      <span class="label-text">{{ fname }}</span>
      <span v-if="funit" class="label-text-alt opacity-60">{{ funit }}</span>
    </label>

    <OptionTreeSelect
      v-if="isDropdown && hasOptionTreeData"
      @update:model-value="emit('update:modelValue', $event)"
      :modelValue="modelValue"
      :optionConfigs="optionConfigs"
      :placeholder="`请选择${fname || ''}`"
      :rootGroupId="groupId"
      size="xs"
    />

    <OptionTreeSelect
      v-else-if="isDropdown"
      @update:model-value="emit('update:modelValue', $event)"
      :modelValue="modelValue"
      :options="options"
      :placeholder="`请选择${fname || ''}`"
      size="xs"
    />

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
    <OptionTreeSelect
      v-if="isDropdown && hasOptionTreeData"
      @update:model-value="emit('update:modelValue', $event)"
      :modelValue="modelValue"
      :optionGroupsData="optionGroupsData"
      :optionItems="optionItems"
      placeholder="请选择"
      :rootGroupId="groupId"
      size="xs"
    />

    <OptionTreeSelect
      v-else-if="isDropdown"
      @update:model-value="emit('update:modelValue', $event)"
      :modelValue="modelValue"
      :options="options"
      placeholder="请选择"
      size="xs"
    />

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
