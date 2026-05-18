<script setup>
import { computed, reactive, ref, watch } from "vue";
import OptionTreeSelect from "@/components/common/OptionTreeSelect.vue";
import { useModalEsc } from "@/composables/useModalEsc";
import { useTour } from "@/composables/useTour";
import {
  BUILTIN_FORMULA_HELPERS,
  CALC_METHOD_OPTIONS,
  CONDITION_OPERATOR_OPTIONS,
  MATCH_MODE_OPTIONS,
  YES_NO_OPTIONS,
} from "@/constants/schema";

import {
  createEmptyCondition,
  createEmptyRule,
  createInitialConditionTree,
  serializeConditionState,
} from "@/domain/rule-form";
import { useConfigStore } from "@/stores/config";

const props = defineProps({
  cpId: String,
  open: Boolean,
  ruleIdx: Number,
  templateId: String,
});
const emit = defineEmits(["save", "delete", "close"]);
useModalEsc(
  () => props.open,
  () => emit("close"),
);
const { startTour } = useTour();

const store = useConfigStore();
const form = reactive({});
const condPool = ref([]);
const condTree = ref({
  children: [],
  linkOp: "",
  op: "AND",
  type: "group",
});

const ruleEditorHelpSteps = [
  {
    element: "[data-tour=\"rule-basic\"]",
    popover: {
      description: "先填写规则编号、费用名称、顺序和输出字段。顺序越小越先执行。",
      title: "规则基础信息",
    },
  },
  {
    element: "[data-tour=\"rule-conditions\"]",
    popover: {
      description:
        "条件支持 AND/OR 组合、子组嵌套，以及等于、大于、介于、属于、为空等灵活运算。字段和值优先使用树形选择器。",
      title: "触发条件",
    },
  },
  {
    element: "[data-tour=\"rule-calc\"]",
    popover: {
      description: "计算方式支持查表、百分比、固定值、加总和公式。公式可插入字段和内置函数。",
      title: "计算配置",
    },
  },
];

const outputKeys = computed(() =>
  store
    .getFieldsByCountry(props.cpId)
    .filter(f => f.输入输出 === "输出")
    .map(f => ({
      label: f.字段名称 ? `${f.字段名称}（${f.字段键}）` : f.字段键,
      value: f.字段键,
    })),
);
const allLookupNames = computed(() => Object.keys(store.lookupTables));
const flatTree = computed(() => (condTree.value ? flattenTree(condTree.value) : []));
const fieldSelectOptions = computed(() =>
  store.getFieldsByCountry(props.cpId).map(f => ({
    label: f.字段名称 ? `${f.字段名称}（${f.字段键}）` : f.字段键,
    value: f.字段键,
  })),
);

const yesNoOptions = YES_NO_OPTIONS;
const operatorOptions = CONDITION_OPERATOR_OPTIONS;
const calcMethodOptions = CALC_METHOD_OPTIONS;
const matchModeOptions = MATCH_MODE_OPTIONS;
const formulaHelpers = BUILTIN_FORMULA_HELPERS;
const formulaFieldToAdd = ref("");
const sumFieldToAdd = ref("");

function emptyCond() {
  return createEmptyCondition();
}

function ensureCond(idx) {
  const n = Number(idx);
  if (!Number.isInteger(n) || n < 0)
    return null;
  if (!Array.isArray(condPool.value))
    condPool.value = [];
  while (condPool.value.length <= n) condPool.value.push(emptyCond());
  condPool.value[n] = {
    ...emptyCond(),
    ...(condPool.value[n] || {}),
  };
  return condPool.value[n];
}

function getCondValue(idx, key) {
  return ensureCond(idx)?.[key] ?? "";
}

function setCondValue(idx, key, value) {
  const cond = ensureCond(idx);
  if (cond)
    cond[key] = value;
}

function normalizeCondState() {
  if (!Array.isArray(condPool.value))
    condPool.value = [];
  condPool.value = condPool.value.map(c => ({ ...emptyCond(), ...(c || {}) }));

  function normalizeNode(node, isRoot = false) {
    if (!node || typeof node !== "object") {
      return isRoot ? { children: [], linkOp: "", op: "AND", type: "group" } : null;
    }

    if (node.type === "cond") {
      let idx = Number(node.idx);
      if (!Number.isInteger(idx) || idx < 0) {
        idx = condPool.value.length;
        condPool.value.push(emptyCond());
      }
      ensureCond(idx);
      return {
        idx,
        op: node.op || "",
        type: "cond",
      };
    }

    const rawChildren = Array.isArray(node.children) ? node.children : [];
    const children = rawChildren.map(ch => normalizeNode(ch)).filter(Boolean);
    return {
      children,
      linkOp: node.linkOp || "",
      op: node.op === "OR" ? "OR" : "AND",
      type: "group",
    };
  }

  const root = normalizeNode(condTree.value, true);
  condTree.value
    = root && root.type === "group" ? root : { children: [], linkOp: "", op: "AND", type: "group" };

  if (!condTree.value.children.length) {
    ensureCond(0);
    condTree.value.children.push({ idx: 0, op: "", type: "cond" });
  }
}

function flattenTree(node, depth = 0, parent = null, idx = 0) {
  if (!node || typeof node !== "object")
    return [];
  const nodeType = node.type === "group" ? "group-open" : "cond";
  const items = [
    {
      depth,
      idx,
      node,
      parent,
      type: nodeType,
    },
  ];
  if (node.type === "group") {
    const children = Array.isArray(node.children) ? node.children : [];
    for (let i = 0; i < children.length; i++)
      items.push(...flattenTree(children[i], depth + 1, node, i));
    items.push({
      depth,
      idx,
      node,
      parent,
      type: "group-close",
    });
  }
  return items;
}

function initCondTree() {
  condPool.value = [emptyCond()];
  condTree.value = createInitialConditionTree();
}

function addCond(parentGroup, op) {
  const idx = condPool.value.length;
  condPool.value.push(emptyCond());
  parentGroup.children.push({
    idx,
    op: op || "AND",
    type: "cond",
  });
}
function addSubGroup(parentGroup) {
  const g = {
    children: [],
    linkOp: "AND",
    op: "AND",
    type: "group",
  };
  parentGroup.children.push(g);
  addCond(g, "AND");
}
function delNode(parentGroup, i) {
  parentGroup.children.splice(i, 1);
}
function toggleGroupOp(node) {
  node.op = node.op === "AND" ? "OR" : "AND";
}
function toggleLinkOp(item) {
  if (item.type === "cond") {
    item.node.op = item.node.op === "AND" ? "OR" : "AND";
  }
  else if (item.type === "group-open") {
    item.node.linkOp = item.node.linkOp === "AND" ? "OR" : "AND";
  }
}

function serializeCondTree() {
  normalizeCondState();

  return serializeConditionState({
    form,
    pool: condPool.value,
    tree: condTree.value,
  });
}

function deserializeCondTree(r) {
  if (r.条件数据) {
    try {
      const d = JSON.parse(r.条件数据);
      condPool.value = d.pool || [];
      condTree.value = d.tree || {
        children: [
          {
            idx: 0,
            op: "",
            type: "cond",
          },
        ],
        linkOp: "",
        op: "AND",
        type: "group",
      };
      normalizeCondState();
      return;
    }
    catch {
      /* fall through */
    }
  }
  condPool.value = [];
  for (let i = 1; i <= 4; i++) {
    condPool.value.push({
      值: r[`条件${i}值`] || "",
      值2: r[`条件${i}值2`] || "",
      字段: r[`条件${i}字段`] || "",
      运算符: r[`条件${i}运算符`] || "等于",
    });
  }
  condTree.value = {
    children: [],
    linkOp: "",
    op: "AND",
    type: "group",
  };
  for (let i = 0; i < condPool.value.length; i++) {
    if (condPool.value[i].字段) {
      condTree.value.children.push({
        idx: i,
        op: i > 0 ? "AND" : "",
        type: "cond",
      });
    }
  }
  if (!condTree.value.children.length) {
    condTree.value.children.push({
      idx: 0,
      op: "",
      type: "cond",
    });
  }
  normalizeCondState();
}

function getFieldDef(fieldKey) {
  return store.getField(fieldKey, props.cpId) || {};
}

function getFieldOptionRootId(fieldKey) {
  const field = getFieldDef(fieldKey);
  return field.类型 === "下拉" ? field.选项组编号 || "" : "";
}

function conditionNeedsSecondValue(idx) {
  return ["介于", "不介于"].includes(getCondValue(idx, "运算符"));
}

function appendFieldToFormula(fieldKey) {
  if (!fieldKey)
    return;
  form.公式 = `${form.公式 || ""}{${fieldKey}}`;
  formulaFieldToAdd.value = "";
}

function appendHelperToFormula(value) {
  if (!value)
    return;
  form.公式 = `${form.公式 || ""}${value}`;
}

function appendFieldToSum(fieldKey) {
  if (!fieldKey)
    return;
  const parts = String(form.加总字段 || "")
    .split(/[|,，;；、\n]/)
    .map(s => s.trim())
    .filter(Boolean);
  if (!parts.includes(fieldKey))
    parts.push(fieldKey);
  form.加总字段 = parts.join(",");
  sumFieldToAdd.value = "";
}

function resetRuleForm() {
  Object.keys(form).forEach(k => delete form[k]);
  Object.assign(form, createEmptyRule(props.templateId));
  initCondTree();
}

watch(
  () => props.open,
  (v) => {
    if (!v)
      return;
    if (props.ruleIdx < 0)
      resetRuleForm();
  },
);

defineExpose({
  openEdit(ruleData) {
    Object.keys(form).forEach(k => delete form[k]);
    Object.assign(form, JSON.parse(JSON.stringify(ruleData)), { 所属模板: props.templateId });
    deserializeCondTree(ruleData);
  },
  save() {
    return serializeCondTree();
  },
});
</script>

<template>
  <dialog @cancel.prevent class="modal" :open="open">
    <div class="modal-box max-h-[85vh] w-[min(44rem,calc(100vw-1rem))] max-w-none overflow-y-auto">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg">
          {{ ruleIdx >= 0 ? "编辑规则" : "新建规则" }}
        </h3>
        <button
          @click="startTour(ruleEditorHelpSteps)"
          class="btn btn-circle btn-ghost btn-sm"
          title="规则帮助"
        >
          ?
        </button>
      </div>
      <div class="gap-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-4" data-tour="rule-basic">
        <div>
          <label class="label py-0 text-xs">编号</label><input v-model="form.编号" class="input input-bordered input-sm w-full">
        </div>
        <div>
          <label class="label py-0 text-xs">费用名称</label><input v-model="form.费用名称" class="input input-bordered input-sm w-full">
        </div>
        <div>
          <label class="label py-0 text-xs">顺序</label><input
            v-model="form.计算顺序"
            class="input input-bordered input-sm w-full"
            type="number"
          >
        </div>
        <div>
          <label class="label py-0 text-xs">启用</label>
          <OptionTreeSelect
            v-model="form.启用"
            :options="yesNoOptions"
            placeholder="—"
            size="sm"
          />
        </div>
      </div>
      <div class="mb-3">
        <label class="label py-0 text-xs">输出字段键</label>
        <OptionTreeSelect
          v-model="form.输出字段键"
          :options="outputKeys"
          placeholder="选择输出字段"
          size="sm"
        />
      </div>

      <fieldset class="bg-base-200 fieldset mb-3 p-3" data-tour="rule-conditions">
        <legend class="font-semibold text-sm">条件</legend>
        <template v-for="(item, i) in flatTree" :key="i">
          <div
            v-if="item.type === 'group-open'"
            class="flex gap-2 items-center mb-1 mt-1"
            :style="{ marginLeft: `${item.depth * 16}px` }"
          >
            <button v-if="item.depth > 0" @click="toggleGroupOp(item.node)" class="btn btn-xs">
              {{ item.node.op }}
            </button>
            <button @click="addCond(item.node, 'AND')" class="btn btn-ghost btn-xs">＋ AND</button>
            <button @click="addCond(item.node, 'OR')" class="btn btn-ghost btn-xs">＋ OR</button>
            <button @click="addSubGroup(item.node)" class="btn btn-ghost btn-xs">＋子组</button>
            <button
              v-if="item.depth > 0"
              @click="delNode(item.parent, item.idx)"
              class="btn btn-ghost btn-xs text-error"
            >
              ✕
            </button>
          </div>
          <div
            v-else-if="item.type === 'cond'"
            class="flex gap-2 items-center mb-1"
            :style="{ marginLeft: `${item.depth * 16}px` }"
          >
            <button
              v-if="item.idx > 0"
              @click="toggleLinkOp(item)"
              class="btn btn-ghost btn-xs font-bold text-primary w-8"
            >
              {{ item.node.op }}
            </button>
            <span v-else class="w-8" />
            <div class="min-w-32 flex-1">
              <OptionTreeSelect
                @update:model-value="setCondValue(item.node.idx, '字段', $event)"
                :modelValue="getCondValue(item.node.idx, '字段')"
                :options="fieldSelectOptions"
                placeholder="字段"
                size="xs"
              />
            </div>
            <div class="w-28">
              <OptionTreeSelect
                @update:model-value="setCondValue(item.node.idx, '运算符', $event)"
                :modelValue="getCondValue(item.node.idx, '运算符')"
                :options="operatorOptions"
                placeholder="—"
                size="xs"
              />
            </div>
            <div class="w-32">
              <OptionTreeSelect
                v-if="getFieldOptionRootId(getCondValue(item.node.idx, '字段'))"
                @update:model-value="setCondValue(item.node.idx, '值', $event)"
                :modelValue="getCondValue(item.node.idx, '值')"
                :optionGroupsData="store['选项组']"
                :optionItems="store['选项值']"
                placeholder="值"
                :rootGroupId="getFieldOptionRootId(getCondValue(item.node.idx, '字段'))"
                size="xs"
              />
              <input
                v-else
                @input="setCondValue(item.node.idx, '值', $event.target.value)"
                class="input input-bordered input-xs w-full"
                placeholder="值"
                :value="getCondValue(item.node.idx, '值')"
              >
            </div>
            <div v-if="conditionNeedsSecondValue(item.node.idx)" class="w-28">
              <input
                @input="setCondValue(item.node.idx, '值2', $event.target.value)"
                class="input input-bordered input-xs w-full"
                placeholder="值2"
                :value="getCondValue(item.node.idx, '值2')"
              >
            </div>
            <button @click="delNode(item.parent, item.idx)" class="btn btn-ghost btn-xs text-error">
              ✕
            </button>
          </div>
        </template>
      </fieldset>
      <fieldset class="fieldset mb-3" data-tour="rule-calc">
        <legend class="font-semibold text-sm">计算配置</legend>
        <div class="mb-2 w-40">
          <OptionTreeSelect
            v-model="form.计算方式"
            :options="calcMethodOptions"
            placeholder="— 选择 —"
            size="sm"
          />
        </div>
        <template v-if="form.计算方式 === '查表'">
          <div class="gap-2 grid grid-cols-1 sm:grid-cols-2">
            <div>
              <label class="label py-0 text-xs">查表名称</label>
              <OptionTreeSelect
                v-model="form.查表名称"
                :options="allLookupNames"
                placeholder="—"
                size="sm"
              />
            </div>
            <div>
              <label class="label py-0 text-xs">匹配方式</label>
              <OptionTreeSelect
                v-model="form.匹配方式"
                :options="matchModeOptions"
                placeholder="—"
                size="sm"
              />
            </div>
            <div>
              <label class="label py-0 text-xs">输入映射</label><input v-model="form.输入映射" class="input input-bordered input-sm w-full">
            </div>
            <div>
              <label class="label py-0 text-xs">输出列</label><input v-model="form.输出列" class="input input-bordered input-sm w-full">
            </div>
          </div>
        </template>
        <template v-if="form.计算方式 === '百分比'">
          <div class="gap-2 grid grid-cols-1 sm:grid-cols-3">
            <div>
              <label class="label py-0 text-xs">基数</label>
              <OptionTreeSelect
                v-model="form.百分比基数"
                :options="fieldSelectOptions"
                placeholder="选择基数字段"
                size="sm"
              />
            </div>
            <div>
              <label class="label py-0 text-xs">固定%值</label><input v-model="form.百分比值" class="input input-bordered input-sm w-full">
            </div>
            <div>
              <label class="label py-0 text-xs">动态来源</label>
              <OptionTreeSelect
                v-model="form.百分比来源字段"
                :options="fieldSelectOptions"
                placeholder="选择来源字段"
                size="sm"
              />
            </div>
          </div>
        </template>
        <template v-if="form.计算方式 === '固定值'">
          <div>
            <label class="label py-0 text-xs">固定金额</label><input v-model="form.固定金额" class="input input-bordered input-sm w-32">
          </div>
        </template>
        <template v-if="form.计算方式 === '加总'">
          <div class="space-y-2">
            <label class="label py-0 text-xs">加总字段（逗号分隔）</label>
            <input
              v-model="form.加总字段"
              class="input input-bordered input-sm w-full"
              placeholder="如：销售佣金金额,运费"
            >
            <div class="flex gap-2 items-center">
              <OptionTreeSelect
                v-model="sumFieldToAdd"
                :options="fieldSelectOptions"
                placeholder="选择字段追加"
                size="xs"
              />
              <button @click="appendFieldToSum(sumFieldToAdd)" class="btn btn-ghost btn-xs">
                追加
              </button>
            </div>
          </div>
        </template>
        <template v-if="form.计算方式 === '公式'">
          <div class="space-y-2">
            <label class="label py-0 text-xs">公式</label>
            <input
              v-model="form.公式"
              class="font-mono input input-bordered input-sm w-full"
              placeholder="支持 {售价} - {总费用}、IF、SUM、ROUND、MIN、MAX"
            >
            <div class="flex flex-wrap gap-2 items-center">
              <OptionTreeSelect
                v-model="formulaFieldToAdd"
                :options="fieldSelectOptions"
                placeholder="选择字段插入"
                size="xs"
              />
              <button @click="appendFieldToFormula(formulaFieldToAdd)" class="btn btn-ghost btn-xs">
                插入字段
              </button>
              <button
                @click="appendHelperToFormula(helper.value)"
                v-for="helper in formulaHelpers"
                :key="helper.value"
                class="btn btn-ghost btn-xs"
              >
                {{ helper.label }}
              </button>
            </div>
          </div>
        </template>
      </fieldset>

      <div class="mb-4">
        <label class="label py-0 text-xs">说明</label><input v-model="form.说明" class="input input-bordered input-sm w-full">
      </div>
      <div class="modal-action">
        <button
          v-if="ruleIdx >= 0"
          @click="emit('delete')"
          class="btn btn-error btn-outline btn-sm"
        >
          删除规则
        </button>
        <button @click="emit('close')" class="btn btn-ghost btn-sm">取消</button>
        <button @click="emit('save', serializeCondTree())" class="btn btn-primary btn-sm">
          保存
        </button>
      </div>
    </div>
    <form @click="emit('close')" class="modal-backdrop" method="dialog">
      <button>关闭</button>
    </form>
  </dialog>
</template>
