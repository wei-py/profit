import ExcelJS from "exceljs";
import { CONFIG_HEADERS, CONFIG_SHEET_NAMES, META_SHEET_NAME } from "@/constants/schema";
import { displayWidth } from "@/utils/value";

const MIN_W = 8;
const MAX_W = 34;
const PAD = 2;

export async function buildWorkbookBuffer(config) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "profit-tool";
  wb.created = new Date();

  for (const name of CONFIG_SHEET_NAMES) {
    const data = config[name] || [];
    if (!data.length && name !== "模板参数")
      continue;
    const preferred = name === "国家平台" && config.国家平台ColOrder?.length
      ? config.国家平台ColOrder
      : CONFIG_HEADERS[name] || [];
    appendSheet(wb, name, data, preferred);
  }

  for (const [name, data] of Object.entries(config.lookupTables || {})) {
    if (data?.length)
      appendSheet(wb, name, data);
  }

  appendMetaSheet(wb, {
    国家平台HiddenCols: config.国家平台HiddenCols || [],
  });

  return new Uint8Array(await wb.xlsx.writeBuffer());
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
    for (const row of data || [])
      maxW = Math.max(maxW, displayWidth(row?.[keys[index]]));
    col.width = Math.max(MIN_W, Math.min(MAX_W, maxW + PAD));
  });
}

function appendMetaSheet(wb, meta) {
  const ws = wb.addWorksheet(META_SHEET_NAME);
  ws.addRow(["key", "value"]);
  for (const [key, value] of Object.entries(meta))
    ws.addRow([key, JSON.stringify(value)]);
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
  return String(name || "Sheet").slice(0, 31).replace(/[\\/?*\[\]:]/g, "_");
}
