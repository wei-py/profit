import { CONFIG_HEADERS } from "@/constants/schema";
import { normalizeOptionGroup } from "@/utils/optionCascade";
import { cleanRow, dropEmptyRows, isBlank, isEnabled, normalizeId, orderByNumber } from "@/utils/value";

export function normalizeConfig(raw = {}) {
  const 国家平台 = normalizeRows(raw.国家平台, "国家平台", ["编号"]);
  const 计算字段 = normalizeFields(raw.计算字段);
  const 选项组 = normalizeRows(raw.选项组, "选项组", ["编号"]).map(normalizeOptionGroup);
  const 选项值 = normalizeOptionItems(raw.选项值);
  const 计算模板 = normalizeRows(raw.计算模板, "计算模板", ["编号"]);
  const 费用规则 = normalizeRules(raw.费用规则);
  const 模板参数 = normalizeRows(raw.模板参数, "模板参数", ["模板编号", "字段键"]);

  return {
    lookupTables: normalizeLookupTables(raw.lookupTables),
    国家平台,
    国家平台ColOrder: raw.国家平台ColOrder || CONFIG_HEADERS.国家平台,
    国家平台HiddenCols: raw.国家平台HiddenCols || [],
    模板参数,
    计算字段,
    计算模板,
    费用规则,
    选项值,
    选项组,
  };
}

export function normalizeRows(rows, sheetName, keyFields = []) {
  return dropEmptyRows(
    (rows || []).map(row => cleanRow(row, CONFIG_HEADERS[sheetName] || [])),
    keyFields,
  );
}

export function normalizeFields(rows = []) {
  return normalizeRows(rows, "计算字段", ["字段键", "所属国家平台"]).map(row => ({
    ...row,
    字段键: normalizeId(row.字段键),
    字段名称: row.字段名称 || row.字段键,
    类型: row.类型 || "文本",
    层级: row.层级 || "SKU级",
    输入输出: row.输入输出 || "输入",
    启用: row.启用 || "是",
  }));
}

export function normalizeOptionItems(rows = []) {
  return orderByNumber(normalizeRows(rows, "选项值", ["所属分组", "选项值"]).map(row => ({
    ...row,
    所属分组: normalizeId(row.所属分组),
    选项值: normalizeId(row.选项值),
    显示名: row.显示名 || row.选项值,
    启用: isEnabled(row) ? "是" : "否",
  })), "排序");
}

export function normalizeRules(rows = []) {
  return orderByNumber(normalizeRows(rows, "费用规则", ["编号"]).map((row, index) => ({
    ...row,
    编号: normalizeId(row.编号) || `rule_${index + 1}`,
    所属模板: normalizeId(row.所属模板),
    输出字段键: normalizeId(row.输出字段键),
    费用名称: row.费用名称 || row.输出字段键,
    计算顺序: isBlank(row.计算顺序) ? String((index + 1) * 10) : row.计算顺序,
    启用: isEnabled(row) ? "是" : "否",
    累加: row.累加 === "是" ? "是" : "否",
  })), "计算顺序");
}

function normalizeLookupTables(tables = {}) {
  const out = {};
  for (const [name, rows] of Object.entries(tables || {})) {
    out[name] = dropEmptyRows((rows || []).map(row => cleanRow(row)), []);
  }
  return out;
}
