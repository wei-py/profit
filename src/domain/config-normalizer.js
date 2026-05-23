import { CONFIG_HEADERS } from "@/constants/schema";
import { normalizeOptionGroup } from "@/utils/optionCascade";
import {
  cleanRow,
  dropEmptyRows,
  isEnabled,
  normalizeId,
  orderByNumber,
} from "@/utils/value";

function stripCountryPrefix(value) {
  const v = String(value || "").trim();
  const idx = v.indexOf("_");
  let result = idx > 0 && idx < v.length - 1 ? v.slice(idx + 1) : v;
  // Map legacy group names to actual root node IDs
  if (result === "布尔")
    result = "是/否";
  return result;
}

export function normalizeConfig(raw = {}) {
  const 国家平台 = normalizeRows(raw.国家平台, "国家平台", ["编号"]);
  const 计算字段 = normalizeFields(raw.计算字段);
  const 选项配置 = normalizeOptionConfigs(raw);
  const 计算配置 = normalizeCalculationConfig(raw.计算配置);
  const lookupTables = normalizeLookupTables(raw.lookupTables);

  return {
    lookupTables,
    国家平台,
    国家平台ColOrder: raw.国家平台ColOrder || CONFIG_HEADERS.国家平台,
    国家平台HiddenCols: raw.国家平台HiddenCols || [],
    计算字段,
    计算配置,
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
  return normalizeRows(rows, "计算字段", ["字段名称", "所属国家平台"]).map(row => ({
    ...row,
    启用: row.启用 || "是",
    字段名称: row.字段名称 || row.字段键,
    字段键: normalizeId(row.字段键 || row.字段名称),
    层级: row.层级 || "SKU级",
    类型: row.类型 || "文本",
    输入输出: row.输入输出 || "输入",
    选项组: stripCountryPrefix(row.选项组 || row.选项组编号 || ""),
  }));
}

function normalizeOptionConfigs(raw = {}) {
  if (raw.选项配置?.length) {
    return normalizeRows(raw.选项配置, "选项配置", ["选项值编号", "选项值"]).map((row) => {
      const nodeId = (row.选项值编号 || "").trim();
      const parentId = (row.父级选项值编号 || "").trim();
      const parentVal = (row.父级选项值 || "").trim();

      // Reconstruct from legacy fields if missing
      const finalNodeId = nodeId
        || buildNodeIdFromLegacy(row);

      const finalParentId = parentId
        || (row.父级选项组 || row.父级 || "").trim()
        || "";

      const finalParentVal = parentVal
        || (row.父级选项组 ? "" : "") // can't derive
        || "";

      return {
        启用: isEnabled(row) ? "是" : "否",
        备注: row.备注 || "",
        所属国家平台: normalizeId(row.所属国家平台),
        排序: row.排序 || "",
        父级选项值: finalParentVal,
        父级选项值编号: finalParentId,
        选项值: (row.选项值 || "").trim(),
        选项值编号: finalNodeId,
      };
    });
  }

  const groups = normalizeRows(raw.选项组 || [], "选项组", ["编号"]).map(normalizeOptionGroup);
  const items = normalizeOptionItemsLegacy(raw.选项值 || []);

  if (!groups.length && !items.length)
    return [];

  return convertLegacyToOptionConfigs(groups, items);
}

function buildNodeIdFromLegacy(row) {
  // Try to reconstruct 选项值编号 from old fields
  const parentPath = (row.父级选项组 || row.父级 || "").trim();
  const value = (row.选项值 || "").trim();
  if (!value)
    return "";

  // If we have old 选项组 + 选项值, build path
  const groupName = stripCountryPrefix(
    row.选项组 || row.选项组名称 || row.选项组编号 || "",
  );
  if (groupName) {
    // This is old 选项组 model: 选项组=商品类目, 父级选项组=商品类目, 选项值=服饰
    const parent = (row.父级选项组 || row.父级 || "").trim();
    if (parent) {
      return `${parent} / ${value}`;
    }
    return `${groupName} / ${value}`;
  }

  if (parentPath) {
    return `${parentPath} / ${value}`;
  }
  return value;
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

  const rows = [];

  function addNodes(group, parentNodeId, parentValue) {
    const groupName = group.名称 || group.编号 || "";
    // Top-level node for the group itself
    if (!parentNodeId) {
      rows.push({
        启用: "是",
        备注: group.说明 || "",
        所属国家平台: normalizeId(group.所属国家平台),
        排序: group.排序 || "",
        父级选项值: "",
        父级选项值编号: "",
        选项值: groupName,
        选项值编号: groupName,
      });
    }

    const groupItems = (itemsByGroup.get(group.编号) || []).map((item, idx) => {
      const nodeId = parentNodeId
        ? `${parentNodeId} / ${item.选项值}`
        : `${groupName} / ${item.选项值}`;
      return {
        启用: item.启用 || "是",
        备注: item.备注 || "",
        所属国家平台: normalizeId(group.所属国家平台),
        排序: item.排序 || idx + 1,
        父级选项值: parentValue || groupName,
        父级选项值编号: parentNodeId || groupName,
        选项值: (item.选项值 || "").trim(),
        选项值编号: nodeId,
      };
    });
    rows.push(...groupItems);

    const childGroups = childGroupsByParent.get(group.编号) || [];
    for (const childGroup of childGroups) {
      const childTrigger = childGroup.父级选项值;
      const matched = groupItems.find(r => r.选项值 === childTrigger);
      if (matched) {
        addNodes(childGroup, matched.选项值编号, matched.选项值);
      }
    }
  }

  for (const g of rootGroups) {
    addNodes(g, "", "");
  }

  return rows;
}

function normalizeCalculationConfig(rows = []) {
  return orderByNumber(
    normalizeRows(rows, "计算配置", ["所属国家平台", "模板编号"]).map((row, index) => ({
      所属国家平台: normalizeId(row.所属国家平台),
      排序: row.排序 || "",
      模板名称: row.模板名称 || row.名称 || normalizeId(row.模板编号) || `模板${index + 1}`,
      模板启用: isEnabled({ 启用: row.模板启用 || row.启用 }) ? "是" : "否",
      模板编号: normalizeId(row.模板编号) || `template_${index + 1}`,
      模板说明: row.模板说明 || row.说明 || "",
      流程JSON: row.流程JSON || row.流程 || "",
    })),
    "排序",
  );
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
