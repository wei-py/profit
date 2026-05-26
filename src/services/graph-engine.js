import { normalizeFlow, normalizeGraph } from "@/domain/rule-graph";
import { normalizeId, toNumber } from "@/utils/value";

export function executeFlow(flowValue, lookupTables = {}, userInputs = {}) {
  const flow = normalizeFlow(flowValue);
  const errors = [];
  const traces = {};
  const results = {};
  const accumulated = { ...userInputs };

  for (const rule of flow.rules) {
    if (!rule.enabled)
      continue;

    try {
      const ruleResults = executeGraph(rule.graph, accumulated, lookupTables, traces);
      Object.assign(results, ruleResults.results);
      Object.assign(accumulated, ruleResults.results);
      if (ruleResults.errors.length)
        errors.push(...ruleResults.errors);
    }
    catch (error) {
      errors.push(`[${rule.name || rule.id}] ${error.message}`);
    }
  }

  return { errors, results, traces };
}

function executeGraph(graphValue, inputs, lookupTables, traces) {
  const graph = normalizeGraph(graphValue);
  const errors = [];
  const results = {};
  const values = new Map();
  const nodeById = new Map(graph.nodes.map(node => [node.id, node]));

  try {
    const sorted = topologicalSort(graph);
    for (const node of sorted) {
      const incoming = graph.edges.filter(edge => edge.target === node.id).map(edge => values.get(edge.source));
      const value = executeNode(node, incoming, values, lookupTables, inputs, traces, nodeById);
      values.set(node.id, value);
      if (node.data.kind === "output") {
        const field = normalizeId(node.data.field || node.data.label);
        if (field)
          results[field] = value;
      }
    }

    const sortedIds = sorted.map(n => n.id);
    for (const node of graph.nodes) {
      if (node.data.kind !== "output")
        continue;
      const field = normalizeId(node.data.field || node.data.label);
      if (!field)
        continue;
      const upstream = new Set();
      collectUpstream(graph, node.id, upstream);
      const orderedLines = sortedIds.filter(id => upstream.has(id) && traces[id]).map(id => traces[id]);
      if (orderedLines.length)
        traces[field] = orderedLines.join("\n");
    }
  }
  catch (error) {
    errors.push(error.message);
  }

  for (const edge of graph.edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target))
      errors.push(`连线 ${edge.id} 引用了不存在的节点`);
  }

  return { errors, results };
}

function executeNode(node, incoming, values, lookupTables, userInputs, traces, nodeById) {
  const data = node.data || {};
  const label = data.label || node.id;
  let value;
  switch (data.kind) {
    case "input":
      value = readInputValue(data, userInputs);
      traces[node.id] = `[${label}] 输入：${data.field || data.label} = ${value ?? ""}`;
      break;
    case "constant":
      value = data.value ?? "";
      traces[node.id] = `[${label}] 常量：${value}`;
      break;
    case "lookup":
      value = executeLookup(node, values, lookupTables, userInputs, traces);
      break;
    case "map": {
      const raw = incoming[0];
      value = executeMap(data, raw);
      const fromText = String(raw ?? "");
      const toText = String(value ?? "");
      traces[node.id] = `[${label}] 映射：${fromText} → ${toText}`;
      break;
    }
    case "pick": {
      value = executePick(data, incoming, values);
      const col = String((data.columnSource ? values.get(data.columnSource) : data.column) ?? "").trim();
      traces[node.id] = `[${label}] 取字段：${col} = ${value ?? ""}`;
      break;
    }
    case "calc":
      value = executeCalc(data, incoming, values, userInputs, traces, node, nodeById, label);
      break;
    case "condition": {
      value = executeCondition(data, incoming, values);
      const condVal = String(data.conditionSource ? values.get(data.conditionSource) : incoming[0] ?? "");
      const branch = compare(condVal, data.compareValue ?? "", data.compareOperator || "=") ? "成立" : "不成立";
      traces[node.id] = `[${label}] 条件：${condVal} ${data.compareOperator || "="} ${data.compareValue ?? ""} → ${branch}，返回 ${value ?? ""}`;
      break;
    }
    case "output":
      value = incoming.length ? incoming[incoming.length - 1] : data.value;
      traces[node.id] = `[${label}] 输出：${data.field || label} = ${value ?? ""}`;
      break;
    default:
      value = incoming.length ? incoming[incoming.length - 1] : undefined;
      break;
  }
  return value;
}

function readInputValue(data, userInputs) {
  const field = normalizeId(data.field || data.label);
  const value = userInputs[field];
  if (data.valueMode === "cascadePath" || data.valueMode === "lastLevel") {
    if (Array.isArray(value))
      return data.valueMode === "lastLevel" ? value[value.length - 1] : value.join(" / ");
    const parts = String(value ?? "").split(/\s*\/\s*/).filter(Boolean);
    return data.valueMode === "lastLevel" ? parts[parts.length - 1] || "" : parts.join(" / ");
  }
  return value;
}

function executeLookup(node, values, lookupTables, userInputs, traces) {
  const data = node.data || {};
  const table = lookupTables[data.sheet] || [];
  const conditions = (Array.isArray(data.where) ? data.where : []).filter(c => c.column && (c.source || c.input));
  const condDetail = conditions.map((c) => {
    const v = c.source ? values.get(c.source) : userInputs[normalizeId(c.input)];
    return `${c.column}=${v ?? ""}`;
  }).join(", ");
  const matched = table.find(row => conditions.every((condition) => {
    const sourceValue = condition.source ? values.get(condition.source) : userInputs[normalizeId(condition.input)];
    return compare(sourceValue, row?.[condition.column], condition.operator || "=");
  }));
  const label = data.label || node.id;
  if (matched) {
    traces[node.id] = `[${label}] 查表：${data.sheet}\n  条件：${condDetail}\n  结果：命中`;
  }
  else {
    traces[node.id] = `[${label}] 查表：${data.sheet}\n  条件：${condDetail}\n  结果：未命中`;
  }
  return matched || null;
}

function executeMap(data, inputValue) {
  const rows = Array.isArray(data.map) ? data.map : [];
  const key = String(inputValue ?? "").trim();
  const matched = rows.find(row => String(row.from ?? "").trim() === key);
  return matched ? matched.to : inputValue;
}

function executePick(data, incoming, values) {
  const row = data.rowSource ? values.get(data.rowSource) : incoming.find(value => value && typeof value === "object" && !Array.isArray(value));
  const rawColumn = data.columnSource ? values.get(data.columnSource) : data.column;
  const column = String(rawColumn ?? "").trim();
  if (!row || !column)
    return undefined;
  if (row[column] !== undefined)
    return row[column];
  const key = Object.keys(row).find(k => String(k).trim() === column);
  return key ? row[key] : undefined;
}

function executeCalc(data, incoming, values, userInputs, traces, node, nodeById, label) {
  const formula = data.formula || [];
  if (formula.length) {
    const parts = formula.map((t) => {
      if (t.type === "field")
        return String(toNumber(userInputs[t.value] ?? 0));
      if (t.type === "node")
        return String(toNumber(values.get(String(t.value)) ?? 0));
      if (t.type === "constant")
        return String(toNumber(t.value));
      return String(t.value);
    });
    const expr = parts.join(" ");
    if (!/^[\d+\-*/().\s]+$/.test(expr))
      throw new Error(`计算公式无法安全执行：${expr}`);
    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${expr})`)();
    const desc = formula.map((t) => {
      if (t.type === "field")
        return `${t.value}=${userInputs[t.value] ?? 0}`;
      if (t.type === "node") {
        const srcNode = nodeById.get(String(t.value));
        return `${srcNode?.data?.label || t.value}=${values.get(String(t.value)) ?? 0}`;
      }
      if (t.type === "constant")
        return t.value;
      return t.value;
    }).join(" ");
    traces[node.id] = `[${label}] 计算：${desc}\n  公式：${expr}\n  结果：${result}`;
    return result;
  }

  const expression = String(data.expression || "").trim();
  if (!expression)
    return incoming[incoming.length - 1];
  const context = { ...userInputs };
  for (const [id, value] of values.entries()) context[id] = value;
  for (const [index, value] of incoming.entries()) context[`in${index + 1}`] = value;
  const compiled = expression.replace(/\{([^}]+)\}/g, (_, key) => String(toNumber(context[key.trim()] ?? 0)));
  if (!/^[\d+\-*/().\s]+$/.test(compiled))
    throw new Error(`计算表达式不安全或无法识别：${expression}`);
  // eslint-disable-next-line no-new-func
  const result = new Function(`"use strict"; return (${compiled})`)();
  traces[node.id] = `[${label}] 计算：${expression}\n  代入：${compiled}\n  结果：${result}`;
  return result;
}

function executeCondition(data, incoming, values) {
  const conditionValue = data.conditionSource ? values.get(data.conditionSource) : incoming[0];
  const compareValue = data.compareValue ?? "";
  const operator = data.compareOperator || "=";
  const matched = compare(conditionValue, compareValue, operator);
  const trueValue = data.trueSource ? values.get(data.trueSource) : incoming[1];
  const falseValue = data.falseSource ? values.get(data.falseSource) : incoming[2];
  return matched ? trueValue : falseValue;
}

function compare(left, right, operator) {
  if (operator === "!=")
    return String(left ?? "") !== String(right ?? "");
  if (operator === ">")
    return toNumber(left) > toNumber(right);
  if (operator === ">=")
    return toNumber(left) >= toNumber(right);
  if (operator === "<")
    return toNumber(left) < toNumber(right);
  if (operator === "<=")
    return toNumber(left) <= toNumber(right);
  return String(left ?? "") === String(right ?? "");
}

function collectUpstream(graph, nodeId, visited) {
  if (visited.has(nodeId))
    return;
  visited.add(nodeId);
  for (const edge of graph.edges) {
    if (edge.target === nodeId)
      collectUpstream(graph, edge.source, visited);
  }
}

function topologicalSort(graph) {
  const nodes = graph.nodes || [];
  const inDegree = new Map(nodes.map(node => [node.id, 0]));
  const outgoing = new Map(nodes.map(node => [node.id, []]));
  for (const edge of graph.edges || []) {
    if (!inDegree.has(edge.source) || !inDegree.has(edge.target))
      continue;
    inDegree.set(edge.target, inDegree.get(edge.target) + 1);
    outgoing.get(edge.source).push(edge.target);
  }
  const queue = nodes.filter(node => inDegree.get(node.id) === 0);
  const sorted = [];
  for (let index = 0; index < queue.length; index++) {
    const node = queue[index];
    sorted.push(node);
    for (const target of outgoing.get(node.id) || []) {
      inDegree.set(target, inDegree.get(target) - 1);
      if (inDegree.get(target) === 0)
        queue.push(nodes.find(item => item.id === target));
    }
  }
  if (sorted.length !== nodes.length)
    throw new Error("计算流程存在循环依赖");
  return sorted;
}
