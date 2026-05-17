#!/usr/bin/env node
const path = require("node:path");
const { REQUIRED_SHEETS } = require("./lib/config-schema.cjs");
const { readWorkbook, sheetToRows } = require("./lib/excel.cjs");

const file = process.argv[2];
if (!file) {
  console.error("用法: pnpm node scripts/inspect_excel.cjs <配置.xlsx>");
  process.exit(1);
}

const fullPath = path.resolve(file);
const wb = readWorkbook(fullPath);
const missing = REQUIRED_SHEETS.filter(name => !wb.SheetNames.includes(name));
if (missing.length) {
  console.error(`缺少必要 sheet: ${missing.join(", ")}`);
  process.exit(2);
}

console.log(`文件: ${fullPath}`);
console.log("\nSheets:");
for (const name of wb.SheetNames) {
  const rows = sheetToRows(wb, name);
  console.log(`  - ${name}: ${rows.length} 行`);
}

const rules = sheetToRows(wb, "费用规则");
const templates = sheetToRows(wb, "计算模板");
console.log("\n模板:");
for (const tpl of templates) console.log(`  - ${tpl.编号} ${tpl.名称} (${tpl.所属国家平台})`);

console.log("\n规则:");
for (const rule of rules) {
  console.log(
    `  - ${rule.所属模板} / ${rule.计算顺序} / ${rule.编号} / ${rule.计算方式} -> ${rule.输出字段键}`,
  );
}
