<script setup>
import { computed, reactive, ref, watch } from "vue";
import { useConfigStore } from "@/stores/config";

const props = defineProps({
  cpId: String,
  open: Boolean,
  ruleIdx: Number,
  templateId: String,
});
const emit = defineEmits(["save", "delete", "close"]);

const store = useConfigStore();
const form = reactive({});
const condPool = ref([]);
const condTree = ref({
  children: [],
  linkOp: "",
  op: "AND",
  type: "group",
});

const countryFieldKeys = computed(() => store.getFieldsByCountry(props.cpId).map(f => f.字段键));
const outputKeys = computed(() =>
  store
    .getFieldsByCountry(props.cpId)
    .filter(f => f.输入输出 === "输出")
    .map(f => f.字段键),
);
const allLookupNames = computed(() => Object.keys(store.lookupTables));
const flatTree = computed(() => (condTree.value ? flattenTree(condTree.value) : []));

function flattenTree(node, depth = 0, parent = null, idx = 0) {
  const items = [
    {
      depth,
      idx,
      node,
      parent,
      type: node.type === "group" ? "group-open" : "cond",
    },
  ];
  if (node.type === "group") {
    for (let i = 0; i < node.children.length; i++) {
      items.push(...flattenTree(node.children[i], depth + 1, node, i));
    }
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
  condPool.value = [
    {
      值: "",
      字段: "",
      运算符: "",
    },
  ];
  condTree.value = {
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
}

function addCond(parentGroup, op) {
  const idx = condPool.value.length;
  condPool.value.push({
    值: "",
    字段: "",
    运算符: "",
  });
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
  function dfs(node) {
    if (node.type === "cond")
      return `C${node.idx}`;
    const parts = [];
    for (const ch of node.children) {
      let prefix = "";
      if (ch.type === "cond" && ch.op)
        prefix = ch.op[0];
      else if (ch.type === "group" && ch.linkOp)
        prefix = ch.linkOp[0];
      parts.push(prefix + dfs(ch));
    }
    return `G${node.op[0]}[${parts.join(",")}]`;
  }
  const result = { ...form };
  result.条件结构 = dfs(condTree.value);
  for (let i = 1; i <= 4; i++) {
    const c = condPool.value[i - 1];
    result[`条件${i}字段`] = c ? c.字段 : "";
    result[`条件${i}运算符`] = c ? c.运算符 : "";
    result[`条件${i}值`] = c ? c.值 : "";
    result[`条件${i}值2`] = "";
  }
  result.条件数据 = JSON.stringify({
    pool: condPool.value,
    tree: condTree.value,
  });
  return result;
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
      字段: r[`条件${i}字段`] || "",
      运算符: r[`条件${i}运算符`] || "",
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
}

watch(
  () => props.open,
  (v) => {
    if (!v)
      return;
    if (props.ruleIdx >= 0) {
      Object.assign(form, {
        公式: "",
        加总字段: "",
        匹配方式: "",
        启用: "是",
        固定金额: "",
        所属模板: props.templateId,
        条件结构: "",
        查表名称: "",
        百分比值: "",
        百分比基数: "",
        百分比来源字段: "",
        累加: "否",
        编号: "",
        计算方式: "",
        计算顺序: "",
        说明: "",
        费用名称: "",
        输入映射: "",
        输出列: "",
        输出字段键: "",
      });
      initCondTree();
    }
  },
);

defineExpose({
  openEdit(ruleData) {
    Object.assign(form, JSON.parse(JSON.stringify(ruleData)));
    deserializeCondTree(ruleData);
  },
  save() {
    return serializeCondTree();
  },
});
</script>

<template>
  <dialog class="modal" :open="open">
    <div class="max-h-[85vh] max-w-3xl modal-box overflow-y-auto w-11/12">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg">
          {{ ruleIdx >= 0 ? "编辑规则" : "新建规则" }}
        </h3>
      </div>
      <div class="gap-2 grid grid-cols-4 mb-4">
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
          <label class="label py-0 text-xs">启用</label><select v-model="form.启用" class="select select-bordered select-sm w-full">
            <option>是</option>
            <option>否</option>
          </select>
        </div>
      </div>
      <div class="mb-3">
        <label class="label py-0 text-xs">输出字段键</label><input
          v-model="form.输出字段键"
          class="input input-bordered input-sm w-full"
          list="rOutputKeys"
        ><datalist id="rOutputKeys">
          <option v-for="k in outputKeys" :key="k" :value="k" />
        </datalist>
      </div>

      <fieldset class="bg-base-200 fieldset mb-3 p-3 rounded">
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
            <input
              v-model="condPool[item.node.idx].字段"
              class="flex-1 input input-bordered input-xs"
              list="rFieldKeys"
              placeholder="字段"
            >
            <select
              v-model="condPool[item.node.idx].运算符"
              class="select select-bordered select-xs w-24"
            >
              <option value="">—</option>
              <option>等于</option>
              <option>不等于</option>
              <option>大于</option>
              <option>大于等于</option>
              <option>小于</option>
              <option>小于等于</option>
            </select>
            <input
              v-model="condPool[item.node.idx].值"
              class="input input-bordered input-xs w-20"
              placeholder="值"
            >
            <button @click="delNode(item.parent, item.idx)" class="btn btn-ghost btn-xs text-error">
              ✕
            </button>
          </div>
        </template>
      </fieldset>
      <datalist id="rFieldKeys">
        <option v-for="k in countryFieldKeys" :key="k" :value="k" />
      </datalist>

      <fieldset class="fieldset mb-3">
        <legend class="font-semibold text-sm">计算配置</legend>
        <select v-model="form.计算方式" class="mb-2 select select-bordered select-sm">
          <option value="">— 选择 —</option>
          <option>查表</option>
          <option>百分比</option>
          <option>固定值</option>
          <option>加总</option>
          <option>公式</option>
        </select>
        <template v-if="form.计算方式 === '查表'">
          <div class="gap-2 grid grid-cols-2">
            <div>
              <label class="label py-0 text-xs">查表名称</label><select v-model="form.查表名称" class="select select-bordered select-sm w-full">
                <option value="">—</option>
                <option v-for="n in allLookupNames" :key="n" :value="n">
                  {{ n }}
                </option>
              </select>
            </div>
            <div>
              <label class="label py-0 text-xs">匹配方式</label><select v-model="form.匹配方式" class="select select-bordered select-sm w-full">
                <option value="">—</option>
                <option>精确</option>
                <option>区间</option>
              </select>
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
          <div class="gap-2 grid grid-cols-3">
            <div>
              <label class="label py-0 text-xs">基数</label><input
                v-model="form.百分比基数"
                class="input input-bordered input-sm w-full"
                list="rFieldKeys"
              >
            </div>
            <div>
              <label class="label py-0 text-xs">固定%值</label><input v-model="form.百分比值" class="input input-bordered input-sm w-full">
            </div>
            <div>
              <label class="label py-0 text-xs">动态来源</label><input
                v-model="form.百分比来源字段"
                class="input input-bordered input-sm w-full"
                list="rFieldKeys"
              >
            </div>
          </div>
        </template>
        <template v-if="form.计算方式 === '固定值'">
          <div>
            <label class="label py-0 text-xs">固定金额</label><input v-model="form.固定金额" class="input input-bordered input-sm w-32">
          </div>
        </template>
        <template v-if="form.计算方式 === '加总'">
          <div>
            <label class="label py-0 text-xs">加总字段（逗号分隔）</label><input
              v-model="form.加总字段"
              class="input input-bordered input-sm w-full"
              list="rFieldKeys"
            >
          </div>
        </template>
        <template v-if="form.计算方式 === '公式'">
          <div>
            <label class="label py-0 text-xs">公式</label><input v-model="form.公式" class="font-mono input input-bordered input-sm w-full">
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
