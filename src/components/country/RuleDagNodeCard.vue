<script setup>
import { nodeSummary, nodeTypeLabel } from "@/domain/rule-graph";

defineProps({
  compact: Boolean,
  node: Object,
  selected: Boolean,
});
const emit = defineEmits(["select"]);
</script>

<template>
  <button
    @click="emit('select', node.id)"
    class="w-full border text-left text-xs hover:border-primary"
    :class="[
      compact
        ? 'rounded px-2 py-1.5'
        : 'rounded-box p-3',
      selected ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'border-base-300 bg-base-100',
    ]"
  >
    <div class="flex items-center gap-1.5">
      <span class="badge badge-xs">{{ nodeTypeLabel(node.data?.kind) }}</span>
      <span class="truncate font-semibold">{{ node.data?.label || node.id }}</span>
    </div>
    <div v-if="nodeSummary(node)" class="mt-0.5 truncate opacity-40" :class="compact ? 'text-[11px]' : 'opacity-50'">{{ nodeSummary(node) }}</div>
  </button>
</template>
