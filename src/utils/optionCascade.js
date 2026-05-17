import { isEnabled, normalizeId, orderByNumber } from "@/utils/value";

export const CASCADE_SEPARATOR = " > ";
const TRIGGER_KEYS = ["父级选项值", "父选项值", "父级选项", "父选项"];

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

export function getParentTriggerValue(group) {
  for (const key of TRIGGER_KEYS) {
    const value = normalizeId(group?.[key]);
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
  group.编号 = normalizeId(group.编号);
  group.所属国家平台 = normalizeId(group.所属国家平台);
  group.父级编号 = normalizeId(row.父级编号);
  group.父级选项值 = getParentTriggerValue(row);
  return group;
}

export function parseParentTriggerValues(group) {
  const raw = getParentTriggerValue(group);
  if (!raw)
    return [];
  return raw
    .split(/[|,，;；]/)
    .map(s => s.trim())
    .filter(Boolean);
}

export function groupLooksBoundToOption(group, parentValue) {
  const selected = normalizeId(parentValue);
  if (!selected)
    return false;

  const candidates = [
    group?.名称,
    group?.编号,
    String(group?.编号 || "")
      .split(/[\s_\-./\\]+/)
      .pop(),
  ]
    .map(normalizeId)
    .filter(Boolean);

  return candidates.includes(selected);
}

export function parentOptionMatches(group, parentValue) {
  const triggers = parseParentTriggerValues(group);
  const selected = normalizeId(parentValue);
  if (!selected)
    return false;
  if (triggers.length)
    return triggers.includes(selected);

  // 新模型：子级选项组必须挂在某个父选项值下。
  // 兼容旧数据：如果旧数据没填“父级选项值”，但子组名称/编号刚好等于父选项值，自动按该选项挂载。
  return groupLooksBoundToOption(group, selected);
}

export function sortOptionItems(items) {
  return orderByNumber(items, "排序");
}

export function sortOptionGroups(groups) {
  return orderByNumber(groups, "排序");
}

export function getEnabledOptionItems(optionItems, groupId) {
  const gid = normalizeId(groupId);
  if (!gid)
    return [];
  return sortOptionItems(
    (optionItems || []).filter(item => normalizeId(item.所属分组) === gid && isEnabled(item)),
  );
}

export function toSelectOptions(items) {
  return items.map(item => ({
    label: item.显示名 || item.选项值,
    value: item.选项值,
  }));
}

export function getChildGroups(optionGroups, parentGroupId, parentValue) {
  const pid = normalizeId(parentGroupId);
  if (!pid)
    return [];
  return sortOptionGroups(
    (optionGroups || []).filter(
      group => normalizeId(group.父级编号) === pid && parentOptionMatches(group, parentValue),
    ),
  );
}

export function getAnyChildGroups(optionGroups, parentGroupId) {
  const pid = normalizeId(parentGroupId);
  if (!pid)
    return [];
  return sortOptionGroups(
    (optionGroups || []).filter(group => normalizeId(group.父级编号) === pid),
  );
}

export function groupHasDescendants(optionGroups, rootGroupId) {
  const rootId = normalizeId(rootGroupId);
  if (!rootId)
    return false;

  const seen = new Set([rootId]);
  const queue = [rootId];
  while (queue.length) {
    const parentId = queue.shift();
    const children = getAnyChildGroups(optionGroups, parentId).filter(
      child => !seen.has(child.编号),
    );
    if (children.length)
      return true;
    for (const child of children) {
      seen.add(child.编号);
      queue.push(child.编号);
    }
  }
  return false;
}

export function getGroupName(optionGroups, groupId) {
  const gid = normalizeId(groupId);
  const group = (optionGroups || []).find(g => normalizeId(g.编号) === gid);
  return group ? group.名称 || group.编号 : gid;
}

function makeTreeKey(pathValues) {
  return pathValues.join("\u001F");
}

function buildOptionValueTreeForGroup({
  depth = 0,
  groupId,
  optionGroups,
  optionItems,
  pathLabels = [],
  pathValues = [],
  visited = new Set(),
}) {
  const gid = normalizeId(groupId);
  if (!gid || depth > 20 || visited.has(gid))
    return [];

  const nextVisited = new Set(visited);
  nextVisited.add(gid);

  return getEnabledOptionItems(optionItems, gid).map((item) => {
    const value = normalizeId(item.选项值);
    const label = String(item.显示名 || item.选项值 || value);
    const nextPathValues = [...pathValues, value];
    const nextPathLabels = [...pathLabels, label];
    const children = getChildGroups(optionGroups, gid, value).flatMap(childGroup =>
      buildOptionValueTreeForGroup({
        depth: depth + 1,
        groupId: childGroup.编号,
        optionGroups,
        optionItems,
        pathLabels: nextPathLabels,
        pathValues: nextPathValues,
        visited: nextVisited,
      }),
    );

    return {
      children,
      groupId: gid,
      key: makeTreeKey(nextPathValues),
      label,
      pathLabels: nextPathLabels,
      pathValues: nextPathValues,
      value,
    };
  });
}

export function buildOptionValueTree({ optionGroups = [], optionItems = [], rootGroupId }) {
  return buildOptionValueTreeForGroup({
    groupId: rootGroupId,
    optionGroups,
    optionItems,
  });
}

export function findOptionTreeNodeByPath(nodes = [], pathValues = []) {
  const targetKey = makeTreeKey(pathValues.map(normalizeId).filter(Boolean));
  if (!targetKey)
    return null;

  const stack = [...nodes];
  while (stack.length) {
    const node = stack.shift();
    if (node.key === targetKey)
      return node;
    if (node.children?.length)
      stack.unshift(...node.children);
  }
  return null;
}

export function flattenOptionValueTree(nodes = [], expandedKeys = new Set(), level = 0) {
  const rows = [];
  for (const node of nodes) {
    rows.push({
      ...node,
      expanded: expandedKeys.has(node.key),
      hasChildren: !!node.children?.length,
      level,
    });
    if (node.children?.length && expandedKeys.has(node.key))
      rows.push(...flattenOptionValueTree(node.children, expandedKeys, level + 1));
  }
  return rows;
}

export function getOptionTreeAncestorKeys(pathValues = []) {
  const parts = pathValues.map(normalizeId).filter(Boolean);
  const keys = [];
  for (let i = 1; i < parts.length; i += 1) keys.push(makeTreeKey(parts.slice(0, i)));
  return keys;
}

export function buildCascadeSteps({
  optionGroups = [],
  optionItems = [],
  pathValues = [],
  rootGroupId,
}) {
  const rootId = normalizeId(rootGroupId);
  if (!rootId)
    return [];

  const steps = [];
  const visited = new Set();
  let currentGroupIds = [rootId];
  let pathIndex = 0;

  while (currentGroupIds.length) {
    const levelSteps = [];

    for (const groupId of currentGroupIds) {
      const gid = normalizeId(groupId);
      if (!gid || visited.has(gid))
        continue;
      visited.add(gid);

      const items = toSelectOptions(getEnabledOptionItems(optionItems, gid));
      if (!items.length)
        continue;

      levelSteps.push({
        groupId: gid,
        groupName: getGroupName(optionGroups, gid),
        items,
        selectedValue: normalizeId(pathValues[pathIndex]),
      });
      pathIndex += 1;
    }

    if (!levelSteps.length)
      break;

    steps.push(...levelSteps);

    const nextGroupIds = [];
    for (const step of levelSteps) {
      if (!step.selectedValue)
        continue;
      for (const child of getChildGroups(optionGroups, step.groupId, step.selectedValue)) {
        const childId = normalizeId(child.编号);
        if (childId && !visited.has(childId) && !nextGroupIds.includes(childId))
          nextGroupIds.push(childId);
      }
    }
    currentGroupIds = nextGroupIds;
  }

  return steps;
}

export function getCascadeDefaultValue({ optionGroups = [], optionItems = [], rootGroupId }) {
  const firstStep = buildCascadeSteps({ optionGroups, optionItems, rootGroupId })[0];
  return firstStep?.items?.[0]?.value || "";
}
