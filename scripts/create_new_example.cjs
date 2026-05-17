#!/usr/bin/env node
/** 生成/迁移一份 v2 配置。没有输入时会创建空结构；有输入时会按新表头清洗。 */
const path = require("node:path");
const { CONFIG_SHEETS, RULE_DICTIONARY } = require("./lib/config-schema.cjs");
const { cleanRows, readWorkbook, sheetToRows, writeWorkbook } = require("./lib/excel.cjs");

const input = process.argv[2] && !process.argv[2].endsWith(".xlsx") ? "" : process.argv[2];
const output = input
  ? process.argv[3] || "docs/config-v2.xlsx"
  : process.argv[2] || "docs/config-v2.xlsx";
const sheets = {
  规则字典: RULE_DICTIONARY.slice(1).map(([类别, 值, 说明]) => ({ 值, 类别, 说明 })),
  配置说明: [
    { 内容: "v2", 项目: "配置版本" },
    { 内容: "业务配置与商品记录分离；规则、字段、选项都在本文件维护", 项目: "维护方式" },
    { 内容: "字段请用 {字段键} 包裹，例如 {净利润} / {售价}", 项目: "公式提示" },
  ],
};

if (input) {
  const wb = readWorkbook(path.resolve(input));
  for (const sheetName of CONFIG_SHEETS)
    sheets[sheetName] = cleanRows(sheetToRows(wb, sheetName), sheetName);
  for (const sheetName of wb.SheetNames) {
    if (!CONFIG_SHEETS.includes(sheetName) && !sheetName.startsWith("__"))
      sheets[sheetName] = cleanRows(sheetToRows(wb, sheetName), sheetName);
  }
}
else {
  for (const sheetName of CONFIG_SHEETS) sheets[sheetName] = [];
}

writeWorkbook(path.resolve(output), sheets);
console.log(`已输出: ${path.resolve(output)}`);
