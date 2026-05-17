import { writeJson } from "@/utils/value";

export function createEmptyRule(templateId = "") {
  return {
    公式: "",
    加总字段: "",
    匹配方式: "",
    启用: "是",
    固定金额: "",
    所属模板: templateId,
    条件结构: "",
    条件数据: "",
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
  };
}

export function createEmptyCondition() {
  return {
    值: "",
    值2: "",
    字段: "",
    运算符: "等于",
  };
}

export function createInitialConditionTree() {
  return {
    children: [{ idx: 0, op: "", type: "cond" }],
    linkOp: "",
    op: "AND",
    type: "group",
  };
}

export function serializeConditionState({ form, pool, tree }) {
  const result = { ...form };
  result.条件结构 = serializeTree(tree);
  const activeIndexes = collectConditionIndexes(tree);
  for (let i = 1; i <= 4; i += 1) {
    const cond = pool[activeIndexes[i - 1]];
    result[`条件${i}字段`] = cond?.字段 || "";
    result[`条件${i}运算符`] = cond?.运算符 || "";
    result[`条件${i}值`] = cond?.值 || "";
    result[`条件${i}值2`] = cond?.值2 || "";
  }
  result.条件数据 = writeJson({ pool, tree });
  return result;
}

export function collectConditionIndexes(node = {}, out = []) {
  if (node.type === "cond") {
    const idx = Number(node.idx);
    if (Number.isInteger(idx) && idx >= 0)
      out.push(idx);
    return out;
  }
  for (const child of node.children || [])
    collectConditionIndexes(child, out);
  return out;
}

export function serializeTree(node) {
  if (!node)
    return "";
  if (node.type === "cond")
    return `C${node.idx}`;
  const parts = [];
  for (const child of node.children || []) {
    const op = child.type === "group" ? child.linkOp : child.op;
    parts.push(`${op ? op[0] : ""}${serializeTree(child)}`);
  }
  return `G${(node.op || "AND")[0]}[${parts.join(",")}]`;
}
