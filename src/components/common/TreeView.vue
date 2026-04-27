<script setup>
import { ref } from 'vue'

defineProps({
  tree: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
})

const emit = defineEmits(['editGroup', 'editCondition', 'addChild', 'deleteGroup', 'deleteCondition'])

const collapsed = ref(new Set())

function toggle(id) {
  if (collapsed.value.has(id)) {
    collapsed.value.delete(id)
  }
  else {
    collapsed.value.add(id)
  }
}

function isCollapsed(id) {
  return collapsed.value.has(id)
}

function operatorLabel(op) {
  if (!op)
    return '='
  const map = {
    eq: '=',
    neq: '!=',
    gt: '>',
    gte: '>=',
    lt: '<',
    lte: '<=',
    between: '区间',
    in: '包含',
    not_in: '不包含',
  }
  return map[op] || op
}
</script>

<template>
  <div v-if="!tree || tree.length === 0" class="text-base-content/50 text-sm py-2">
    暂无条件
  </div>
  <ul v-else class="space-y-1">
    <li v-for="node in tree" :key="node.id">
      <div class="flex items-center gap-1">
        <button
          v-if="node.children && node.children.length > 0"
          class="btn btn-ghost btn-xs btn-square"
          @click="toggle(node.id)"
        >
          <span v-if="isCollapsed(node.id)" class="text-xs">+</span>
          <span v-else class="text-xs">-</span>
        </button>
        <span v-else class="w-6" />
        <span :class="node.logic === 'or' ? 'badge badge-warning' : 'badge badge-info'" class="text-xs">
          {{ node.logic.toUpperCase() }}
        </span>
        <span v-if="editable" class="flex gap-1 ml-1">
          <button class="btn btn-ghost btn-xs" @click="emit('editGroup', node)">编辑</button>
          <button class="btn btn-ghost btn-xs" @click="emit('addChild', node)">+ 子组</button>
          <button class="btn btn-ghost btn-xs text-error" @click="emit('deleteGroup', node)">删除</button>
        </span>
      </div>
      <ul v-if="node.conditions && node.conditions.length > 0" class="ml-6 space-y-0.5">
        <li v-for="cond in node.conditions" :key="cond.id">
          <div class="flex items-center gap-1 text-sm">
            <span class="w-4" />
            <span class="text-base-content/70">{{ cond.fieldKey }}</span>
            <span class="badge badge-outline badge-xs">{{ operatorLabel(cond.operator) }}</span>
            <span class="font-medium">{{ cond.value }}</span>
            <span v-if="cond.valueEnd !== undefined">~ {{ cond.valueEnd }}</span>
            <span v-if="editable" class="flex gap-1 ml-1">
              <button class="btn btn-ghost btn-xs" @click="emit('editCondition', cond)">编辑</button>
              <button class="btn btn-ghost btn-xs text-error" @click="emit('deleteCondition', cond)">删除</button>
            </span>
          </div>
        </li>
      </ul>
      <ul v-if="node.children && node.children.length > 0 && !isCollapsed(node.id)" class="ml-6">
        <TreeView
          :tree="node.children"
          :editable="editable"
          @edit-group="emit('editGroup', $event)"
          @edit-condition="emit('editCondition', $event)"
          @add-child="emit('addChild', $event)"
          @delete-group="emit('deleteGroup', $event)"
          @delete-condition="emit('deleteCondition', $event)"
        />
      </ul>
    </li>
  </ul>
</template>
