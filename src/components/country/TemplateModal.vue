<script setup>
import { computed, reactive, ref, watch } from "vue";
import { vDraggable } from "vue-draggable-plus";
import OptionTreeSelect from "@/components/common/OptionTreeSelect.vue";
import { useModalEsc } from "@/composables/useModalEsc";
import { buildDefaultCommissionFlow, createEmptyFlow, createEmptyRule, normalizeFlow, serializeFlow } from "@/domain/rule-graph";
import { useConfigStore } from "@/stores/config";
import RuleDagEditor from "./RuleDagEditor.vue";

const props = defineProps({
  cpId: String,
  open: Boolean,
  templateIdx: { default: -1, type: Number },
});
const emit = defineEmits(["close"]);
useModalEsc(
  () => props.open,
  () => emit("close"),
);

const store = useConfigStore();
const form = reactive({});
const selectedRuleId = ref(null);
const yesNoOptions = ["是", "否"];

const ruleDragOpts = {
  animation: 150,
  chosenClass: "drag-chosen",
  dragClass: "drag-drag",
  fallbackOnBody: true,
  forceFallback: true,
  ghostClass: "drag-ghost",
  handle: ".rule-drag-handle",
};

function onRuleDragEnd() {
  normalizeRuleOrders();
  commitFlow();
}

const calculationConfigs = computed(() => props.cpId ? store.getCalculationConfigsByCountry(props.cpId) : []);
const outputFields = computed(() => store.getFieldsByCountry(props.cpId).filter(field => field.输入输出 === "输出"));
const fieldOptions = computed(() => store.getFieldsByCountry(props.cpId).map(field => ({
  label: field.字段名称 ? `${field.字段名称}（${field.字段键}）` : field.字段键,
  value: field.字段键,
})));
const outputOptions = computed(() => outputFields.value.map(field => ({
  label: field.字段名称 ? `${field.字段名称}（${field.字段键}）` : field.字段键,
  value: field.字段键,
})));

const flow = computed(() => normalizeFlow(form.流程JSON));
const rules = computed(() => flow.value.rules);
const currentRule = computed(() => rules.value.find(rule => rule.id === selectedRuleId.value) || rules.value[0] || null);

function normalizeRuleOrders() {
  flow.value.rules.forEach((rule, index) => {
    rule.order = (index + 1) * 10;
  });
}

watch(
  () => props.open,
  (open) => {
    if (!open)
      return;
    initForm();
  },
);

function initForm() {
  Object.keys(form).forEach(key => delete form[key]);
  const current = calculationConfigs.value[props.templateIdx];
  if (current) {
    Object.assign(form, JSON.parse(JSON.stringify(current)));
  }
  else {
    Object.assign(form, {
      所属国家平台: props.cpId,
      模板名称: "新流程模板",
      模板启用: "是",
      模板编号: `template_${calculationConfigs.value.length + 1}`,
      模板说明: "",
      流程JSON: serializeFlow(createEmptyFlow()),
    });
  }
  selectedRuleId.value = null;
}

function applyCommissionPreset() {
  form.流程JSON = serializeFlow(buildDefaultCommissionFlow());
  selectedRuleId.value = null;
}

function addRule() {
  const rule = createEmptyRule(`规则 ${rules.value.length + 1}`);
  flow.value.rules.push(rule);
  selectedRuleId.value = rule.id;
  commitFlow();
}

function deleteRule(ruleId) {
  const idx = flow.value.rules.findIndex(rule => rule.id === ruleId);
  if (idx < 0)
    return;
  flow.value.rules.splice(idx, 1);
  if (selectedRuleId.value === ruleId)
    selectedRuleId.value = null;
  commitFlow();
}

function selectRule(ruleId) {
  selectedRuleId.value = ruleId;
}

function updateRuleGraph(ruleId, graphJson) {
  const rule = flow.value.rules.find(rule => rule.id === ruleId);
  if (!rule)
    return;
  rule.graph = JSON.parse(graphJson);
  commitFlow();
}

function commitFlow() {
  form.流程JSON = serializeFlow(flow.value);
}

function save() {
  store.upsertCalculationConfig({
    ...form,
    所属国家平台: props.cpId,
  }, calculationConfigs.value[props.templateIdx]?.模板编号);
  emit("close");
}

function deleteTemplate() {
  if (props.templateIdx >= 0) {
    const current = calculationConfigs.value[props.templateIdx];
    if (current)
      store.deleteCalculationConfig(current.模板编号);
  }
  emit("close");
}
</script>

<template>
  <dialog @cancel.prevent class="modal" :open="open">
    <div class="modal-box h-[min(92vh,880px)] w-[min(98rem,calc(100vw-1rem))] max-w-none overflow-hidden p-0">
      <div class="flex h-full flex-col bg-base-200">
        <header class="grid grid-cols-[12rem_1fr_7rem_auto] items-end gap-3 border-b border-base-300 bg-base-100 p-4">
          <div>
            <label class="label py-0 text-xs">模板编号</label>
            <input v-model="form.模板编号" class="input input-bordered input-sm w-full">
          </div>
          <div>
            <label class="label py-0 text-xs">模板名称</label>
            <input v-model="form.模板名称" class="input input-bordered input-sm w-full">
          </div>
          <div>
            <label class="label py-0 text-xs">启用</label>
            <OptionTreeSelect v-model="form.模板启用" :options="yesNoOptions" size="sm" />
          </div>
          <button @click="applyCommissionPreset" class="btn btn-outline btn-sm">
            套用销售佣金流程
          </button>
        </header>

        <div class="grid min-h-0 flex-1 grid-cols-[14rem_minmax(0,1fr)] overflow-hidden">
          <aside class="min-h-0 overflow-auto border-r border-base-300 bg-base-100 p-3">
            <div class="mb-2 flex items-center justify-between">
              <span class="text-xs font-semibold opacity-70">规则列表</span>
              <button @click="addRule" class="btn btn-ghost btn-xs">＋</button>
            </div>
            <div v-if="!rules.length" class="mb-3 text-xs opacity-40">暂无规则，点击 ＋ 新增。</div>
            <div v-draggable="[rules, ruleDragOpts, { onEnd: onRuleDragEnd }]" class="space-y-1">
              <div
                v-for="rule in rules"
                :key="rule.id"
                class="w-full rounded border p-2 text-left text-xs hover:border-primary"
                :class="selectedRuleId === rule.id || (!selectedRuleId && rules[0]?.id === rule.id) ? 'border-primary bg-primary/10' : 'border-base-300 bg-base-200'"
              >
                <div class="flex items-center justify-between gap-1">
                  <span class="rule-drag-handle cursor-grab shrink-0 px-0.5 opacity-40">☰</span>
                  <button @click="selectRule(rule.id)" class="min-w-0 flex-1 text-left">
                    <div class="flex items-center gap-1">
                      <span class="badge badge-xs" :class="rule.enabled ? 'badge-primary' : 'badge-ghost'">{{ rule.order }}</span>
                      <span class="truncate font-semibold">{{ rule.name }}</span>
                    </div>
                    <div class="mt-0.5 truncate opacity-50">{{ rule.graph.nodes?.length || 0 }} 个节点</div>
                  </button>
                  <button @click.stop="deleteRule(rule.id)" class="btn btn-ghost btn-xs shrink-0 text-error">✕</button>
                </div>
              </div>
            </div>
          </aside>

          <RuleDagEditor
            v-if="currentRule"
            @update:graph-json="updateRuleGraph(currentRule.id, $event)"
            :key="currentRule.id"
            :fieldOptions="fieldOptions"
            :graphJson="JSON.stringify(currentRule.graph)"
            :lookupTables="store.lookupTables"
            :outputOptions="outputOptions"
            :ruleId="currentRule.id"
            :ruleName="currentRule.name"
          />
          <div v-else class="grid h-full place-items-center text-sm opacity-40">
            新建或选择一条规则开始编辑
          </div>
        </div>

        <footer class="flex items-center gap-2 border-t border-base-300 bg-base-100 px-4 py-3">
          <button v-if="templateIdx >= 0" @click="deleteTemplate" class="btn btn-error btn-outline btn-sm">
            删除模板
          </button>
          <input v-model="form.模板说明" class="input input-bordered input-sm min-w-0 flex-1" placeholder="模板说明">
          <button @click="emit('close')" class="btn btn-ghost btn-sm">取消</button>
          <button @click="save" class="btn btn-primary btn-sm">保存模板</button>
        </footer>
      </div>
    </div>
    <form @click="emit('close')" class="modal-backdrop" method="dialog">
      <button>close</button>
    </form>
  </dialog>
</template>
