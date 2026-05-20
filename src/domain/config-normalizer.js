import { CONFIG_HEADERS } from "@/constants/schema";
import { normalizeOptionGroup } from "@/utils/optionCascade";
import {
  cleanRow,
  dropEmptyRows,
  isBlank,
  isEnabled,
  normalizeId,
  orderByNumber,
} from "@/utils/value";

export function normalizeConfig(raw = {}) {
  const 国家平台 = normalizeRows(raw.国家平台, "国家平台", ["编号"]);
  const 计算字段 = normalizeFields(raw.计算字段);
  const 选项配置 = normalizeOptionConfigs(raw);
  const 计算模板 = normalizeRows(raw.计算模板, "计算模板", ["编号"]);
  const 费用规则 = normalizeRules(raw.费用规则);
  const 模板参数 = normalizeRows(raw.模板参数, "模板参数", ["模板编号", "字段键"]);
  const lookupTables = normalizeLookupTables(raw.lookupTables);
  const 查表配置 = normalizeLookupConfigs(raw.查表配置, lookupTables, 费用规则);

  return {
    lookupTables,
    国家平台,
    国家平台ColOrder: raw.国家平台ColOrder || CONFIG_HEADERS.国家平台,
    国家平台HiddenCols: raw.国家平台HiddenCols || [],
    查表配置,
    模板参数,
    计算字段,
    计算模板,
    费用规则,
    选项配置,
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
    启用: row.启用 || "是",
    字段名称: row.字段名称 || row.字段键,
    字段键: normalizeId(row.字段键),
    层级: row.层级 || "SKU级",
    类型: row.类型 || "文本",
    输入输出: row.输入输出 || "输入",
  }));
}

function normalizeOptionConfigs(raw = {}) {
  if (raw.选项配置?.length) {
    return normalizeRows(raw.选项配置, "选项配置", ["编号", "选项组编号"]).map(row => ({
      ...row,
      启用: isEnabled(row) ? "是" : "否",
      所属国家平台: normalizeId(row.所属国家平台),
      显示名: row.显示名 || row.选项值,
      父级: normalizeId(row.父级),
      编号: normalizeId(row.编号),
      选项值: normalizeId(row.选项值),
      选项组名称: row.选项组名称 || "",
      选项组编号: normalizeId(row.选项组编号),
    }));
  }

  const groups = normalizeRows(raw.选项组 || [], "选项组", ["编号"]).map(normalizeOptionGroup);
  const items = normalizeOptionItemsLegacy(raw.选项值 || []);

  if (!groups.length && !items.length)
    return [];

  return convertLegacyToOptionConfigs(groups, items);
}

function normalizeOptionItemsLegacy(rows = []) {
  return orderByNumber(
    normalizeRows(rows, "选项值", ["所属分组", "选项值"]).map(row => ({
      ...row,
      启用: isEnabled(row) ? "是" : "否",
      所属分组: normalizeId(row.所属分组),
      显示名: row.显示名 || row.选项值,
      选项值: normalizeId(row.选项值),
    })),
    "排序",
  );
}

function convertLegacyToOptionConfigs(groups = [], items = []) {
  const childGroupsByParent = new Map();
  const rootGroups = [];

  for (const g of groups) {
    if (!g.父级编号) {
      rootGroups.push(g);
    }
    else {
      const list = childGroupsByParent.get(g.父级编号) || [];
      list.push(g);
      childGroupsByParent.set(g.父级编号, list);
    }
  }

  const itemsByGroup = new Map();
  for (const item of items) {
    const list = itemsByGroup.get(item.所属分组) || [];
    list.push(item);
    itemsByGroup.set(item.所属分组, list);
  }

  const usedNames = new Set();

  function uniqueId(base) {
    const id = safeSlug(base || "opt");
    if (!usedNames.has(id)) {
      usedNames.add(id);
      return id;
    }
    let i = 2;
    while (usedNames.has(`${id}_${i}`)) i += 1;
    const result = `${id}_${i}`;
    usedNames.add(result);
    return result;
  }

  const rows = [];

  function addLeafOptions(group, parentOptionId) {
    const rootGroupId = parentOptionId ? "" : normalizeId(group.编号);
    const groupName = group.名称 || group.编号 || "";
    const gid = rootGroupId || normalizeId(group.编号);

    const groupItems = (itemsByGroup.get(group.编号) || []).map((item, idx) => {
      const optionId = uniqueId(`${gid}_${safeSlug(item.选项值 || `item${idx + 1}`)}`);
      return {
        启用: item.启用 || "是",
        备注: item.备注 || "",
        所属国家平台: normalizeId(group.所属国家平台),
        排序: item.排序 || idx + 1,
        显示名: item.显示名 || item.选项值,
        父级: parentOptionId || "",
        编号: optionId,
        选项值: item.选项值,
        选项组名称: rootGroupId ? groupName : group.选项组名称 || groupName,
        选项组编号: gid,
      };
    });
    rows.push(...groupItems);

    // Handle child groups: find matched parent option, then recurse
    const childGroups = childGroupsByParent.get(group.编号) || [];
    for (const childGroup of childGroups) {
      const childTrigger = childGroup.父级选项值;
      const matchedOption = groupItems.find(row => row.选项值 === childTrigger);
      addLeafOptions(childGroup, matchedOption ? matchedOption.编号 : "");
    }
  }

  for (const g of rootGroups) {
    addLeafOptions(g);
  }

  return rows;
}

function safeSlug(value) {
  return String(value || "opt")
    .trim()
    .replace(/[\\/?*[\]:"|<>]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "") || "opt";
}

export function normalizeRules(rows = []) {
  return orderByNumber(
    normalizeRows(rows, "费用规则", ["编号"]).map((row, index) => ({
      ...row,
      启用: isEnabled(row) ? "是" : "否",
      所属模板: normalizeId(row.所属模板),
      累加: row.累加 === "是" ? "是" : "否",
      编号: normalizeId(row.编号) || `rule_${index + 1}`,
      计算顺序: isBlank(row.计算顺序) ? String((index + 1) * 10) : row.计算顺序,
      费用名称: row.费用名称 || row.输出字段键,
      输出字段键: normalizeId(row.输出字段键),
    })),
    "计算顺序",
  );
}

function normalizeLookupConfigs(rows = [], lookupTables = {}, rules = []) {
  const configs = normalizeRows(rows, "查表配置", ["表名"]).map(row => ({
    ...row,
    启用: isEnabled(row) ? "是" : "否",
    所属模板: normalizeId(row.所属模板),
    表名: String(row.表名 || "").trim(),
  }));
  const byName = new Map(configs.map(row => [row.表名, row]));

  for (const name of Object.keys(lookupTables || {})) {
    if (!name || byName.has(name))
      continue;
    byName.set(name, {
      启用: "是",
      所属模板: findLookupTemplateId(name, rules),
      表名: name,
      说明: "",
    });
  }

  for (const rule of rules || []) {
    const name = String(rule.查表名称 || "").trim();
    if (!name || byName.has(name))
      continue;
    byName.set(name, {
      启用: "是",
      所属模板: normalizeId(rule.所属模板),
      表名: name,
      说明: "",
    });
  }

  return [...byName.values()];
}

function findLookupTemplateId(name, rules = []) {
  const rule = rules.find(row => String(row.查表名称 || "").trim() === name);
  return normalizeId(rule?.所属模板);
}

function normalizeLookupTables(tables = {}) {
  const out = {};
  for (const [name, rows] of Object.entries(tables || {})) {
    out[name] = dropEmptyRows(
      (rows || []).map(row => cleanRow(row)),
      [],
    );
  }
  return out;
}
