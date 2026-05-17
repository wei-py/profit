import * as XLSX from "xlsx";
import { CONFIG_HEADERS, META_SHEET_NAME, REQUIRED_CONFIG_SHEETS } from "@/constants/schema";
import { normalizeConfig } from "@/domain/config-normalizer";

export function readWorkbookBuffer(buffer) {
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
  return readConfigWorkbook(wb);
}

function readConfigWorkbook(wb) {
  const names = wb.SheetNames || [];
  for (const sheetName of REQUIRED_CONFIG_SHEETS) {
    if (!names.includes(sheetName))
      throw new Error(`配置缺少 sheet：「${sheetName}」`);
  }

  const raw = {
    lookupTables: {},
    国家平台: sheetToRows(wb, "国家平台"),
    国家平台ColOrder: getSheetHeaders(wb, "国家平台"),
    国家平台HiddenCols: readMetaArray(wb, "国家平台HiddenCols"),
    模板参数: sheetToRows(wb, "模板参数", true),
    计算字段: sheetToRows(wb, "计算字段"),
    计算模板: sheetToRows(wb, "计算模板"),
    费用规则: sheetToRows(wb, "费用规则"),
    选项值: sheetToRows(wb, "选项值"),
    选项组: sheetToRows(wb, "选项组"),
  };

  for (const sheetName of collectLookupSheetNames(names, raw.费用规则))
    raw.lookupTables[sheetName] = sheetToRows(wb, sheetName, true);

  return normalizeConfig(raw);
}

function collectLookupSheetNames(sheetNames, rules) {
  const standard = new Set([...REQUIRED_CONFIG_SHEETS, "模板参数", "配置说明", "规则字典", META_SHEET_NAME]);
  const refs = new Set();

  for (const rule of rules || []) {
    if (rule.查表名称)
      refs.add(String(rule.查表名称).trim());
  }

  for (const sheetName of sheetNames) {
    if (standard.has(sheetName))
      continue;
    if (refs.has(sheetName) || /table|表/i.test(sheetName))
      refs.add(sheetName);
  }
  return [...refs].filter(name => sheetNames.includes(name));
}

function sheetToRows(wb, name, optional = false) {
  const ws = wb.Sheets[name];
  if (!ws) {
    if (optional)
      return [];
    throw new Error(`Sheet「${name}」不存在`);
  }

  return XLSX.utils.sheet_to_json(ws, {
    defval: "",
    raw: false,
  });
}

function getSheetHeaders(wb, name) {
  const ws = wb.Sheets[name];
  if (!ws || !ws["!ref"])
    return CONFIG_HEADERS[name] || [];
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const headers = [];
  for (let c = range.s.c; c <= range.e.c; c += 1) {
    const cell = ws[XLSX.utils.encode_cell({ c, r: range.s.r })];
    if (cell?.v)
      headers.push(String(cell.v));
  }
  return headers.length ? headers : CONFIG_HEADERS[name] || [];
}

function readMetaArray(wb, key) {
  try {
    const ws = wb.Sheets[META_SHEET_NAME];
    if (!ws)
      return [];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "", header: 1 });
    for (const row of rows) {
      if (row?.[0] === key && row[1]) {
        const parsed = JSON.parse(row[1]);
        return Array.isArray(parsed) ? parsed : [];
      }
    }
  }
  catch {}
  return [];
}

/** @deprecated 业务列表请使用 list-excel-reader.js，保留该导出兼容旧调用。 */
export function readListWorkbook(buffer) {
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const ws = wb.Sheets["商品记录"];
  return ws ? XLSX.utils.sheet_to_json(ws, { defval: "" }) : [];
}
