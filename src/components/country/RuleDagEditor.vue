<script setup>
import { computed, nextTick, reactive, ref, watch } from "vue";
import { collectGraphInputNodes, createGraphNode, dedupeEdges, GRAPH_NODE_TYPES, nodeTypeLabel, normalizeGraph, serializeGraph, syncEdgesForNode } from "@/domain/rule-graph";
import { executeFlow } from "@/services/graph-engine";
import RuleDagNodeCard from "./RuleDagNodeCard.vue";
import RuleDagNodeConfig from "./RuleDagNodeConfig.vue";

const props = defineProps({
  fieldOptions: Array,
  graphJson: String,
  lookupTables: Object,
  outputOptions: Array,
  ruleId: String,
  ruleName: String,
});
const emit = defineEmits(["update:graphJson"]);

const nodes = ref([]);
const edges = ref([]);
const selectedNodeId = ref(null);
const preview = ref(null);
const showPreviewPanel = ref(false);
const previewInputs = reactive({});

let lastEmitted = "";
let suppressSync = false;

const lookupNames = computed(() => Object.keys(props.lookupTables || {}));
const nodeOptions = computed(() => nodes.value.map(n => ({ label: n.data?.label || n.id, value: n.id })));
const selectedNode = computed(() => nodes.value.find(n => n.id === selectedNodeId.value) || null);

const lookupColumnCache = computed(() => {
  const cache = {};
  for (const [name, rows] of Object.entries(props.lookupTables || {})) {
    const columns = new Set();
    for (const row of (rows || []).slice(0, 20)) {
      for (const key of Object.keys(row || {})) {
        if (key)
          columns.add(key);
      }
    }
    cache[name] = [...columns];
  }
  return cache;
});

function getLookupColumns(sheet) {
  return lookupColumnCache.value[sheet] || [];
}

const inputNodes = computed(() => collectGraphInputNodes({ nodes: nodes.value }));

watch(
  () => props.graphJson,
  (json) => {
    if (json === lastEmitted)
      return;
    suppressSync = true;
    const graph = normalizeGraph(json);
    nodes.value = graph.nodes;
    edges.value = dedupeEdges(graph.edges);
    nextTick(() => suppressSync = false);
  },
  { immediate: true },
);

function commit() {
  if (suppressSync)
    return;
  const cleanNodes = nodes.value.map(n => ({
    data: { ...n.data },
    id: n.id,
    position: n.position || { x: 0, y: 0 },
    type: n.type || "ruleGraph",
  }));
  const json = serializeGraph({ edges: dedupeEdges(edges.value), nodes: cleanNodes });
  if (json === lastEmitted)
    return;
  lastEmitted = json;
  emit("update:graphJson", json);
}

function addNode(kind) {
  const node = createGraphNode(kind, { x: 0, y: 0 });
  nodes.value.push(node);
  selectedNodeId.value = node.id;
  commit();
}

function updateNode(updatedNode) {
  const idx = nodes.value.findIndex(n => n.id === updatedNode.id);
  if (idx < 0)
    return;
  nodes.value[idx] = updatedNode;
  // Auto-sync edges for this node
  const graph = { edges: edges.value, nodes: nodes.value };
  syncEdgesForNode(graph, updatedNode.id);
  edges.value = dedupeEdges(graph.edges);
  commit();
}

function removeNode(id) {
  nodes.value = nodes.value.filter(n => n.id !== id);
  edges.value = edges.value.filter(e => e.source !== id && e.target !== id);
  if (selectedNodeId.value === id)
    selectedNodeId.value = null;
  commit();
}

function selectNode(id) {
  selectedNodeId.value = id;
}

function openPreviewPanel() {
  showPreviewPanel.value = true;
  const seen = new Set();
  for (const key of Object.keys(previewInputs)) {
    if (!inputNodes.value.find(n => n.field === key))
      delete previewInputs[key];
  }
  for (const node of inputNodes.value) {
    const key = node.field || node.label || node.id;
    if (!seen.has(key) && previewInputs[key] === undefined) {
      previewInputs[key] = "";
      seen.add(key);
    }
  }
}

function runPreview() {
  const cleanNodes = nodes.value.map(n => ({
    data: { ...n.data },
    id: n.id,
    position: n.position || { x: 0, y: 0 },
    type: n.type || "ruleGraph",
  }));
  const graph = { edges: dedupeEdges(edges.value), nodes: cleanNodes };
  const flow = { rules: [{ enabled: true, graph, id: props.ruleId, name: props.ruleName || "当前规则", order: 10 }], version: 2 };
  preview.value = executeFlow(flow, props.lookupTables, { ...previewInputs });
}

function nodeDepLabels(node) {
  const deps = [];
  const data = node.data || {};
  if (data.kind === "lookup") {
    for (const w of data.where || []) {
      if (w.source)
        deps.push(w.source);
    }
  }
  else if (data.kind === "map" && data.source) {
    deps.push(data.source);
  }
  else if (data.kind === "pick") {
    if (data.rowSource)
      deps.push(data.rowSource);
    if (data.columnSource)
      deps.push(data.columnSource);
  }
  else if (data.kind === "output" && data.source) {
    deps.push(data.source);
  }
  return deps.map(id => nodes.value.find(n => n.id === id)?.data?.label || id).join(", ");
}
</script>

<template>
  <div class="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] bg-base-200">
    <div class="flex flex-wrap items-center gap-2 border-b border-base-300 bg-base-100 px-3 py-2">
      <span class="text-xs font-semibold opacity-70">新增节点</span>
      <button
        @click="addNode(kind)"
        v-for="kind in GRAPH_NODE_TYPES"
        :key="kind"
        class="btn btn-ghost btn-xs"
      >
        ＋ {{ nodeTypeLabel(kind) }}
      </button>
      <button @click="openPreviewPanel" class="btn btn-outline btn-xs ml-auto">
        试算
      </button>
    </div>

    <div class="min-h-0 overflow-auto p-4">
      <div v-if="!nodes.length" class="grid h-full place-items-center text-sm opacity-40">
        暂无节点，点击上方按钮新增。
      </div>
      <template v-else>
        <div class="grid gap-3 mb-4" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));">
          <div
            v-for="node in nodes"
            :key="node.id"
            class="flex flex-col gap-2"
          >
            <RuleDagNodeCard
              @select="selectNode"
              :node="node"
              :selected="selectedNodeId === node.id"
            />
            <div v-if="nodeDepLabels(node)" class="px-2 text-center text-[11px] opacity-40">
              ← {{ nodeDepLabels(node) }}
            </div>
          </div>
        </div>

        <div class="rounded border border-base-300 bg-base-100 p-3">
          <template v-if="selectedNode">
            <div class="mb-2 flex items-center justify-between">
              <span class="text-xs font-semibold opacity-70">节点配置</span>
              <button @click="removeNode(selectedNode.id)" class="btn btn-ghost btn-xs text-error">
                删除节点
              </button>
            </div>
            <RuleDagNodeConfig
              @update:node="updateNode"
              :key="selectedNode.id"
              :fieldOptions="fieldOptions"
              :lookupColumns="getLookupColumns(selectedNode.data?.sheet)"
              :lookupNames="lookupNames"
              :node="selectedNode"
              :nodeOptions="nodeOptions"
              :outputOptions="outputOptions"
            />
          </template>
          <div v-else class="text-sm opacity-40">
            点击上方节点卡片进行配置
          </div>
        </div>
      </template>
    </div>

    <div v-if="showPreviewPanel" class="border-t border-base-300 bg-base-100 p-3">
      <div class="mb-2 flex items-center justify-between">
        <span class="text-xs font-semibold">试算</span>
        <button @click="showPreviewPanel = false" class="btn btn-ghost btn-xs">✕</button>
      </div>
      <div class="mb-3 grid grid-cols-3 gap-2">
        <div v-for="node in inputNodes" :key="node.id">
          <label class="label py-0 text-xs">{{ node.label || node.field }}</label>
          <input v-model="previewInputs[node.field || node.label || node.id]" class="input input-bordered input-xs w-full">
        </div>
      </div>
      <div class="flex gap-2">
        <button @click="runPreview" class="btn btn-primary btn-xs">执行试算</button>
        <span v-if="preview" class="self-center text-xs">
          <span v-if="preview.errors?.length" class="text-error">{{ preview.errors.join("；") }}</span>
          <span v-else>结果：{{ JSON.stringify(preview.results) }}</span>
        </span>
      </div>
    </div>
  </div>
</template>
