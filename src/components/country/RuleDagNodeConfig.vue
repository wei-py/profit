<script setup>
import OptionTreeSelect from "@/components/common/OptionTreeSelect.vue";
import { GRAPH_NODE_TYPES } from "@/domain/rule-graph";

const props = defineProps({
  fieldOptions: Array,
  lookupColumns: Array,
  lookupNames: Array,
  node: Object,
  nodeOptions: Array,
  outputOptions: Array,
});

const emit = defineEmits(["update:node"]);

const operatorOptions = ["=", "!=", ">", ">=", "<", "<="];

function emitPatch(patch) {
  emit("update:node", { ...props.node, data: { ...props.node?.data, ...patch } });
}

function addWhere() {
  const where = [...(props.node?.data?.where || []), { column: "", input: "", operator: "=", source: "", valueMode: "value" }];
  emitPatch({ where });
}

function updateWhere(index, patch) {
  const where = [...(props.node?.data?.where || [])];
  where[index] = { ...where[index], ...patch };
  emitPatch({ where });
}

function removeWhere(index) {
  emitPatch({ where: (props.node?.data?.where || []).filter((_, i) => i !== index) });
}

function addMap() {
  emitPatch({ map: [...(props.node?.data?.map || []), { from: "", to: "" }] });
}

function updateMap(index, patch) {
  const map = [...(props.node?.data?.map || [])];
  map[index] = { ...map[index], ...patch };
  emitPatch({ map });
}

function removeMap(index) {
  emitPatch({ map: (props.node?.data?.map || []).filter((_, i) => i !== index) });
}
</script>

<template>
  <div v-if="node" class="space-y-3 text-xs">
    <div>
      <label class="label py-0 text-xs">节点名称</label>
      <input
        @input="emitPatch({ label: $event.target.value })"
        class="input input-bordered input-xs w-full"
        :value="node.data?.label"
      >
    </div>

    <div>
      <label class="label py-0 text-xs">节点类型</label>
      <OptionTreeSelect
        @update:model-value="emitPatch({ kind: $event })"
        :modelValue="node.data?.kind"
        :options="GRAPH_NODE_TYPES"
        size="xs"
      />
    </div>

    <template v-if="node.data?.kind === 'input'">
      <label class="label py-0 text-xs">输入字段</label>
      <OptionTreeSelect
        @update:model-value="emitPatch({ field: $event })"
        :modelValue="node.data?.field"
        :options="fieldOptions || []"
        size="xs"
      />
      <label class="label py-0 text-xs">取值方式</label>
      <OptionTreeSelect
        @update:model-value="emitPatch({ valueMode: $event })"
        :modelValue="node.data?.valueMode || 'value'"
        :options="['value', 'cascadePath']"
        size="xs"
      />
    </template>

    <template v-else-if="node.data?.kind === 'constant'">
      <label class="label py-0 text-xs">常量值</label>
      <input @input="emitPatch({ value: $event.target.value })" class="input input-bordered input-xs w-full" :value="node.data?.value">
    </template>

    <template v-else-if="node.data?.kind === 'lookup'">
      <label class="label py-0 text-xs">查表 sheet</label>
      <OptionTreeSelect
        @update:model-value="emitPatch({ sheet: $event })"
        :modelValue="node.data?.sheet"
        :options="lookupNames || []"
        size="xs"
      />

      <div class="flex items-center justify-between">
        <span class="font-semibold opacity-70">WHERE 条件</span>
        <button @click="addWhere" class="btn btn-ghost btn-xs">＋</button>
      </div>
      <div v-for="(row, index) in node.data?.where || []" :key="index" class="grid grid-cols-[1fr_4rem_1fr_auto] gap-1">
        <OptionTreeSelect
          @update:model-value="updateWhere(index, { source: $event })"
          :modelValue="row.source"
          :options="nodeOptions || []"
          placeholder="来源节点"
          size="xs"
        />
        <OptionTreeSelect
          @update:model-value="updateWhere(index, { operator: $event })"
          :modelValue="row.operator || '='"
          :options="operatorOptions"
          size="xs"
          :wrapDisplay="false"
        />
        <OptionTreeSelect
          @update:model-value="updateWhere(index, { column: $event })"
          :modelValue="row.column"
          :options="lookupColumns || []"
          placeholder="表列"
          size="xs"
        />
        <button @click="removeWhere(index)" class="btn btn-ghost btn-xs text-error">✕</button>
      </div>
    </template>

    <template v-else-if="node.data?.kind === 'map'">
      <label class="label py-0 text-xs">输入来源</label>
      <OptionTreeSelect
        @update:model-value="emitPatch({ source: $event })"
        :modelValue="node.data?.source"
        :options="nodeOptions || []"
        size="xs"
      />

      <div class="flex items-center justify-between">
        <span class="font-semibold opacity-70">映射表</span>
        <button @click="addMap" class="btn btn-ghost btn-xs">＋</button>
      </div>
      <div v-for="(row, index) in node.data?.map || []" :key="index" class="grid grid-cols-[1fr_1fr_auto] gap-1">
        <input
          @input="updateMap(index, { from: $event.target.value })"
          class="input input-bordered input-xs"
          placeholder="原值"
          :value="row.from"
        >
        <input
          @input="updateMap(index, { to: $event.target.value })"
          class="input input-bordered input-xs"
          placeholder="目标值"
          :value="row.to"
        >
        <button @click="removeMap(index)" class="btn btn-ghost btn-xs text-error">✕</button>
      </div>
    </template>

    <template v-else-if="node.data?.kind === 'pick'">
      <label class="label py-0 text-xs">行来源节点</label>
      <OptionTreeSelect
        @update:model-value="emitPatch({ rowSource: $event })"
        :modelValue="node.data?.rowSource"
        :options="nodeOptions || []"
        size="xs"
      />
      <label class="label py-0 text-xs">固定列</label>
      <input @input="emitPatch({ column: $event.target.value })" class="input input-bordered input-xs w-full" :value="node.data?.column">
      <label class="label py-0 text-xs">动态列来源节点</label>
      <OptionTreeSelect
        @update:model-value="emitPatch({ columnSource: $event })"
        :modelValue="node.data?.columnSource"
        :options="nodeOptions || []"
        size="xs"
      />
    </template>

    <template v-else-if="node.data?.kind === 'calc'">
      <label class="label py-0 text-xs">表达式</label>
      <textarea
        @input="emitPatch({ expression: $event.target.value })"
        class="textarea textarea-bordered textarea-xs min-h-20 w-full font-mono"
        placeholder="如：{售价} * {销售佣金费率}"
        :value="node.data?.expression"
      />
    </template>

    <template v-else-if="node.data?.kind === 'condition'">
      <label class="label py-0 text-xs">条件说明</label>
      <input @input="emitPatch({ condition: $event.target.value })" class="input input-bordered input-xs w-full" :value="node.data?.condition">
    </template>

    <template v-else-if="node.data?.kind === 'output'">
      <label class="label py-0 text-xs">输出字段</label>
      <OptionTreeSelect
        @update:model-value="emitPatch({ field: $event })"
        :modelValue="node.data?.field"
        :options="outputOptions || fieldOptions || []"
        size="xs"
      />
      <label class="label py-0 text-xs">值来源节点</label>
      <OptionTreeSelect
        @update:model-value="emitPatch({ source: $event })"
        :modelValue="node.data?.source"
        :options="nodeOptions || []"
        size="xs"
      />
    </template>
  </div>
</template>
