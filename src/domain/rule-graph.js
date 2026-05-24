import { normalizeId } from "@/utils/value";

export const GRAPH_NODE_TYPES = ["input", "constant", "lookup", "pick", "map", "calc", "condition", "output"];

/* ---- graph helpers ---- */

export function createEmptyGraph() {
  return {
    edges: [],
    nodes: [],
    version: 1,
  };
}

export function normalizeGraph(value) {
  const parsed = parseAsObject(value, createEmptyGraph());
  return {
    edges: Array.isArray(parsed.edges) ? parsed.edges.filter(edge => edge?.id && edge.source && edge.target) : [],
    nodes: Array.isArray(parsed.nodes) ? parsed.nodes.filter(node => node?.id).map(normalizeNode) : [],
    version: Number(parsed.version) || 1,
  };
}

export function serializeGraph(graph) {
  return JSON.stringify(normalizeGraph(graph));
}

export function createGraphNode(type, position = { x: 120, y: 120 }) {
  const nodeType = GRAPH_NODE_TYPES.includes(type) ? type : "input";
  const id = `${nodeType}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  return normalizeNode({
    data: defaultNodeData(nodeType),
    id,
    position,
    type: "ruleGraph",
  });
}

/* ---- flow / rules helpers ---- */

export function createEmptyFlow() {
  return {
    rules: [],
    version: 2,
  };
}

export function normalizeFlow(value) {
  const parsed = parseAsObject(value, createEmptyFlow());
  return {
    rules: Array.isArray(parsed.rules) ? parsed.rules.filter(rule => rule?.id).map(normalizeRule) : [],
    version: Number(parsed.version) || 2,
  };
}

export function serializeFlow(flow) {
  return JSON.stringify(normalizeFlow(flow), null, 2);
}

export function createEmptyRule(nameHint) {
  const id = `rule_${Date.now()}`;
  return {
    enabled: true,
    graph: createEmptyGraph(),
    id,
    name: nameHint || "新规则",
    order: 10,
  };
}

export function normalizeRule(rule) {
  return {
    enabled: rule.enabled !== false,
    graph: normalizeGraph(rule.graph),
    id: rule.id || `rule_${Date.now()}`,
    name: rule.name || rule.id || "",
    order: Number(rule.order || 10),
  };
}

export function buildDefaultCommissionFlow() {
  const commissionGraph = {
    edges: [
      edge("input_category", "lookup_commission"),
      edge("input_ad_type", "map_ad_type"),
      edge("lookup_commission", "pick_commission"),
      edge("map_ad_type", "pick_commission"),
      edge("pick_commission", "output_commission"),
    ],
    nodes: [
      graphNode("input_category", "input", 80, 120, { field: "商品类目", label: "商品类目", valueMode: "cascadePath" }),
      graphNode("input_ad_type", "input", 80, 300, { field: "广告类型", label: "广告类型" }),
      graphNode("lookup_commission", "lookup", 360, 120, {
        label: "查佣金表",
        sheet: "类目佣金查询表",
        where: [{ column: "chPath", input: "商品类目", operator: "=", source: "input_category", valueMode: "cascadePath" }],
      }),
      graphNode("map_ad_type", "map", 360, 300, {
        label: "广告类型映射",
        map: [
          { from: "经典", to: "classic" },
          { from: "高级", to: "premium" },
        ],
      }),
      graphNode("pick_commission", "pick", 640, 190, { columnSource: "map_ad_type", label: "取佣金列", rowSource: "lookup_commission" }),
      graphNode("output_commission", "output", 920, 190, { field: "销售佣金费率", label: "销售佣金费率" }),
    ],
    version: 1,
  };

  return {
    rules: [
      {
        enabled: true,
        graph: commissionGraph,
        id: "rule_commission_rate",
        name: "销售佣金费率",
        order: 10,
      },
    ],
    version: 2,
  };
}

/* ---- node helpers ---- */

export function nodeTypeLabel(kind) {
  return {
    calc: "计算",
    condition: "条件",
    constant: "常量",
    input: "输入",
    lookup: "查表",
    map: "映射",
    output: "输出",
    pick: "取字段",
  }[kind] || kind;
}

/* ---- edge / dependency helpers ---- */

export function getNodeDependencyIds(nodeData) {
  const ids = [];
  const data = nodeData || {};
  if (data.kind === "lookup") {
    for (const w of data.where || []) {
      if (w.source)
        ids.push(w.source);
    }
  }
  else if (data.kind === "map") {
    if (data.source)
      ids.push(data.source);
  }
  else if (data.kind === "pick") {
    if (data.rowSource)
      ids.push(data.rowSource);
    if (data.columnSource)
      ids.push(data.columnSource);
  }
  else if (data.kind === "calc") {
    for (const d of data.inputs || []) {
      if (d)
        ids.push(d);
    }
  }
  else if (data.kind === "output") {
    if (data.source)
      ids.push(data.source);
  }
  return ids;
}

export function syncEdgesForNode(graph, nodeId) {
  const node = (graph.nodes || []).find(n => n.id === nodeId);
  if (!node)
    return;
  const depIds = getNodeDependencyIds(node.data);
  const nodeIdSet = new Set((graph.nodes || []).map(n => n.id));
  const newEdges = [];
  const otherEdges = (graph.edges || []).filter(e => e.target !== nodeId);
  for (const sourceId of depIds) {
    if (!nodeIdSet.has(sourceId))
      continue;
    newEdges.push({ id: `e_${normalizeId(sourceId)}_${normalizeId(nodeId)}`, source: sourceId, target: nodeId });
  }
  graph.edges = [...otherEdges, ...newEdges];
}

export function dedupeEdges(edges) {
  const seen = new Set();
  return (edges || []).filter((e) => {
    const key = `${e.source}::${e.target}`;
    if (seen.has(key))
      return false;
    seen.add(key);
    return true;
  });
}

export function collectGraphInputNodes(graph) {
  return (graph?.nodes || []).filter(n => n.data?.kind === "input").map(n => ({
    field: n.data?.field || "",
    id: n.id,
    label: n.data?.label || n.id,
    valueMode: n.data?.valueMode || "value",
  }));
}

export function collectFlowInputNodes(flow) {
  const seen = new Set();
  const nodes = [];
  for (const rule of flow?.rules || []) {
    if (!rule.enabled)
      continue;
    for (const n of collectGraphInputNodes(rule.graph)) {
      const key = n.field || n.id;
      if (!seen.has(key)) {
        seen.add(key);
        nodes.push(n);
      }
    }
  }
  return nodes;
}

export function nodeSummary(node) {
  const d = node.data || {};
  if (d.kind === "input")
    return d.field || d.label || "";
  if (d.kind === "lookup")
    return d.sheet || "";
  if (d.kind === "output")
    return d.field || "";
  if (d.kind === "map")
    return (d.map || []).map(r => `${r.from}→${r.to}`).join(", ");
  if (d.kind === "calc")
    return d.expression || "";
  if (d.kind === "constant")
    return d.value ?? "";
  if (d.kind === "pick")
    return d.column || d.columnSource || "";
  return "";
}

/* ---- internal ---- */

function parseAsObject(value, fallback) {
  if (!value)
    return fallback;
  if (typeof value === "object")
    return value;
  try {
    return JSON.parse(value);
  }
  catch {
    return fallback;
  }
}

function normalizeNode(node) {
  const kind = node.data?.kind || "input";
  return {
    ...node,
    data: {
      ...defaultNodeData(kind),
      ...(node.data || {}),
      kind,
    },
    position: node.position || { x: 0, y: 0 },
    type: "ruleGraph",
  };
}

function defaultNodeData(kind) {
  const base = { kind, label: nodeTypeLabel(kind) };
  if (kind === "lookup")
    return { ...base, sheet: "", where: [] };
  if (kind === "map")
    return { ...base, map: [{ from: "", to: "" }] };
  if (kind === "calc")
    return { ...base, expression: "" };
  if (kind === "condition")
    return { ...base, condition: "" };
  return base;
}

function graphNode(id, kind, x, y, data) {
  return normalizeNode({ data: { ...data, kind }, id, position: { x, y }, type: "ruleGraph" });
}

function edge(source, target) {
  return { id: `e_${normalizeId(source)}_${normalizeId(target)}`, source, target };
}
