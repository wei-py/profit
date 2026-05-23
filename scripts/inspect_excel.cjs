#!/usr/bin/env node
const path = require("node:path");
const process = require("node:process");
const XLSX = require("xlsx");
const {
  CONFIG_HEADERS,
  CONFIG_SHEETS,
  IGNORED_EXTRA_SHEETS,
  REQUIRED_HEADERS,
  REQUIRED_SHEETS,
} = require("./lib/config-schema.cjs");
const { cleanRows, readWorkbook, sheetToRows } = require("./lib/excel.cjs");

const file = process.argv[2];
const verbose = process.argv.includes("--verbose") || process.argv.includes("-v");
const issues = [];

if (!file) {
  console.error("用法: node scripts/inspect_excel.cjs <配置.xlsx> [--verbose]");
  process.exit(1);
}

main();

function main() {
  const wb = readWorkbook(path.resolve(file));
  const rows = loadConfigRows(wb);
  const indexes = buildIndexes(rows, wb);

  checkSheets(wb);
  checkHeaders(wb);
  checkRequiredValues(rows);
  checkDuplicates(rows);
  checkReferences(rows, indexes);
  checkGraphs(rows, indexes, wb);
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
  const templates = new Map();
  const fieldsByPlatform = new Map();
  const fieldKeys = new Set();
  const optionRootIds = new Set();
  const lookupSheets = new Set(
    wb.SheetNames.filter(name => !CONFIG_SHEETS.includes(name) && !IGNORED_EXTRA_SHEETS.has(name)),
  );

  for (const row of rows.计算配置) {
    const id = norm(row.模板编号);
    if (id && !templates.has(id))
      templates.set(id, row);
  }

  for (const row of rows.计算字段) {
    const platformId = norm(row.所属国家平台);
    const fieldKey = norm(row.字段键 || row.字段名称);
    if (!fieldKey)
      continue;
    fieldKeys.add(fieldKey);
    if (!fieldsByPlatform.has(platformId))
      fieldsByPlatform.set(platformId, new Set());
    fieldsByPlatform.get(platformId).add(fieldKey);
  }

  for (const row of rows.选项配置) {
    if (!norm(row.父级选项值编号))
      optionRootIds.add(norm(row.选项值编号));
  }

  return { fieldKeys, fieldsByPlatform, lookupSheets, optionRootIds, platforms, templates };
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
    for (const header of REQUIRED_HEADERS[sheetName] || []) {
      if (!headers.has(header))
        add("ERROR", sheetName, 1, `缺少核心表头：${header}`);
    }
    for (const header of CONFIG_HEADERS[sheetName] || []) {
      if (!headers.has(header))
        add("WARN", sheetName, 1, `缺少推荐表头：${header}`);
    }
  }
}

function checkRequiredValues(rows) {
  const required = {
    国家平台: ["编号", "国家", "平台"],
    计算字段: ["字段名称", "类型", "所属国家平台", "层级", "输入输出"],
    计算配置: ["所属国家平台", "模板编号", "模板名称", "流程JSON"],
    选项配置: ["所属国家平台", "选项值", "选项值编号"],
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
  checkDuplicate(rows.计算字段, "计算字段", row => `${norm(row.所属国家平台)}::${norm(row.字段键 || row.字段名称)}`, "所属国家平台 + 字段键");
  checkDuplicate(rows.选项配置, "选项配置", row => norm(row.选项值编号), "选项值编号", "WARN");
  checkDuplicate(rows.计算配置, "计算配置", row => `${norm(row.所属国家平台)}::${norm(row.模板编号)}`, "所属国家平台 + 模板编号");
}

function checkReferences(rows, indexes) {
  rows.计算字段.forEach((row, index) => {
    const platformId = norm(row.所属国家平台);
    const optionGroup = norm(row.选项组);
    if (platformId && !indexes.platforms.has(platformId))
      add("ERROR", "计算字段", index + 2, `所属国家平台不存在：${platformId}`);
    if (optionGroup && !indexes.optionRootIds.has(optionGroup))
      add("WARN", "计算字段", index + 2, `选项组未在选项配置根节点中找到：${optionGroup}`);
  });

  rows.计算配置.forEach((row, index) => {
    const platformId = norm(row.所属国家平台);
    const templateId = norm(row.模板编号);
    if (platformId && !indexes.platforms.has(platformId))
      add("ERROR", "计算配置", index + 2, `[${templateId}] 所属国家平台不存在：${platformId}`);
  });
}

function checkGraphs(rows, indexes, wb) {
  rows.计算配置.forEach((template, index) => {
    const rowNumber = index + 2;
    const templateId = norm(template.模板编号) || `第 ${rowNumber} 行`;
    const platformId = norm(template.所属国家平台);
    const graph = parseGraph(template.流程JSON, rowNumber, templateId);
    if (!graph)
      return;
    if (!Array.isArray(graph.nodes))
      add("ERROR", "计算配置", rowNumber, `[${templateId}] 流程JSON.nodes 必须是数组`);
    if (!Array.isArray(graph.edges))
      add("ERROR", "计算配置", rowNumber, `[${templateId}] 流程JSON.edges 必须是数组`);
    for (const node of graph.nodes || []) {
      if (node?.data?.kind === "output" && !fieldExists(indexes, node.data.field, platformId))
        add("WARN", "计算配置", rowNumber, `[${templateId}] 输出字段不存在或不属于该国家平台：${node.data.field}`);
      if (node?.data?.kind === "lookup")
        checkLookupNode(node, rowNumber, templateId, wb, indexes);
    }
  });
}

function checkLookupNode(node, rowNumber, templateId, wb, indexes) {
  const lookupName = norm(node.data?.sheet);
  if (!lookupName) {
    add("ERROR", "计算配置", rowNumber, `[${templateId}] 查表节点缺少表名`);
    return;
  }
  if (!indexes.lookupSheets.has(lookupName)) {
    add("ERROR", "计算配置", rowNumber, `[${templateId}] 查表 sheet 不存在：${lookupName}`);
    return;
  }

  const headers = readHeaderRow(wb, lookupName);
  for (const where of node.data?.where || []) {
    const column = norm(where?.column);
    if (column && !headers.has(column))
      add("ERROR", "计算配置", rowNumber, `[${templateId}] 匹配列不存在：${lookupName}.${column}`);
  }
}

function parseGraph(value, rowNumber, templateId) {
  try {
    return value ? JSON.parse(value) : { edges: [], nodes: [] };
  }
  catch (error) {
    add("ERROR", "计算配置", rowNumber, `[${templateId}] 流程JSON 不是合法 JSON：${error.message}`);
    return null;
  }
}

function fieldExists(indexes, fieldKey, platformId) {
  const field = norm(fieldKey);
  if (!field)
    return false;
  if (platformId)
    return indexes.fieldsByPlatform.get(norm(platformId))?.has(field) || false;
  return indexes.fieldKeys.has(field);
}

function checkDuplicate(rows, sheetName, getKey, label, level = "ERROR") {
  const seen = new Map();
  rows.forEach((row, index) => {
    const key = getKey(row);
    if (!key)
      return;
    if (seen.has(key))
      add(level, sheetName, index + 2, `${label} 重复：${key}，首次出现于第 ${seen.get(key)} 行`);
    else
      seen.set(key, index + 2);
  });
}

function printSummary(wb, rows, indexes) {
  console.log(`文件：${path.basename(file)}`);
  console.log(`Sheet：${wb.SheetNames.join(", ")}`);
  console.log(`国家平台：${rows.国家平台.length}，计算字段：${rows.计算字段.length}，选项配置：${rows.选项配置.length}`);
  console.log(`模板：${indexes.templates.size}，查表：${indexes.lookupSheets.size}`);
  if (verbose) {
    for (const sheet of wb.SheetNames)
      console.log(`  - ${sheet}: ${sheetToRows(wb, sheet).length} 行`);
  }
}

function printIssues() {
  if (!issues.length) {
    console.log("检查通过：未发现问题");
    return;
  }
  for (const item of issues)
    console.log(`[${item.level}] ${item.sheet}${item.row ? `#${item.row}` : ""}: ${item.message}`);
}

function readHeaderRow(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws || !ws["!ref"])
    return new Set();
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const headers = [];
  for (let c = range.s.c; c <= range.e.c; c += 1) {
    const cell = ws[XLSX.utils.encode_cell({ c, r: range.s.r })];
    if (cell?.v)
      headers.push(norm(cell.v));
  }
  return new Set(headers.filter(Boolean));
}

function add(level, sheet, row, message) {
  issues.push({ level, message, row, sheet });
}

function norm(value) {
  return String(value ?? "").trim();
}
