<script setup>
import { nodeSummary, nodeTypeLabel } from "@/domain/rule-graph";

defineProps({
  node: Object,
  selected: Boolean,
});
const emit = defineEmits(["select"]);
</script>

<template>
  <button
    @click="emit('select', node.id)"
    class="w-full rounded-box border p-3 text-left text-xs hover:border-primary"
    :class="selected ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'border-base-300 bg-base-100'"
  >
    <div class="flex items-center gap-2">
      <span class="badge badge-sm">{{ nodeTypeLabel(node.data?.kind) }}</span>
      <span class="truncate font-semibold">{{ node.data?.label || node.id }}</span>
    </div>
    <div v-if="nodeSummary(node)" class="mt-1 truncate opacity-50">{{ nodeSummary(node) }}</div>
  </button>
</template>
