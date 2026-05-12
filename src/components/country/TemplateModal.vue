<script setup>
import { driver } from "driver.js";
import { computed, reactive, ref, watch } from "vue";
import { useSortable } from "@/composables/useSortable";
import { useConfigStore } from "@/stores/config";
import ConfirmModal from "./ConfirmModal.vue";
import LookupTableModal from "./LookupTableModal.vue";
import RuleEditorModal from "./RuleEditorModal.vue";
import "driver.js/dist/driver.css";

const props = defineProps({
  open: Boolean,
  templateIdx: Number,
  cpId: String,
});
const emit = defineEmits(["close"]);

const store = useConfigStore();
const form = reactive({});
const rules = ref([]);
const rulesTableBodyRef = ref(null);
let _ruleUid = 0;
useSortable(rulesTableBodyRef, rules, { handle: ".drag-handle", animation: 200 });
const editingRuleIdx = ref(-1);
const showRuleModal = ref(false);
const showLookupModal = ref(false);
const lookupTableName = ref("");
const showConfirmModal = ref(false);
const confirmMessage = ref("");
const confirmAction = ref(() => {});

const allLookupNames = computed(() => Object.keys(store.lookupTables));
const newLookupName = ref("");
const showNewLookupInput = ref(false);

const templateEditSteps = [
  {
    popover: {
      title: "编辑模板",
      description:
        "计算模板定义一套费用计算方案，包含多条费用规则和查表数据。一个模板归属一个国家平台。",
    },
  },
  {
    element: '[data-tour="tpl-rules"]',
    popover: {
      title: "费用规则",
      description:
        "按计算顺序执行。点击规则行可编辑详细条件与计算方式。同行多个条件默认AND，多行同输出字段默认OR。拖拽左侧三条杠可排序。",
    },
  },
  {
    element: '[data-tour="tpl-lookups"]',
    popover: {
      title: "查表数据",
      description: '新建或编辑费率表。规则中的"查表"计算方式会引用这些表。可自由增删行列，改表名。',
    },
  },
];

const ruleRef = ref(null);

function startTour(steps) {
  const d = driver({
    showProgress: true,
    animate: true,
    prevBtnText: "上一步",
    nextBtnText: "下一步",
    doneBtnText: "知道了",
    closeBtnText: "✕",
  });
  d.setSteps(steps);
  d.drive();
}

watch(
  () => props.open,
  (v) => {
    if (!v) return;
    _ruleUid = 0;
    if (props.templateIdx >= 0) {
      const templates = store.getTemplatesByCountry(props.cpId);
      Object.assign(form, JSON.parse(JSON.stringify(templates[props.templateIdx])));
      rules.value = JSON.parse(
        JSON.stringify(store.getFeeRulesByTemplate(templates[props.templateIdx].编号)),
      ).map((r) => ({ ...r, _uid: ++_ruleUid }));
    } else {
      Object.assign(form, { 编号: "", 名称: "", 所属国家平台: props.cpId, 启用: "是", 说明: "" });
      rules.value = [];
    }
  },
);

function condSummary(r) {
  const a = [1, 2]
    .map((i) =>
      r[`条件${i}字段`]
        ? `${r[`条件${i}字段`]} ${r[`条件${i}运算符`] || ""} ${r[`条件${i}值`]}`
        : "",
    )
    .filter(Boolean)
    .join(" AND ");
  const b = [3, 4]
    .map((i) =>
      r[`条件${i}字段`]
        ? `${r[`条件${i}字段`]} ${r[`条件${i}运算符`] || ""} ${r[`条件${i}值`]}`
        : "",
    )
    .filter(Boolean)
    .join(" AND ");
  if (a && b) return `(${a}) OR (${b})`;
  return a || b || "—";
}

function openNewRule() {
  editingRuleIdx.value = -1;
  showRuleModal.value = true;
}

function openEditRule(idx) {
  editingRuleIdx.value = idx;
  showRuleModal.value = true;
  if (ruleRef.value) {
    ruleRef.value.openEdit(rules.value[idx]);
  }
}

function onRuleSave(formData) {
  if (editingRuleIdx.value >= 0) {
    rules.value[editingRuleIdx.value] = {
      ...formData,
      _uid: rules.value[editingRuleIdx.value]._uid || ++_ruleUid,
    };
  } else {
    rules.value.push({ ...formData, _uid: ++_ruleUid });
  }
  showRuleModal.value = false;
}

function onRuleDelete() {
  if (editingRuleIdx.value >= 0) rules.value.splice(editingRuleIdx.value, 1);
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
  store.lookupTables = { ...store.lookupTables, [name]: [] };
  newLookupName.value = "";
  showNewLookupInput.value = false;
}

function deleteLookup(name) {
  confirmMessage.value = `删除查表「${name}」？`;
  confirmAction.value = () => {
    delete store.lookupTables[name];
    store.lookupTables = { ...store.lookupTables };
    for (const r of store["费用规则"]) {
      if (r.查表名称 === name) r.查表名称 = "";
    }
    for (const r of rules.value) {
      if (r.查表名称 === name) r.查表名称 = "";
    }
  };
  showConfirmModal.value = true;
}

function save() {
  if (props.templateIdx >= 0) {
    const templates = store.getTemplatesByCountry(props.cpId);
    const x = store["计算模板"].indexOf(templates[props.templateIdx]);
    if (x !== -1) store["计算模板"][x] = { ...form };
    const keepR = store["费用规则"].filter((r) => r.所属模板 !== form.编号);
    store["费用规则"] = [...keepR, ...rules.value];
  } else {
    store["计算模板"].push({ ...form });
    store["费用规则"] = [...store["费用规则"], ...rules.value];
  }
  emit("close");
}

function deleteTemplate() {
  if (props.templateIdx >= 0) {
    const templates = store.getTemplatesByCountry(props.cpId);
    const t = templates[props.templateIdx];
    store["计算模板"] = store["计算模板"].filter((r) => r.编号 !== t.编号);
    store["费用规则"] = store["费用规则"].filter((r) => r.所属模板 !== t.编号);
  }
  emit("close");
}

function onConfirmOk() {
  confirmAction.value();
  showConfirmModal.value = false;
}
</script>

<template>
  <dialog :open="open" class="modal">
    <div class="modal-box w-11/12 max-w-4xl max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold">
          {{ templateIdx >= 0 ? "编辑模板" : "新建模板" }}
        </h3>
        <button class="btn btn-ghost btn-sm btn-circle" @click="startTour(templateEditSteps)">
          ?
        </button>
      </div>
      <div class="grid grid-cols-4 gap-3 mb-4">
        <div>
          <label class="label py-0 text-xs">编号</label
          ><input v-model="form.编号" class="input input-bordered input-sm w-full" />
        </div>
        <div>
          <label class="label py-0 text-xs">名称</label
          ><input v-model="form.名称" class="input input-bordered input-sm w-full" />
        </div>
        <div>
          <label class="label py-0 text-xs">启用</label
          ><select v-model="form.启用" class="select select-bordered select-sm w-full">
            <option>是</option>
            <option>否</option>
          </select>
        </div>
        <div>
          <label class="label py-0 text-xs">说明</label
          ><input v-model="form.说明" class="input input-bordered input-sm w-full" />
        </div>
      </div>

      <!-- 费用规则 — 拖拽排序 -->
      <div class="mb-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-semibold">费用规则（{{ rules.length }} 条）</span>
          <button class="btn btn-xs btn-primary" @click="openNewRule">＋</button>
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
          <tbody ref="rulesTableBodyRef">
            <tr
              v-for="(r, i) in rules"
              :key="r._uid || r.编号 || i"
              class="sortable-item hover cursor-pointer"
            >
              <td>
                <span
                  class="drag-handle cursor-grab text-base-content/30 hover:text-base-content flex items-center justify-center select-none text-xs"
                  title="拖拽排序"
                  >☰</span
                >
              </td>
              <td class="font-mono text-xs" @click="openEditRule(i)">
                {{ r.编号 }}
              </td>
              <td @click="openEditRule(i)">
                {{ r.输出字段键 }}
              </td>
              <td @click="openEditRule(i)">
                <span class="badge badge-xs">{{ r.计算方式 }}</span>
              </td>
              <td class="text-xs text-base-content/60" @click="openEditRule(i)">
                {{ condSummary(r) }}
              </td>
              <td @click="openEditRule(i)">
                {{ r.计算顺序 }}
              </td>
              <td>
                <button class="btn btn-ghost btn-xs text-error" @click.stop="deleteRuleInline(i)">
                  ✕
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="text-xs text-base-content/40">暂无规则</div>
      </div>

      <!-- 查表数据 — table展示 -->
      <div class="mb-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-semibold" data-tour="tpl-lookups"
            >查表数据（{{ allLookupNames.length }} 个）</span
          >
          <div class="flex gap-1 items-center">
            <input
              v-if="showNewLookupInput"
              v-model="newLookupName"
              class="input input-bordered input-xs w-32"
              placeholder="表名"
              @keyup.enter="openNewLookup"
            />
            <button class="btn btn-xs btn-primary" @click="openNewLookup">＋ 新建表</button>
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
              <td class="text-xs text-base-content/60">
                {{ (store.lookupTables[name] || []).length }} 行
              </td>
              <td class="flex gap-1">
                <button class="btn btn-ghost btn-xs" @click="openLookup(name)">📊 编辑</button>
                <button class="btn btn-ghost btn-xs text-error" @click="deleteLookup(name)">
                  🗑️
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="text-xs text-base-content/40">无</div>
      </div>

      <div class="modal-action">
        <button
          v-if="templateIdx >= 0"
          class="btn btn-error btn-sm btn-outline"
          @click="deleteTemplate"
        >
          删除模板
        </button>
        <button class="btn btn-ghost btn-sm" @click="emit('close')">取消</button>
        <button class="btn btn-primary btn-sm" @click="save">保存</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="emit('close')">
      <button>关闭</button>
    </form>
  </dialog>

  <RuleEditorModal
    ref="ruleRef"
    :open="showRuleModal"
    :rule-idx="editingRuleIdx"
    :template-id="form.编号"
    :cp-id="cpId"
    @save="onRuleSave"
    @delete="onRuleDelete"
    @close="showRuleModal = false"
  />
  <LookupTableModal
    :open="showLookupModal"
    :table-name="lookupTableName"
    @close="showLookupModal = false"
  />
  <ConfirmModal
    :open="showConfirmModal"
    :message="confirmMessage"
    @ok="onConfirmOk"
    @close="showConfirmModal = false"
  />
</template>
