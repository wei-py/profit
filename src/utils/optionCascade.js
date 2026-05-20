import { isEnabled, normalizeId, orderByNumber } from "@/utils/value";

export const CASCADE_SEPARATOR = " > ";

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

// -- legacy compat helpers (used only by config-normalizer for old data migration) --

export function getParentTriggerValue(group) {
  for (const key of ["父级选项值", "父选项值", "父级选项", "父选项"]) {
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

// -- new flat-table helpers --

export function sortOptionConfigs(rows) {
  return orderByNumber(rows, "排序");
}

export function getEnabledOptionItems(optionConfigs, rootGroupId) {
  const gid = normalizeId(rootGroupId);
  if (!gid)
    return [];
  return sortOptionConfigs(
    (optionConfigs || []).filter(
      row => normalizeId(row.选项组编号) === gid && isEnabled(row) && row.选项值,
    ),
  );
}

export function toSelectOptions(items) {
  return items.map(item => ({
    label: item.显示名 || item.选项值,
    value: item.选项值,
  }));
}

export function getChildGroups(optionConfigs, parentNodeId) {
  const pid = normalizeId(parentNodeId);
  if (!pid)
    return [];
  return sortOptionConfigs(
    (optionConfigs || []).filter(row => normalizeId(row.父级) === pid),
  );
}

export function getGroupName(optionConfigs, rootGroupId) {
  const gid = normalizeId(rootGroupId);
  const row = (optionConfigs || []).find(r => normalizeId(r.选项组编号) === gid);
  return row ? row.选项组名称 || row.选项组编号 || gid : gid;
}

export function groupHasDescendants(optionConfigs, rootNodeId) {
  const rootId = normalizeId(rootNodeId);
  if (!rootId)
    return false;

  const seen = new Set([rootId]);
  const queue = [rootId];
  while (queue.length) {
    const parentId = queue.shift();
    const children = getChildGroups(optionConfigs, parentId).filter(
      child => !seen.has(normalizeId(child.编号)),
    );
    if (children.length)
      return true;
    for (const child of children) {
      const childId = normalizeId(child.编号);
      seen.add(childId);
      queue.push(childId);
    }
  }
  return false;
}

function makeTreeKey(pathValues) {
  return pathValues.join("\u001F");
}

function buildOptionValueTreeForNode({
  depth = 0,
  nodeId,
  optionConfigs,
  pathLabels = [],
  pathValues = [],
  visited = new Set(),
}) {
  const nid = normalizeId(nodeId);
  if (!nid || depth > 20 || visited.has(nid))
    return [];

  const nextVisited = new Set(visited);
  nextVisited.add(nid);

  const children = getChildGroups(optionConfigs, nid).flatMap(child =>
    buildOptionValueTreeForNode({
      depth: depth + 1,
      nodeId: child.编号,
      optionConfigs,
      pathLabels: [],
      pathValues: [],
      visited: nextVisited,
    }),
  );

  const node = (optionConfigs || []).find(r => normalizeId(r.编号) === nid && r.选项值);
  if (!node)
    return children;

  const value = normalizeId(node.选项值);
  const label = String(node.显示名 || node.选项值 || value);
  const nextPathValues = [...pathValues, value];
  const nextPathLabels = [...pathLabels, label];

  return [{
    children,
    groupId: normalizeId(node.选项组编号),
    key: makeTreeKey(nextPathValues),
    label,
    pathLabels: nextPathLabels,
    pathValues: nextPathValues,
    value,
  }];
}

function buildOptionValueTreeFromRoot({
  depth = 0,
  optionConfigs,
  rootGroupId,
  visited = new Set(),
}) {
  const gid = normalizeId(rootGroupId);
  if (!gid || depth > 20 || visited.has(gid))
    return [];

  const nextVisited = new Set(visited);
  nextVisited.add(gid);

  const topLevelNodes = sortOptionConfigs(
    (optionConfigs || []).filter(
      row => normalizeId(row.选项组编号) === gid && !normalizeId(row.父级) && isEnabled(row) && row.选项值,
    ),
  );

  return topLevelNodes.flatMap((node) => {
    const value = normalizeId(node.选项值);
    const label = String(node.显示名 || node.选项值 || value);

    const children = getChildGroups(optionConfigs, node.编号).flatMap(child =>
      buildOptionValueTreeForNode({
        depth: depth + 1,
        nodeId: child.编号,
        optionConfigs,
        pathLabels: [label],
        pathValues: [value],
        visited: nextVisited,
      }),
    );

    return [{
      children,
      groupId: gid,
      key: makeTreeKey([value]),
      label,
      pathLabels: [label],
      pathValues: [value],
      value,
    }];
  });
}

export function buildOptionValueTree({ optionConfigs = [], rootGroupId }) {
  return buildOptionValueTreeFromRoot({
    optionConfigs,
    rootGroupId,
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
  optionConfigs = [],
  pathValues = [],
  rootGroupId,
}) {
  const rootId = normalizeId(rootGroupId);
  if (!rootId)
    return [];

  const steps = [];
  const visited = new Set();
  let currentNodeIds = (optionConfigs || [])
    .filter(row => normalizeId(row.选项组编号) === rootId && !normalizeId(row.父级) && isEnabled(row) && row.选项值)
    .map(row => normalizeId(row.编号))
    .filter(Boolean);
  let pathIndex = 0;

  while (currentNodeIds.length) {
    const levelItems = [];

    for (const nodeId of currentNodeIds) {
      if (visited.has(nodeId))
        continue;
      visited.add(nodeId);

      const node = (optionConfigs || []).find(r => normalizeId(r.编号) === nodeId);
      if (!node)
        continue;

      levelItems.push({
        label: node.显示名 || node.选项值,
        value: node.选项值,
      });
    }

    if (!levelItems.length)
      break;

    const groupName = getGroupName(optionConfigs, rootId);
    steps.push({
      groupId: rootId,
      groupName,
      items: levelItems,
      selectedValue: normalizeId(pathValues[pathIndex]),
    });
    pathIndex += 1;

    const nextNodeIds = [];
    for (const step of steps) {
      if (!step.selectedValue)
        continue;
      for (const node of (optionConfigs || [])) {
        if (normalizeId(node.选项值) === step.selectedValue && normalizeId(node.选项组编号) === rootId) {
          const children = getChildGroups(optionConfigs, node.编号);
          for (const child of children) {
            const childId = normalizeId(child.编号);
            if (childId && !visited.has(childId) && !nextNodeIds.includes(childId))
              nextNodeIds.push(childId);
          }
        }
      }
    }
    currentNodeIds = nextNodeIds;
  }

  return steps;
}

export function getCascadeDefaultValue({ optionConfigs = [], rootGroupId }) {
  const firstStep = buildCascadeSteps({ optionConfigs, rootGroupId })[0];
  return firstStep?.items?.[0]?.value || "";
}
