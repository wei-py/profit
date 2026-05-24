<script setup>
import { computed } from "vue";
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

function formula() {
  return props.node?.data?.formula || [];
}

const operatorDisplay = { "-": "−", "*": "×", "/": "÷", "+": "+" };

const formulaLabel = computed(() => {
  return formula().map((t) => {
    if (t.type === "operator")
      return ` ${(operatorDisplay[t.value] || t.value)} `;
    if (t.type === "paren")
      return t.value;
    return t.value || "?";
  }).join("");
});

function addFormulaToken(type, value = "") {
  const list = [...formula()];
  list.push({ type, value });
  emitPatch({ formula: list });
}

function updateFormulaToken(index, patch) {
  const list = [...formula()];
  if (index < 0 || index >= list.length)
    return;
  list[index] = { ...list[index], ...patch };
  emitPatch({ formula: list });
}

function removeFormulaToken(index) {
  emitPatch({ formula: (props.node?.data?.formula || []).filter((_, i) => i !== index) });
}

function emitPatch(patch) {
  emit("update:node", { ...props.node, data: { ...props.node?.data, ...patch } });
}

function addWhere() {
  const where = [...(props.node?.data?.where || []), { column: "", input: "", operator: "=", source: "", valueMode: "value" }];
  emitPatch({ where });
}

function updateWhere(index, patch) {
  const src = props.node?.data?.where || [];
  if (index < 0 || index >= src.length)
    return;
  const where = [...src];
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
  const src = props.node?.data?.map || [];
  if (index < 0 || index >= src.length)
    return;
  const map = [...src];
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
      <div v-if="(node.data?.where || []).length" class="grid grid-cols-[1fr_4rem_1fr_auto] gap-1 px-0.5 text-[10px] opacity-40">
        <span>来源节点</span>
        <span>运算</span>
        <span>表列</span>
        <span />
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
      <div v-if="formula().length" class="bg-base-200 p-2 rounded text-sm font-mono min-h-8">
        {{ formulaLabel || "..." }}
      </div>

      <div v-if="formula().length" class="space-y-1">
        <span class="text-[10px] opacity-40">公式项</span>
        <div v-for="(token, index) in formula()" :key="index" class="grid grid-cols-[2.5rem_1fr_auto] gap-1 items-center">
          <span class="text-[10px] opacity-40 text-right">{{ { constant: "常量", field: "字段", node: "节点", operator: "运算", paren: "括号" }[token.type] }}</span>
          <template v-if="token.type === 'field'">
            <OptionTreeSelect
              @update:model-value="updateFormulaToken(index, { value: $event })"
              :modelValue="token.value"
              :options="fieldOptions || []"
              size="xs"
            />
          </template>
          <template v-else-if="token.type === 'node'">
            <OptionTreeSelect
              @update:model-value="updateFormulaToken(index, { value: $event })"
              :modelValue="token.value"
              :options="nodeOptions || []"
              size="xs"
            />
          </template>
          <template v-else-if="token.type === 'constant'">
            <input
              @input="updateFormulaToken(index, { value: $event.target.value })"
              class="input input-bordered input-xs w-full"
              placeholder="0"
              :value="token.value"
            >
          </template>
          <template v-else-if="token.type === 'operator'">
            <span class="font-mono px-1">{{ operatorDisplay[token.value] || token.value }}</span>
          </template>
          <template v-else-if="token.type === 'paren'">
            <span class="font-mono px-1">{{ token.value }}</span>
          </template>
          <button @click="removeFormulaToken(index)" class="btn btn-ghost btn-xs">删除</button>
        </div>
      </div>

      <div class="flex flex-wrap gap-0.5">
        <span class="text-[10px] opacity-30 self-center mr-1">添加</span>
        <button @click="addFormulaToken('paren', '(')" class="btn btn-outline btn-xs">(</button>
        <button @click="addFormulaToken('paren', ')')" class="btn btn-outline btn-xs">)</button>
        <button @click="addFormulaToken('operator', '+')" class="btn btn-outline btn-xs">+</button>
        <button @click="addFormulaToken('operator', '-')" class="btn btn-outline btn-xs">−</button>
        <button @click="addFormulaToken('operator', '*')" class="btn btn-outline btn-xs">×</button>
        <button @click="addFormulaToken('operator', '/')" class="btn btn-outline btn-xs">÷</button>
        <button @click="addFormulaToken('field', '')" class="btn btn-outline btn-xs">字段</button>
        <button @click="addFormulaToken('node', '')" class="btn btn-outline btn-xs">节点</button>
        <button @click="addFormulaToken('constant', '')" class="btn btn-outline btn-xs">常量</button>
      </div>
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
