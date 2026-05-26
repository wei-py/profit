import dayjs from "dayjs";
import ExcelJS from "exceljs";
import { CONFIG_HEADERS, CONFIG_SHEET_NAMES, META_SHEET_NAME } from "@/constants/schema";
import { dedupeOptionConfigs } from "@/domain/option-config-dedupe";
import { displayWidth } from "@/utils/value";

const MIN_W = 8;
const MAX_W = 34;
const PAD = 2;

export async function buildWorkbookBuffer(config) {
  const exportConfig = {
    ...config,
    选项配置: dedupeOptionConfigs(config.选项配置 || []),
  };

  const wb = new ExcelJS.Workbook();
  wb.creator = "profit-tool";
  wb.created = dayjs().toDate();

  for (const name of CONFIG_SHEET_NAMES) {
    if (name === "计算配置") {
      const ruleRows = flattenCalculationConfig(exportConfig[name] || []);
      if (ruleRows.length)
        appendSheet(wb, name, ruleRows, CONFIG_HEADERS[name]);
      continue;
    }
    const data = exportConfig[name] || [];
    if (!data.length)
      continue;
    const preferred
      = name === "国家平台" && exportConfig.国家平台ColOrder?.length
        ? exportConfig.国家平台ColOrder
        : CONFIG_HEADERS[name] || [];
    appendSheet(wb, name, data, preferred);
  }

  for (const [name, data] of Object.entries(exportConfig.lookupTables || {})) {
    if (data?.length)
      appendSheet(wb, name, data);
  }

  appendMetaSheet(wb, {
    国家平台HiddenCols: exportConfig.国家平台HiddenCols || [],
  });

  return new Uint8Array(await wb.xlsx.writeBuffer());
}

function flattenCalculationConfig(templates = []) {
  const rows = [];
  for (const tpl of templates) {
    const flow = parseFlow(tpl.流程JSON);
    for (const rule of flow.rules || []) {
      rows.push({
        所属国家平台: tpl.所属国家平台,
        模板名称: tpl.模板名称,
        模板启用: tpl.模板启用,
        模板编号: tpl.模板编号,
        模板说明: tpl.模板说明 || "",
        流程JSON: JSON.stringify(rule.graph),
        规则名称: rule.name,
        规则启用: rule.enabled ? "是" : "否",
        规则排序: rule.order ?? "",
        规则编号: rule.id,
      });
    }
  }
  return rows;
}

function parseFlow(value) {
  if (!value)
    return { rules: [], version: 2 };
  try {
    return typeof value === "object" ? value : JSON.parse(value);
  }
  catch {
    return { rules: [], version: 2 };
  }
}

function appendSheet(wb, name, data, preferred = []) {
  const ws = wb.addWorksheet(safeSheetName(name));
  const keys = collectKeys(data, preferred);
  ws.columns = keys.map(key => ({ header: key, key }));
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { fgColor: { argb: "FF111827" }, pattern: "solid", type: "pattern" };
  header.alignment = { horizontal: "center", vertical: "middle" };

  for (const row of data || []) {
    const values = keys.map(key => row?.[key] ?? "");
    const excelRow = ws.addRow(values);
    excelRow.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  }

  ws.columns.forEach((col, index) => {
    let maxW = displayWidth(keys[index]);
    for (const row of data || []) maxW = Math.max(maxW, displayWidth(row?.[keys[index]]));
    col.width = Math.max(MIN_W, Math.min(MAX_W, maxW + PAD));
  });
}

function appendMetaSheet(wb, meta) {
  const ws = wb.addWorksheet(META_SHEET_NAME);
  ws.addRow(["key", "value"]);
  for (const [key, value] of Object.entries(meta)) ws.addRow([key, JSON.stringify(value)]);
  ws.state = "hidden";
}

function collectKeys(data = [], preferred = []) {
  const keys = [];
  const seen = new Set();
  for (const key of preferred || []) {
    if (key && !seen.has(key)) {
      keys.push(key);
      seen.add(key);
    }
  }
  for (const row of data || []) {
    for (const key of Object.keys(row || {})) {
      if (key && !seen.has(key)) {
        keys.push(key);
        seen.add(key);
      }
    }
  }
  return keys;
}

function safeSheetName(name) {
  return String(name || "Sheet")
    .slice(0, 31)
    .replace(/[\\/?*[\]:]/g, "_");
}
