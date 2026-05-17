#!/usr/bin/env node
const path = require("node:path");
const {
  CALC_METHODS,
  CONDITION_OPERATORS,
  CONFIG_HEADERS,
  CONFIG_SHEETS,
  IGNORED_EXTRA_SHEETS,
  MATCH_MODES,
  REQUIRED_HEADERS,
  REQUIRED_SHEETS,
} = require("./lib/config-schema.cjs");
const { cleanRows, readWorkbook, sheetToRows } = require("./lib/excel.cjs");

const file = process.argv[2];
const verbose = process.argv.includes("--verbose") || process.argv.includes("-v");

if (!file) {
  console.error("用法: node scripts/inspect_excel.cjs <配置.xlsx> [--verbose]");
  process.exit(1);
}

const fullPath = path.resolve(file);
const issues = [];

function main() {
  const wb = readWorkbook(fullPath);
  const rows = loadConfigRows(wb);
  const indexes = buildIndexes(rows, wb);

  checkSheets(wb);
  checkHeaders(wb);
  checkRequiredValues(rows);
  checkDuplicates(rows);
  checkReferences(rows, indexes);
  checkRules(rows, indexes, wb);

  printSummary(wb, rows, indexes);
  printIssues();

  if (issues.some(item => item.level === "ERROR"))
    process.exit(2);
}

function loadConfigRows(wb) {
  const out = {};
  for (const name of CONFIG_SHEETS) out[name] = cleanRows(sheetToRows(wb, name), name);
  return out;
}

function buildIndexes(rows, wb) {
  const platforms = new Set(rows.国家平台.map(row => norm(row.编号)).filter(Boolean));
  const templates = new Map(rows.计算模板.map(row => [norm(row.编号), row]).filter(([id]) => id));
  const optionGroups = new Map(
    rows.选项组.map(row => [norm(row.编号), row]).filter(([id]) => id),
  );

  const optionValuesByGroup = new Map();
  for (const row of rows.选项值) {
    const groupId = norm(row.所属分组);
    const value = norm(row.选项值);
    if (!groupId || !value)
      continue;
    if (!optionValuesByGroup.has(groupId))
      optionValuesByGroup.set(groupId, new Set());
    optionValuesByGroup.get(groupId).add(value);
  }

  const fieldsByPlatform = new Map();
  const fieldKeys = new Set();
  for (const row of rows.计算字段) {
    const platformId = norm(row.所属国家平台);
    const fieldKey = norm(row.字段键);
    if (!fieldKey)
      continue;
    fieldKeys.add(fieldKey);
    if (platformId) {
      if (!fieldsByPlatform.has(platformId))
        fieldsByPlatform.set(platformId, new Set());
      fieldsByPlatform.get(platformId).add(fieldKey);
    }
  }

  const lookupSheets = new Set(
    wb.SheetNames.filter(
      name => !CONFIG_SHEETS.includes(name) && !IGNORED_EXTRA_SHEETS.has(name),
    ),
  );

  return {
    fieldKeys,
    fieldsByPlatform,
    lookupSheets,
    optionGroups,
    optionValuesByGroup,
    platforms,
    templates,
  };
}

function checkSheets(wb) {
  for (const sheet of REQUIRED_SHEETS) {
    if (!wb.SheetNames.includes(sheet))
      add("ERROR", sheet, 0, `缺少必要 sheet：${sheet}`);
  }
}

function checkHeaders(wb) {
  for (const sheetName of CONFIG_SHEETS) {
    if (!wb.SheetNames.includes(sheetName))
      continue;

    const headers = readHeaderRow(wb, sheetName);
    const required = REQUIRED_HEADERS[sheetName] || [];
    const recommended = CONFIG_HEADERS[sheetName] || [];

    for (const header of required) {
      if (!headers.has(header))
        add("ERROR", sheetName, 1, `缺少核心表头：${header}`);
    }

    for (const header of recommended) {
      if (!headers.has(header))
        add("WARN", sheetName, 1, `缺少推荐表头：${header}`);
    }
  }
}

function checkRequiredValues(rows) {
  const required = {
    国家平台: ["编号", "国家", "平台"],
    计算字段: ["字段键", "字段名称", "类型", "所属国家平台", "层级", "输入输出"],
    计算模板: ["编号", "名称", "所属国家平台"],
    费用规则: ["编号", "所属模板", "输出字段键", "计算方式"],
    选项值: ["所属分组", "选项值"],
    选项组: ["编号", "名称", "所属国家平台"],
  };

  for (const [sheetName, fields] of Object.entries(required)) {
    rows[sheetName].forEach((row, index) => {
      for (const field of fields) {
        if (!norm(row[field]))
          add("ERROR", sheetName, index + 2, `核心字段为空：${field}`);
      }
    });
  }
}

function checkDuplicates(rows) {
  checkDuplicate(rows.国家平台, "国家平台", row => norm(row.编号), "编号");
  checkDuplicate(
    rows.计算字段,
    "计算字段",
    row => `${norm(row.所属国家平台)}::${norm(row.字段键)}`,
    "所属国家平台 + 字段键",
  );
  checkDuplicate(rows.选项组, "选项组", row => norm(row.编号), "编号");
  checkDuplicate(
    rows.选项值,
    "选项值",
    row => `${norm(row.所属分组)}::${norm(row.选项值)}`,
    "所属分组 + 选项值",
  );
  checkDuplicate(rows.计算模板, "计算模板", row => norm(row.编号), "编号");
  checkDuplicate(
    rows.模板参数,
    "模板参数",
    row => `${norm(row.模板编号)}::${norm(row.字段键)}`,
    "模板编号 + 字段键",
  );
  checkDuplicate(rows.费用规则, "费用规则", row => norm(row.编号), "编号");
}

function checkReferences(rows, indexes) {
  rows.计算字段.forEach((row, index) => {
    const platformId = norm(row.所属国家平台);
    const optionGroupId = norm(row.选项组编号);
    if (platformId && !indexes.platforms.has(platformId))
      add("ERROR", "计算字段", index + 2, `所属国家平台不存在：${platformId}`);
    if (optionGroupId && !indexes.optionGroups.has(optionGroupId))
      add("ERROR", "计算字段", index + 2, `选项组编号不存在：${optionGroupId}`);
  });

  rows.选项组.forEach((row, index) => {
    const platformId = norm(row.所属国家平台);
    const parentId = norm(row.父级编号);
    const parentValue = norm(row.父级选项值);

    if (platformId && !indexes.platforms.has(platformId))
      add("ERROR", "选项组", index + 2, `所属国家平台不存在：${platformId}`);
    if (parentId && !indexes.optionGroups.has(parentId))
      add("ERROR", "选项组", index + 2, `父级编号不存在：${parentId}`);
    if (parentId && parentValue && !indexes.optionValuesByGroup.get(parentId)?.has(parentValue))
      add("WARN", "选项组", index + 2, `父级选项值不存在：${parentId} / ${parentValue}`);
  });

  rows.选项值.forEach((row, index) => {
    const groupId = norm(row.所属分组);
    if (groupId && !indexes.optionGroups.has(groupId))
      add("ERROR", "选项值", index + 2, `所属分组不存在：${groupId}`);
  });

  rows.计算模板.forEach((row, index) => {
    const platformId = norm(row.所属国家平台);
    if (platformId && !indexes.platforms.has(platformId))
      add("ERROR", "计算模板", index + 2, `所属国家平台不存在：${platformId}`);
  });

  rows.模板参数.forEach((row, index) => {
    const templateId = norm(row.模板编号);
    const fieldKey = norm(row.字段键);
    const template = indexes.templates.get(templateId);

    if (templateId && !template)
      add("ERROR", "模板参数", index + 2, `模板编号不存在：${templateId}`);
    if (fieldKey && !fieldExists(indexes, fieldKey, template?.所属国家平台))
      add("WARN", "模板参数", index + 2, `字段键不存在或不属于该模板国家平台：${fieldKey}`);
  });
}

function checkRules(rows, indexes, wb) {
  rows.费用规则.forEach((rule, index) => {
    const rowNumber = index + 2;
    const ruleId = norm(rule.编号) || `第 ${rowNumber} 行`;
    const templateId = norm(rule.所属模板);
    const template = indexes.templates.get(templateId);
    const platformId = norm(template?.所属国家平台);
    const method = norm(rule.计算方式);

    if (templateId && !template)
      add("ERROR", "费用规则", rowNumber, `[${ruleId}] 所属模板不存在：${templateId}`);

    if (method && !CALC_METHODS.includes(method))
      add("ERROR", "费用规则", rowNumber, `[${ruleId}] 不支持的计算方式：${method}`);

    if (!fieldExists(indexes, norm(rule.输出字段键), platformId)) {
      add(
        "WARN",
        "费用规则",
        rowNumber,
        `[${ruleId}] 输出字段键不存在或不属于该模板国家平台：${norm(rule.输出字段键)}`,
      );
    }

    checkRuleConditions(rule, rowNumber, ruleId, platformId, indexes);

    if (method === "查表")
      checkLookupRule(rule, rowNumber, ruleId, wb, indexes, platformId);
    else if (method === "百分比")
      checkPercentRule(rule, rowNumber, ruleId, indexes, platformId);
    else if (method === "加总")
      checkSumRule(rule, rowNumber, ruleId, indexes, platformId);
    else if (method === "公式" || method === "表达式")
      checkFormulaRule(rule, rowNumber, ruleId, indexes, platformId);
  });
}

function checkRuleConditions(rule, rowNumber, ruleId, platformId, indexes) {
  for (let i = 1; i <= 4; i += 1) {
    const field = norm(rule[`条件${i}字段`]);
    const op = norm(rule[`条件${i}运算符`]);
    if (field && !fieldExists(indexes, field, platformId)) {
      add(
        "WARN",
        "费用规则",
        rowNumber,
        `[${ruleId}] 条件${i}字段不存在或不属于该模板国家平台：${field}`,
      );
    }
    if (op && !CONDITION_OPERATORS.includes(op))
      add("ERROR", "费用规则", rowNumber, `[${ruleId}] 条件${i}运算符不支持：${op}`);
  }

  const conditionData = norm(rule.条件数据);
  if (!conditionData)
    return;

  let parsed;
  try {
    parsed = JSON.parse(conditionData);
  }
  catch (error) {
    add("ERROR", "费用规则", rowNumber, `[${ruleId}] 条件数据不是合法 JSON：${error.message}`);
    return;
  }

  if (!Array.isArray(parsed.pool) || !parsed.tree) {
    add("WARN", "费用规则", rowNumber, `[${ruleId}] 条件数据缺少 pool 或 tree`);
    return;
  }

  parsed.pool.forEach((cond, idx) => {
    const field = norm(cond?.字段);
    const op = norm(cond?.运算符);
    if (field && !fieldExists(indexes, field, platformId)) {
      add(
        "WARN",
        "费用规则",
        rowNumber,
        `[${ruleId}] 条件数据 pool[${idx}] 字段不存在或不属于该模板国家平台：${field}`,
      );
    }
    if (op && !CONDITION_OPERATORS.includes(op))
      add("ERROR", "费用规则", rowNumber, `[${ruleId}] 条件数据 pool[${idx}] 运算符不支持：${op}`);
  });
}

function checkLookupRule(rule, rowNumber, ruleId, wb, indexes, platformId) {
  const lookupName = norm(rule.查表名称);
  const matchMode = norm(rule.匹配方式);
  if (!lookupName) {
    add("ERROR", "费用规则", rowNumber, `[${ruleId}] 查表规则缺少查表名称`);
    return;
  }
  if (!indexes.lookupSheets.has(lookupName)) {
    add("ERROR", "费用规则", rowNumber, `[${ruleId}] 查表名称不存在：${lookupName}`);
    return;
  }
  if (!MATCH_MODES.includes(matchMode))
    add("WARN", "费用规则", rowNumber, `[${ruleId}] 匹配方式建议使用：精确 / 区间`);

  const tableHeaders = readHeaderRow(wb, lookupName);
  const outputCol = norm(rule.输出列);
  if (outputCol && !tableHeaders.has(outputCol)) {
    add(
      "ERROR",
      "费用规则",
      rowNumber,
      `[${ruleId}] 输出列不在查表 sheet 中：${lookupName}.${outputCol}`,
    );
  }

  for (const { sourceField, tableField } of parseInputMapping(rule.输入映射)) {
    if (tableField && !tableHeaders.has(tableField)) {
      add(
        "ERROR",
        "费用规则",
        rowNumber,
        `[${ruleId}] 输入映射左侧列不在查表 sheet 中：${lookupName}.${tableField}`,
      );
    }
    if (sourceField && !fieldExists(indexes, sourceField, platformId)) {
      add(
        "WARN",
        "费用规则",
        rowNumber,
        `[${ruleId}] 输入映射右侧字段不存在或不属于该模板国家平台：${sourceField}`,
      );
    }
  }
}

function checkPercentRule(rule, rowNumber, ruleId, indexes, platformId) {
  for (const field of [norm(rule.百分比基数), norm(rule.百分比来源字段)].filter(Boolean)) {
    if (!fieldExists(indexes, field, platformId)) {
      add(
        "WARN",
        "费用规则",
        rowNumber,
        `[${ruleId}] 百分比字段不存在或不属于该模板国家平台：${field}`,
      );
    }
  }
  if (!norm(rule.百分比值) && !norm(rule.百分比来源字段))
    add("WARN", "费用规则", rowNumber, `[${ruleId}] 百分比规则建议填写 百分比值 或 百分比来源字段`);
}

function checkSumRule(rule, rowNumber, ruleId, indexes, platformId) {
  for (const field of splitList(rule.加总字段)) {
    if (!fieldExists(indexes, field, platformId)) {
      add(
        "WARN",
        "费用规则",
        rowNumber,
        `[${ruleId}] 加总字段不存在或不属于该模板国家平台：${field}`,
      );
    }
  }
}

function checkFormulaRule(rule, rowNumber, ruleId, indexes, platformId) {
  const formula = norm(rule.公式);
  if (!formula) {
    add("WARN", "费用规则", rowNumber, `[${ruleId}] 公式规则缺少公式`);
    return;
  }
  for (const field of parseFormulaFields(formula)) {
    if (!fieldExists(indexes, field, platformId)) {
      add(
        "WARN",
        "费用规则",
        rowNumber,
        `[${ruleId}] 公式字段不存在或不属于该模板国家平台：${field}`,
      );
    }
  }
}

function printSummary(wb, rows, indexes) {
  console.log(`文件: ${fullPath}`);
  console.log("\nSheets:");
  for (const name of wb.SheetNames) {
    const count = CONFIG_SHEETS.includes(name)
      ? (rows[name]?.length ?? 0)
      : sheetToRows(wb, name).length;
    const tag = indexes.lookupSheets.has(name)
      ? "查表"
      : CONFIG_SHEETS.includes(name)
        ? "配置"
        : "辅助";
    console.log(`  - ${name}: ${count} 行 / ${tag}`);
  }

  console.log("\n配置概览:");
  console.log(`  - 国家平台: ${rows.国家平台.length}`);
  console.log(`  - 计算字段: ${rows.计算字段.length}`);
  console.log(`  - 选项组: ${rows.选项组.length}`);
  console.log(`  - 选项值: ${rows.选项值.length}`);
  console.log(`  - 计算模板: ${rows.计算模板.length}`);
  console.log(`  - 费用规则: ${rows.费用规则.length}`);
  console.log(`  - 查表 sheet: ${indexes.lookupSheets.size}`);

  console.log("\n模板:");
  for (const tpl of rows.计算模板) console.log(`  - ${tpl.编号} ${tpl.名称} (${tpl.所属国家平台})`);

  console.log("\n规则:");
  for (const rule of rows.费用规则) {
    console.log(
      `  - ${rule.所属模板} / ${rule.计算顺序} / ${rule.编号} / ${rule.计算方式} -> ${rule.输出字段键}`,
    );
  }

  if (verbose) {
    console.log("\n查表:");
    for (const name of indexes.lookupSheets)
      console.log(`  - ${name}: ${Array.from(readHeaderRow(wb, name)).join(", ")}`);
  }
}

function printIssues() {
  const errors = issues.filter(item => item.level === "ERROR");
  const warnings = issues.filter(item => item.level === "WARN");

  console.log("\n检查结果:");
  if (!issues.length) {
    console.log("  ✓ 未发现问题");
    return;
  }

  if (errors.length) {
    console.log(`  错误: ${errors.length}`);
    for (const item of errors)
      console.log(`    ✗ [${item.sheet}${item.row ? ` 第${item.row}行` : ""}] ${item.message}`);
  }

  if (warnings.length) {
    console.log(`  警告: ${warnings.length}`);
    for (const item of warnings)
      console.log(`    ! [${item.sheet}${item.row ? ` 第${item.row}行` : ""}] ${item.message}`);
  }
}

function checkDuplicate(rows, sheetName, getter, label) {
  const seen = new Map();
  rows.forEach((row, index) => {
    const key = getter(row);
    if (!key || key === "::")
      return;
    if (seen.has(key)) {
      add("ERROR", sheetName, index + 2, `${label} 重复：${key}，首次出现在第 ${seen.get(key)} 行`);
    }
    else {
      seen.set(key, index + 2);
    }
  });
}

function readHeaderRow(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws)
    return new Set();
  const rows = sheetToRows(wb, sheetName);
  return new Set(Object.keys(rows[0] || {}));
}

function fieldExists(indexes, fieldKey, platformId = "") {
  const key = norm(fieldKey);
  if (!key)
    return true;
  const platform = norm(platformId);
  if (platform && indexes.fieldsByPlatform.get(platform)?.has(key))
    return true;
  return indexes.fieldKeys.has(key);
}

function parseInputMapping(value) {
  return splitList(value).map((item) => {
    const [left, right] = item.split("=");
    return {
      sourceField: norm(right || left),
      tableField: norm(left),
    };
  });
}

function parseFormulaFields(formula) {
  const fields = new Set();
  String(formula || "").replace(/\{([^}]+)\}/g, (_, field) => {
    fields.add(norm(field));
    return "";
  });
  return Array.from(fields).filter(Boolean);
}

function splitList(value) {
  return String(value ?? "")
    .split(/[|,，;；、\n]/)
    .map(item => norm(item))
    .filter(Boolean);
}

function norm(value) {
  const text = String(value ?? "").trim();
  return text === "42" ? "" : text;
}

function add(level, sheet, row, message) {
  issues.push({ level, message, row, sheet });
}

main();
