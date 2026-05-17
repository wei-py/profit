<script setup>
import { driver } from "driver.js";
import { computed, nextTick, reactive, ref, watch } from "vue";
import { vDraggable } from "vue-draggable-plus";
import FieldInput from "@/components/common/FieldInput.vue";
import OptionTreeSelect from "@/components/common/OptionTreeSelect.vue";
import { useModalEsc } from "@/composables/useModalEsc";
import { execute } from "@/services/rule-engine";
import { useConfigStore } from "@/stores/config";
import ConfirmModal from "./ConfirmModal.vue";
import LookupTableModal from "./LookupTableModal.vue";
import RuleEditorModal from "./RuleEditorModal.vue";

import "driver.js/dist/driver.css";

const props = defineProps({
  cpId: String,
  open: Boolean,
  templateIdx: Number,
});
const emit = defineEmits(["close"]);
useModalEsc(
  () => props.open,
  () => emit("close"),
);

const store = useConfigStore();
const form = reactive({});
const yesNoOptions = ["是", "否"];
const rules = ref([]);
let _ruleUid = 0;

const dragOpts = {
  animation: 150,
  chosenClass: "drag-chosen",
  dragClass: "drag-drag",
  fallbackOnBody: true,
  forceFallback: true,
  ghostClass: "drag-ghost",
  handle: ".drag-handle",
  onEnd: () => {
    rules.value.forEach((r, i) => {
      r.计算顺序 = i + 1;
    });
  },
};
const editingRuleIdx = ref(-1);
const showRuleModal = ref(false);
const showLookupModal = ref(false);
const lookupTableName = ref("");
const showConfirmModal = ref(false);
const confirmMessage = ref("");
const confirmAction = ref(() => {});
const showRulePreview = ref(false);
const previewInputs = reactive({});
const previewResult = ref(null);

const allLookupNames = computed(() => Object.keys(store.lookupTables));
const newLookupName = ref("");
const showNewLookupInput = ref(false);

const previewFields = computed(() =>
  props.cpId
    ? store
        .getFieldsByCountry(props.cpId)
        .filter(f => f.输入输出 === "输入" && (f.启用 === "是" || f.启用 === "TRUE" || !f.启用))
    : [],
);

const templateEditSteps = [
  {
    element: "[data-tour=\"template-modal\"]",
    popover: {
      description:
        "计算模板定义一套费用计算方案，包含多条费用规则和查表数据。一个模板归属一个国家平台。",
      title: "编辑模板",
    },
  },
  {
    element: "[data-tour=\"tpl-rules\"]",
    popover: {
      description:
        "按计算顺序执行。点击规则行可编辑详细条件与计算方式。同行多个条件默认AND，多行同输出字段默认OR。拖拽左侧三条杠可排序。",
      title: "费用规则",
    },
  },
  {
    element: "[data-tour=\"tpl-lookups\"]",
    popover: {
      description: "新建或编辑费率表。规则中的\"查表\"计算方式会引用这些表。可自由增删行列，改表名。",
      title: "查表数据",
    },
  },
];

const ruleRef = ref(null);

function startTour(steps) {
  const d = driver({
    animate: true,
    closeBtnText: "✕",
    doneBtnText: "知道了",
    nextBtnText: "下一步",
    prevBtnText: "上一步",
    showProgress: true,
  });
  d.setSteps(steps);
  d.drive();
}

watch(
  () => props.open,
  (v) => {
    if (!v)
      return;
    _ruleUid = 0;
    Object.keys(form).forEach(k => delete form[k]);
    if (props.templateIdx >= 0) {
      const templates = store.getTemplatesByCountry(props.cpId);
      const currentTemplate = templates[props.templateIdx] || {};
      Object.assign(form, JSON.parse(JSON.stringify(currentTemplate)));
      rules.value = JSON.parse(
        JSON.stringify(store.getFeeRulesByTemplate(currentTemplate.编号)),
      ).map(r => ({
        ...r,
        _uid: ++_ruleUid,
      }));
    }
    else {
      Object.assign(form, {
        名称: "",
        启用: "是",
        所属国家平台: props.cpId,
        编号: "",
        说明: "",
      });
      rules.value = [];
    }
    showRulePreview.value = false;
    previewResult.value = null;
    syncPreviewInputs();
  },
);

function condSummary(r) {
  const a = [1, 2]
    .map(i =>
      r[`条件${i}字段`]
        ? `${r[`条件${i}字段`]} ${r[`条件${i}运算符`] || ""} ${r[`条件${i}值`]}`
        : "",
    )
    .filter(Boolean)
    .join(" AND ");
  const b = [3, 4]
    .map(i =>
      r[`条件${i}字段`]
        ? `${r[`条件${i}字段`]} ${r[`条件${i}运算符`] || ""} ${r[`条件${i}值`]}`
        : "",
    )
    .filter(Boolean)
    .join(" AND ");
  if (a && b)
    return `(${a}) OR (${b})`;
  return a || b || "—";
}

function syncPreviewInputs() {
  const keys = new Set(previewFields.value.map(f => f.字段键));
  for (const k of Object.keys(previewInputs)) {
    if (!keys.has(k))
      delete previewInputs[k];
  }

  for (const f of previewFields.value) {
    if (previewInputs[f.字段键] !== undefined)
      continue;
    previewInputs[f.字段键] = f.默认值 || "";
  }
}

function runRulePreview() {
  syncPreviewInputs();
  try {
    const { errors, results, traces } = execute(rules.value, store.lookupTables, {
      ...previewInputs,
    });
    previewResult.value = {
      errors,
      results,
      traces,
    };
  }
  catch (e) {
    previewResult.value = {
      errors: [e.message],
      results: {},
      traces: {},
    };
  }
}

function toggleRulePreview() {
  showRulePreview.value = !showRulePreview.value;
  if (showRulePreview.value) {
    syncPreviewInputs();
    runRulePreview();
  }
}

function openNewRule() {
  editingRuleIdx.value = -1;
  showRuleModal.value = true;
}

function openEditRule(idx) {
  editingRuleIdx.value = idx;
  showRuleModal.value = true;
  nextTick(() => {
    if (ruleRef.value)
      ruleRef.value.openEdit(rules.value[idx]);
  });
}

function onRuleSave(formData) {
  if (editingRuleIdx.value >= 0) {
    rules.value[editingRuleIdx.value] = {
      ...formData,
      _uid: rules.value[editingRuleIdx.value]._uid || ++_ruleUid,
    };
  }
  else {
    rules.value.push({
      ...formData,
      _uid: ++_ruleUid,
    });
  }
  showRuleModal.value = false;
}

function onRuleDelete() {
  if (editingRuleIdx.value >= 0)
    rules.value.splice(editingRuleIdx.value, 1);
  showRuleModal.value = false;
}

function deleteRuleInline(i) {
  rules.value.splice(i, 1);
}

function openLookup(name) {
  lookupTableName.value = name;
  showLookupModal.value = true;
}

function openNewLookup() {
  const name = newLookupName.value.trim();
  if (!name) {
    showNewLookupInput.value = true;
    return;
  }
  store.lookupTables = {
    ...store.lookupTables,
    [name]: [],
  };
  newLookupName.value = "";
  showNewLookupInput.value = false;
}

function deleteLookup(name) {
  confirmMessage.value = `删除查表「${name}」？`;
  confirmAction.value = () => {
    delete store.lookupTables[name];
    store.lookupTables = { ...store.lookupTables };
    for (const r of store["费用规则"]) {
      if (r.查表名称 === name)
        r.查表名称 = "";
    }
    for (const r of rules.value) {
      if (r.查表名称 === name)
        r.查表名称 = "";
    }
  };
  showConfirmModal.value = true;
}

function cleanRuleForSave(rule, index) {
  const { _uid, ...data } = rule;
  return {
    ...data,
    所属模板: form.编号,
    计算顺序: data.计算顺序 || index + 1,
  };
}

function save() {
  const rulesForSave = rules.value.map(cleanRuleForSave);
  if (props.templateIdx >= 0) {
    const templates = store.getTemplatesByCountry(props.cpId);
    const currentTemplate = templates[props.templateIdx];
    const previousTemplateId = currentTemplate?.编号 || form.编号;
    const x = store["计算模板"].indexOf(currentTemplate);
    if (x !== -1)
      store["计算模板"][x] = { ...form };
    const keepR = store["费用规则"].filter(
      r => r.所属模板 !== previousTemplateId && r.所属模板 !== form.编号,
    );
    store["费用规则"] = [...keepR, ...rulesForSave];
  }
  else {
    store["计算模板"].push({ ...form });
    store["费用规则"] = [...store["费用规则"], ...rulesForSave];
  }
  emit("close");
}

function deleteTemplate() {
  if (props.templateIdx >= 0) {
    const templates = store.getTemplatesByCountry(props.cpId);
    const t = templates[props.templateIdx];
    store["计算模板"] = store["计算模板"].filter(r => r.编号 !== t.编号);
    store["费用规则"] = store["费用规则"].filter(r => r.所属模板 !== t.编号);
  }
  emit("close");
}

function onConfirmOk() {
  confirmAction.value();
  showConfirmModal.value = false;
}
</script>

<template>
  <dialog @cancel.prevent class="modal" :open="open">
    <div
      class="modal-box max-h-[90vh] w-[min(54rem,calc(100vw-1rem))] max-w-none overflow-y-auto"
      data-tour="template-modal"
    >
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg">
          {{ templateIdx >= 0 ? "编辑模板" : "新建模板" }}
        </h3>
        <button @click="startTour(templateEditSteps)" class="btn btn-circle btn-ghost btn-sm">
          ?
        </button>
      </div>
      <div class="gap-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <div>
          <label class="label py-0 text-xs">编号</label><input v-model="form.编号" class="input input-bordered input-sm w-full">
        </div>
        <div>
          <label class="label py-0 text-xs">名称</label><input v-model="form.名称" class="input input-bordered input-sm w-full">
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
        <div>
          <label class="label py-0 text-xs">说明</label><input v-model="form.说明" class="input input-bordered input-sm w-full">
        </div>
      </div>

      <!-- 费用规则 -->
      <div class="mb-4">
        <div class="flex items-center justify-between mb-2">
          <span class="font-semibold text-sm">费用规则（{{ rules.length }} 条）</span>
          <div class="flex gap-1">
            <button
              @click="startTour(templateEditSteps)"
              class="btn btn-circle btn-ghost btn-xs"
              title="费用规则帮助"
            >
              ?
            </button>
            <button @click="toggleRulePreview" class="btn btn-outline btn-xs">
              {{ showRulePreview ? "收起" : "试算" }}
            </button>
            <button @click="openNewRule" class="btn btn-primary btn-xs">＋</button>
          </div>
        </div>
        <table v-if="rules.length" class="table table-xs">
          <thead>
            <tr data-tour="tpl-rules">
              <th class="w-8" />
              <th>编号</th>
              <th>输出到</th>
              <th>计算方式</th>
              <th>条件</th>
              <th>顺序</th>
              <th />
            </tr>
          </thead>
          <tbody v-draggable="[rules, dragOpts]">
            <tr v-for="(r, i) in rules" :key="r._uid || r.编号 || i" class="cursor-pointer hover">
              <td>
                <span
                  class="drag-handle flex hover:text-base-content items-center justify-center select-none text-base-content/30 text-xs"
                >
                  ☰
                </span>
              </td>
              <td @click="openEditRule(i)" class="font-mono text-xs">
                {{ r.编号 }}
              </td>
              <td @click="openEditRule(i)">
                {{ r.输出字段键 }}
              </td>
              <td @click="openEditRule(i)">
                <span class="badge badge-xs">{{ r.计算方式 }}</span>
              </td>
              <td @click="openEditRule(i)" class="text-base-content/60 text-xs">
                {{ condSummary(r) }}
              </td>
              <td @click="openEditRule(i)">
                {{ r.计算顺序 }}
              </td>
              <td>
                <button @click.stop="deleteRuleInline(i)" class="btn btn-ghost btn-xs text-error">
                  ✕
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="text-base-content/40 text-xs">暂无规则</div>

        <div v-if="showRulePreview" class="mt-2 border border-base-300 bg-base-100 p-3">
          <div class="mb-2 flex items-center justify-between gap-2">
            <div class="font-semibold text-sm">试算</div>
            <button @click="runRulePreview" class="btn btn-primary btn-xs">计算</button>
          </div>

          <div v-if="previewFields.length" class="grid grid-cols-2 gap-2 md:grid-cols-3">
            <FieldInput
              v-model="previewInputs[f.字段键]"
              v-for="f in previewFields"
              :key="f.字段键"
              :field="f"
              :optionGroupsData="store['选项组']"
              :optionItems="store['选项值']"
            />
          </div>
          <div v-else class="text-xs opacity-50">无输入字段</div>

          <div v-if="previewResult" class="mt-3 space-y-2">
            <table
              v-if="Object.keys(previewResult.results || {}).length"
              class="table table-xs bg-base-200"
            >
              <tbody>
                <tr v-for="(val, key) in previewResult.results" :key="key">
                  <td class="font-mono">{{ key }}</td>
                  <td class="text-right">
                    {{ typeof val === "number" ? Number(val).toFixed(4) : val }}
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-else class="bg-base-200 p-2 text-xs opacity-50">暂无结果</div>

            <div v-if="previewResult.errors?.length" class="bg-error/10 p-2 text-error text-xs">
              <div v-for="err in previewResult.errors" :key="err">{{ err }}</div>
            </div>

            <details
              v-if="Object.keys(previewResult.traces || {}).length"
              class="collapse collapse-arrow bg-base-200"
            >
              <summary class="collapse-title min-h-0 px-3 py-2 text-xs font-semibold">命中</summary>
              <div class="collapse-content px-3 pb-2 text-xs">
                <div v-for="(trace, key) in previewResult.traces" :key="key" class="break-all">
                  <span class="font-mono opacity-70">{{ key }}：</span>{{ trace }}
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>

      <!-- 查表数据 — table展示 -->
      <div class="mb-4">
        <div class="flex items-center justify-between mb-2">
          <span
            class="font-semibold text-sm"
            data-tour="tpl-lookups"
          >查表数据（{{ allLookupNames.length }} 个）</span>
          <div class="flex gap-1 items-center">
            <button
              @click="startTour(templateEditSteps)"
              class="btn btn-circle btn-ghost btn-xs"
              title="查表数据帮助"
            >
              ?
            </button>
            <input
              v-if="showNewLookupInput"
              v-model="newLookupName"
              @keyup.enter="openNewLookup"
              class="input input-bordered input-xs w-32"
              placeholder="表名"
            >
            <button @click="openNewLookup" class="btn btn-primary btn-xs">＋ 新建表</button>
          </div>
        </div>
        <table v-if="allLookupNames.length" class="table table-xs">
          <thead>
            <tr>
              <th>表名</th>
              <th>行数</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="name in allLookupNames" :key="name">
              <td class="font-mono text-xs">
                {{ name }}
              </td>
              <td class="text-base-content/60 text-xs">
                {{ (store.lookupTables[name] || []).length }} 行
              </td>
              <td class="flex gap-1">
                <button @click="openLookup(name)" class="btn btn-ghost btn-xs">📊 编辑</button>
                <button @click="deleteLookup(name)" class="btn btn-ghost btn-xs text-error">
                  🗑️
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="text-base-content/40 text-xs">无</div>
      </div>

      <div class="modal-action">
        <button
          v-if="templateIdx >= 0"
          @click="deleteTemplate"
          class="btn btn-error btn-outline btn-sm"
        >
          删除模板
        </button>
        <button @click="emit('close')" class="btn btn-ghost btn-sm">取消</button>
        <button @click="save" class="btn btn-primary btn-sm">保存</button>
      </div>
    </div>
    <form @click="emit('close')" class="modal-backdrop" method="dialog">
      <button>关闭</button>
    </form>
  </dialog>

  <RuleEditorModal
    @close="showRuleModal = false"
    @delete="onRuleDelete"
    @save="onRuleSave"
    ref="ruleRef"
    :cpId="cpId"
    :open="showRuleModal"
    :ruleIdx="editingRuleIdx"
    :templateId="form.编号"
  />
  <LookupTableModal
    @close="showLookupModal = false"
    :open="showLookupModal"
    :tableName="lookupTableName"
  />
  <ConfirmModal
    @close="showConfirmModal = false"
    @ok="onConfirmOk"
    :message="confirmMessage"
    :open="showConfirmModal"
  />
</template>
