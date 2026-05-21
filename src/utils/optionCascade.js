import { isEnabled, orderByNumber } from "@/utils/value";

export const CASCADE_SEPARATOR = " / ";

export function parseCascadePath(value) {
  if (!value)
    return [];
  return String(value)
    .split(CASCADE_SEPARATOR)
    .map(s => s.trim())
    .filter(Boolean);
}

export function formatCascadePath(values) {
  return values
    .map(v => String(v || "").trim())
    .filter(Boolean)
    .join(CASCADE_SEPARATOR);
}

// -- legacy compat helpers --

export function getParentTriggerValue(group) {
  for (const key of ["父级选项值", "父选项值", "父级选项", "父选项"]) {
    const value = group?.[key];
    if (value)
      return value;
  }
  return "";
}

export function normalizeOptionGroup(row = {}) {
  const group = {
    名称: "",
    所属国家平台: "",
    父级编号: "",
    父级选项值: "",
    编号: "",
    说明: "",
    ...row,
  };
  group.编号 = group.编号 ? String(group.编号).trim() : "";
  group.所属国家平台 = group.所属国家平台 ? String(group.所属国家平台).trim() : "";
  group.父级编号 = group.父级编号 ? String(group.父级编号).trim() : "";
  group.父级选项值 = getParentTriggerValue(row);
  return group;
}

// -- index builder --

/** Build lookup maps for lazy tree navigation. Returns: { childrenByParent, rowById } childrenByParent: Map<parentNodeId, sortedRows[]> where parentNodeId="" maps to root-level rows. rowById: Map<nodeId, row> */
export function buildOptionIndex(optionConfigs = []) {
  const childrenByParent = new Map();
  const rowById = new Map();

  for (const row of optionConfigs) {
    if (!isEnabled(row))
      continue;
    const nodeId = (row.选项值编号 || "").trim();
    const parentId = (row.父级选项值编号 || "").trim();
    if (nodeId)
      rowById.set(nodeId, row);

    const key = parentId;
    const list = childrenByParent.get(key) || [];
    list.push(row);
    childrenByParent.set(key, list);
  }

  // Sort each child list once
  for (const list of childrenByParent.values()) {
    list.sort((a, b) => {
      const oa = Number(a?.排序);
      const ob = Number(b?.排序);
      if (Number.isFinite(oa) && Number.isFinite(ob))
        return oa - ob;
      if (Number.isFinite(oa))
        return -1;
      if (Number.isFinite(ob))
        return 1;
      return 0;
    });
  }

  return { childrenByParent, rowById };
}

// -- legacy linear helpers (still used by store for country-based filtering) --

export function sortOptionConfigs(rows) {
  return orderByNumber(rows, "排序");
}

export function getRootOptionItems(optionConfigs) {
  return sortOptionConfigs(
    (optionConfigs || []).filter(
      row => !(row.父级选项值编号 || "").trim() && isEnabled(row) && row.选项值,
    ),
  );
}

export function getChildOptionItems(optionConfigs, parentId) {
  if (!parentId)
    return [];
  const pid = (parentId || "").trim();
  return sortOptionConfigs(
    (optionConfigs || []).filter(
      row => (row.父级选项值编号 || "").trim() === pid && isEnabled(row) && row.选项值,
    ),
  );
}

export function toSelectOptions(items) {
  return items.map(item => ({
    label: item.显示名 || item.选项值,
    value: item.选项值编号 || item.选项值,
  }));
}

export function groupHasDescendants(optionConfigs, nodeId) {
  if (!nodeId)
    return false;
  return (optionConfigs || []).some(
    row => (row.父级选项值编号 || "").trim() === String(nodeId).trim() && isEnabled(row),
  );
}

export { getChildOptionItems as getEnabledOptionItems };

// -- cascade steps (multi-select dropdown chain, used by config store) --

export function buildCascadeSteps({
  optionConfigs = [],
  pathValues = [],
  rootGroupId,
}) {
  const rootId = String(rootGroupId || "").trim();
  if (!rootId)
    return [];

  const steps = [];
  let currentParentId = rootId;

  for (let i = 0; i <= pathValues.length; i++) {
    const levelNodes = getChildOptionItems(optionConfigs, currentParentId);
    if (!levelNodes.length)
      break;

    const items = levelNodes.map(n => ({
      label: n.显示名 || n.选项值,
      value: n.选项值编号 || n.选项值,
    }));

    const sel = i < pathValues.length ? String(pathValues[i] || "").trim() : "";

    const parentRow = (optionConfigs || []).find(
      r => (r.选项值编号 || "").trim() === currentParentId,
    );
    const groupName = parentRow ? parentRow.选项值 : currentParentId;

    steps.push({
      groupId: rootId,
      groupName,
      items,
      selectedValue: sel,
    });

    if (!sel)
      break;

    currentParentId = sel;
  }

  return steps;
}

export function getCascadeDefaultValue({ optionConfigs = [], rootGroupId }) {
  const items = getChildOptionItems(optionConfigs, rootGroupId);
  return items[0]?.选项值编号 || items[0]?.选项值 || "";
}
