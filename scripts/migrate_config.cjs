#!/usr/bin/env node
const path = require("node:path");
const { CONFIG_SHEETS, RULE_DICTIONARY } = require("./lib/config-schema.cjs");
const { cleanRows, readWorkbook, sheetToRows, writeWorkbook } = require("./lib/excel.cjs");

const input = process.argv[2];
const output = process.argv[3] || "docs/config-v2.xlsx";
if (!input) {
  console.error("用法: pnpm node scripts/migrate_config.cjs <旧配置.xlsx> [输出.xlsx]");
  process.exit(1);
}

const wb = readWorkbook(path.resolve(input));
const sheets = {
  配置说明: [
    { 内容: "v2", 项目: "配置版本" },
    { 内容: "推荐写法：{售价} - {总费用} - {成本价}", 项目: "规则公式" },
    { 内容: "优先读取 费用规则.条件数据，条件1-4列作为兼容字段", 项目: "条件树" },
  ],
};

for (const sheetName of CONFIG_SHEETS)
  sheets[sheetName] = cleanRows(sheetToRows(wb, sheetName), sheetName);

for (const sheetName of wb.SheetNames) {
  if (!CONFIG_SHEETS.includes(sheetName) && !sheetName.startsWith("__"))
    sheets[sheetName] = cleanRows(sheetToRows(wb, sheetName), sheetName);
}

sheets.规则字典 = RULE_DICTIONARY.slice(1).map(([类别, 值, 说明]) => ({ 值, 类别, 说明 }));
writeWorkbook(path.resolve(output), sheets);
console.log(`已输出: ${path.resolve(output)}`);
