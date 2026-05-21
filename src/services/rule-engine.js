import XEUtils from "xe-utils";
import { parseCascadePath } from "@/utils/optionCascade";
import {
  addNumbers,
  avgNumber,
  clampNumber,
  isBlank,
  maxNumber,
  minNumber,
  multiplyNumbers,
  normalizeText,
  parseDelimited,
  readJson,
  roundNumber,
  toNumber,
  toRate,
} from "@/utils/value";

const ENABLED_VALUES = new Set(["是", "TRUE", "true", "1", "启用", ""]);
const FUNCTION_ALIASES = {
  且: "AND",
  最大值: "MAX",
  最小值: "MIN",
  取整: "ROUND",
  向上取整: "CEIL",
  向下取整: "FLOOR",
  如果: "IF",
  或: "OR",
  绝对值: "ABS",
};

const FORMULA_FUNCTIONS = {
  ABS: value => Math.abs(toNumber(value, 0)),
  AND: (...args) => (args.every(Boolean) ? 1 : 0),
  AVG: (...args) => avgNumber(args),
  CEIL: value => Math.ceil(toNumber(value, 0)),
  CLAMP: (value, min, max) => clampNumber(value, min, max),
  DIV: (a, b) => (toNumber(b, 0) === 0 ? 0 : toNumber(a, 0) / toNumber(b, 0)),
  FLOOR: value => Math.floor(toNumber(value, 0)),
  IF: (cond, yes, no) => (cond ? yes : no),
  MAX: (...args) => maxNumber(args),
  MIN: (...args) => minNumber(args),
  MUL: (...args) => multiplyNumbers(args),
  OR: (...args) => (args.some(Boolean) ? 1 : 0),
  PCT: value => toRate(value, 0),
  ROUND: (value, digits = 2) => roundNumber(value, digits),
  SUM: (...args) => addNumbers(args),
};

export function execute(feeRules, lookupTables, userInputs) {
  const results = {};
  const errors = [];
  const traces = {};
  const context = {
    ...(userInputs || {}),
  };

  const enabled = (feeRules || []).filter(rule =>
    ENABLED_VALUES.has(normalizeText(rule.启用 || "是")),
  );
  const sorted = XEUtils.orderBy(enabled, [rule => toNumber(rule.计算顺序, 0)], ["asc"]);

  for (const rule of sorted) {
    try {
      if (!evalConditions(rule, context))
        continue;

      const key = normalizeText(rule.输出字段键);
      if (!key)
        continue;

      const { trace, val } = calculateRule(rule, lookupTables || {}, context);
      const oldValue = toNumber(context[key], 0);
      const nextValue = rule.累加 === "是" ? oldValue + toNumber(val, 0) : val;
      results[key] = nextValue;
      context[key] = nextValue;
      traces[key] = trace;
    }
    catch (error) {
      errors.push(`[${rule.编号 || rule.费用名称 || "规则"}] ${error.message}`);
    }
  }

  return { errors, results, traces };
}

function calculateRule(rule, lookupTables, context) {
  switch (rule.计算方式) {
    case "查表":
      return doLookup(rule, lookupTables, context);
    case "百分比":
      return doPercent(rule, context);
    case "固定值":
      return doFixed(rule);
    case "加总":
      return doSum(rule, context);
    case "公式":
    case "表达式":
      return doFormula(rule, context);
    default:
      return { trace: "未选择计算方式", val: 0 };
  }
}

export function evalConditions(rule, context) {
  const treeData = readJson(rule.条件数据, null);
  if (treeData?.tree)
    return evalTree(treeData.tree, treeData.pool || [], context);

  const structure = normalizeText(rule.条件结构);
  if (structure && /^\d/.test(structure))
    return evalLegacyStruct(structure, rule, context);

  for (let i = 1; i <= 4; i += 1) {
    const field = normalizeText(rule[`条件${i}字段`]);
    if (!field)
      continue;
    if (
      !matches(
        getVal(field, context),
        rule[`条件${i}运算符`],
        rule[`条件${i}值`],
        rule[`条件${i}值2`],
      )
    ) {
      return false;
    }
  }
  return true;
}

function evalTree(node, pool, context) {
  if (!node || typeof node !== "object")
    return true;

  if (node.type === "cond") {
    const cond = pool?.[Number(node.idx)] || {};
    const field = normalizeText(cond.字段);
    if (!field)
      return true;
    return matches(getVal(field, context), cond.运算符, cond.值, cond.值2);
  }

  const children = Array.isArray(node.children) ? node.children : [];
  if (!children.length)
    return true;

  let result = null;
  for (const child of children) {
    const childResult = evalTree(child, pool, context);
    if (result === null) {
      result = childResult;
      continue;
    }
    const linkOp = child.type === "group" ? child.linkOp : child.op;
    result = linkOp === "OR" ? result || childResult : result && childResult;
  }
  return result ?? true;
}

function evalLegacyStruct(structure, rule, context) {
  const groups = structure.split("|").map(group => group.split(",").map(s => s.trim()));
  for (const group of groups) {
    const ok = group.every((idx) => {
      const i = Number(idx) + 1;
      if (i < 1 || i > 4)
        return true;
      const field = normalizeText(rule[`条件${i}字段`]);
      return (
        !field
        || matches(
          getVal(field, context),
          rule[`条件${i}运算符`],
          rule[`条件${i}值`],
          rule[`条件${i}值2`],
        )
      );
    });
    if (ok)
      return true;
  }
  return false;
}

function getVal(fieldKey, context) {
  return context?.[fieldKey];
}

export function matches(value, op, target, target2 = "") {
  const operator = normalizeText(op || "等于");
  const sVal = normalizeText(value);
  const sTarget = normalizeText(target);
  const nVal = toNumber(value, Number.NaN);
  const nTarget = toNumber(target, Number.NaN);
  const nTarget2 = toNumber(target2, Number.NaN);

  switch (operator) {
    case "等于":
      return textMatches(sVal, sTarget);
    case "不等于":
      return !textMatches(sVal, sTarget);
    case "大于":
      return nVal > nTarget;
    case "大于等于":
      return nVal >= nTarget;
    case "小于":
      return nVal < nTarget;
    case "小于等于":
      return nVal <= nTarget;
    case "包含":
      return sVal.includes(sTarget);
    case "不包含":
      return !sVal.includes(sTarget);
    case "为空":
      return isBlank(value);
    case "不为空":
      return !isBlank(value);
    case "介于":
      return nVal >= minNumber([nTarget, nTarget2]) && nVal <= maxNumber([nTarget, nTarget2]);
    case "不介于":
      return !(nVal >= minNumber([nTarget, nTarget2]) && nVal <= maxNumber([nTarget, nTarget2]));
    case "属于":
      return parseDelimited(target).some(item => textMatches(sVal, item));
    case "不属于":
      return !parseDelimited(target).some(item => textMatches(sVal, item));
    case "开头是":
      return sVal.startsWith(sTarget);
    case "结尾是":
      return sVal.endsWith(sTarget);
    default:
      return false;
  }
}

function textMatches(value, target) {
  if (value === target)
    return true;

  const valuePath = parseCascadePath(value);
  const targetPath = parseCascadePath(target);
  if (!valuePath.length || !targetPath.length || targetPath.length > valuePath.length)
    return false;
  return targetPath.every((part, index) => valuePath[index] === part);
}

function doLookup(rule, lookupTables, context) {
  const tableName = normalizeText(rule.查表名称);
  const table = lookupTables[tableName];
  if (!table?.length)
    throw new Error(`费率表「${tableName}」不存在或为空`);

  const mappings = parseMappings(rule.输入映射);
  const isRange = rule.匹配方式 === "区间";
  const outputCol = normalizeText(rule.输出列);

  for (const row of table) {
    const condParts = [];
    let ok = true;
    for (const [fieldKey, colName] of mappings) {
      const inputVal = getVal(fieldKey, context);
      if (isRange) {
        const v = toNumber(inputVal, Number.NaN);
        const lo = toNumber(row[`${colName}下限`], Number.NEGATIVE_INFINITY);
        const hi = toNumber(row[`${colName}上限`], Number.POSITIVE_INFINITY);
        if (Number.isNaN(v) || v < lo || v > hi) {
          ok = false;
          break;
        }
        condParts.push(`${fieldKey}=${inputVal}(${colName}:${lo}~${hi})`);
      }
      else {
        if (!textMatches(normalizeText(inputVal), normalizeText(row[colName]))) {
          ok = false;
          break;
        }
        condParts.push(`${fieldKey}=${inputVal}`);
      }
    }
    if (ok) {
      const val = toNumber(row[outputCol], 0);
      return {
        trace: `查表「${tableName}」→ ${condParts.join("，")} → ${outputCol}=${val}`,
        val,
      };
    }
  }
  throw new Error(`查表「${tableName}」未找到匹配行`);
}

function doPercent(rule, context) {
  const baseKey = normalizeText(rule.百分比基数);
  const sourceKey = normalizeText(rule.百分比来源字段);
  const base = toNumber(getVal(baseKey, context), 0);
  const rawRate = sourceKey ? getVal(sourceKey, context) : rule.百分比值;
  const rate = toRate(rawRate, 0);
  const val = base * rate;
  return {
    trace: `${baseKey}(${base}) × ${sourceKey ? `${sourceKey}(${rawRate})` : `${rule.百分比值}%`} = ${val.toFixed(2)}`,
    val,
  };
}

function doFixed(rule) {
  const val = toNumber(rule.固定金额, 0);
  return {
    trace: `${rule.费用名称 || rule.输出字段键} = ${val}（固定值）`,
    val,
  };
}

function doSum(rule, context) {
  const fields = parseDelimited(rule.加总字段);
  const parts = [];
  let total = 0;
  for (const field of fields) {
    const value = toNumber(getVal(field, context), 0);
    parts.push(`${field}(${value.toFixed(2)})`);
    total += value;
  }
  return {
    trace: `加总：${parts.join(" + ")} = ${total.toFixed(2)}`,
    val: total,
  };
}

function doFormula(rule, context) {
  const formula = normalizeText(rule.公式);
  if (!formula)
    return { trace: "", val: 0 };

  const { expr, traceParts } = compileFormula(formula, context);
  const functionNames = Object.keys(FORMULA_FUNCTIONS);
  const invalid = collectIdentifiers(expr).filter(name => !functionNames.includes(name));
  if (invalid.length)
    throw new Error(`公式含未知标识：${invalid.join(", ")}`);

  // eslint-disable-next-line no-new-func
  const fn = new Function(...functionNames, `"use strict"; return (${expr});`);
  const val = fn(...functionNames.map(name => FORMULA_FUNCTIONS[name]));
  return {
    trace: `公式「${formula}」：${traceParts.join("，")} → ${toNumber(val, 0).toFixed(4)}`,
    val: toNumber(val, 0),
  };
}

function compileFormula(formula, context) {
  let expr = formula;
  const traceParts = [];

  for (const [cn, en] of Object.entries(FUNCTION_ALIASES)) expr = expr.replaceAll(cn, en);

  expr = expr.replace(/\{([^{}]+)\}/g, (_, fieldKey) => {
    const value = toNumber(getVal(fieldKey.trim(), context), 0);
    traceParts.push(`${fieldKey.trim()}=${value}`);
    return String(value);
  });

  const keys = Object.keys(context || {}).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (!key || !expr.includes(key))
      continue;
    const safePattern = new RegExp(escapeRegExp(key), "g");
    const value = toNumber(getVal(key, context), 0);
    expr = expr.replace(safePattern, String(value));
    if (!traceParts.some(part => part.startsWith(`${key}=`)))
      traceParts.push(`${key}=${value}`);
  }

  if (!/^[\d\s+\-*/%().,?:<>=!&|A-Z_]+$/.test(expr))
    throw new Error(`公式含非法字符：${formula}`);

  return { expr, traceParts };
}

function collectIdentifiers(expr) {
  const result = new Set();
  const re = /\b[A-Z_][A-Z0-9_]*\b/g;
  let match = re.exec(expr);
  while (match) {
    result.add(match[0]);
    match = re.exec(expr);
  }
  return [...result];
}

function parseMappings(inputMap) {
  return parseDelimited(inputMap)
    .map((part) => {
      const [fieldKey, colName] = part.split("=").map(s => s.trim());
      return [fieldKey, colName];
    })
    .filter(([fieldKey, colName]) => fieldKey && colName);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
