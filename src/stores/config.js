import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { readWorkbookBuffer } from "@/services/excel-reader";
import { buildWorkbookBuffer } from "@/services/excel-writer";
import {
  buildCascadeSteps,
  getChildGroups as getCascadeChildGroups,
  getCascadeDefaultValue,
  getEnabledOptionItems,
  groupHasDescendants as hasOptionGroupDescendants,
} from "@/utils/optionCascade";
import { isEnabled, normalizeId, orderByNumber } from "@/utils/value";

export const useConfigStore = defineStore("config", () => {
  const filePath = ref("");
  const workbook = ref(null);
  const loading = ref(false);
  const error = ref("");

  const 国家平台 = ref([]);
  const 计算字段 = ref([]);
  const 选项配置 = ref([]);
  const 计算模板 = ref([]);
  const 费用规则 = ref([]);
  const 模板参数 = ref([]);
  const 查表配置 = ref([]);
  const lookupTables = ref({});
  const 国家平台ColOrder = ref([]);
  const 国家平台HiddenCols = ref([]);

  const isRemote = ref(false);
  const remoteUrl = ref("");

  const loaded = computed(() => 国家平台.value.length > 0);

  async function loadFromBuffer(buffer, p, opts = {}) {
    loading.value = true;
    error.value = "";
    if (p)
      filePath.value = p;
    isRemote.value = !!opts.remote;
    if (opts.remoteUrl)
      remoteUrl.value = opts.remoteUrl;

    try {
      const config = readWorkbookBuffer(buffer);
      applyConfig(config);
      workbook.value = buffer;
    }
    catch (e) {
      error.value = e.message;
      throw e;
    }
    finally {
      loading.value = false;
    }
  }

  function applyConfig(config) {
    国家平台.value = config.国家平台 || [];
    计算字段.value = config.计算字段 || [];
    选项配置.value = config.选项配置 || [];
    计算模板.value = config.计算模板 || [];
    费用规则.value = config.费用规则 || [];
    模板参数.value = config.模板参数 || [];
    查表配置.value = config.查表配置 || [];
    lookupTables.value = config.lookupTables || {};
    国家平台ColOrder.value = config.国家平台ColOrder || [];
    国家平台HiddenCols.value = config.国家平台HiddenCols || [];
    sync国家平台ColOrder();
    pruneOrphanConfig();
  }

  async function getExportBuffer() {
    sync国家平台ColOrder();
    pruneOrphanConfig();
    return await buildWorkbookBuffer({
      lookupTables: lookupTables.value,
      国家平台: 国家平台.value,
      国家平台ColOrder: 国家平台ColOrder.value,
      国家平台HiddenCols: 国家平台HiddenCols.value,
      查表配置: 查表配置.value,
      模板参数: 模板参数.value,
      计算字段: 计算字段.value,
      计算模板: 计算模板.value,
      费用规则: 费用规则.value,
      选项配置: 选项配置.value,
    });
  }

  function sync国家平台ColOrder() {
    if (!国家平台.value.length) {
      国家平台ColOrder.value = [];
      国家平台HiddenCols.value = [];
      return;
    }

    const allKeys = new Set();
    for (const row of 国家平台.value) {
      for (const key of Object.keys(row || {})) {
        if (key)
          allKeys.add(key);
      }
    }

    const existing = new Set(国家平台ColOrder.value);
    const merged = 国家平台ColOrder.value.filter(key => allKeys.has(key));
    for (const key of allKeys) {
      if (!existing.has(key))
        merged.push(key);
    }
    国家平台ColOrder.value = merged;
    国家平台HiddenCols.value = 国家平台HiddenCols.value.filter(key => allKeys.has(key));
  }

  function pruneOrphanConfig() {
    const countryIds = new Set(
      国家平台.value
        .map(row => normalizeId(row.编号))
        .filter(Boolean),
    );

    计算字段.value = 计算字段.value.filter(row => countryIds.has(normalizeId(row.所属国家平台)));
    选项配置.value = 选项配置.value.filter(row => countryIds.has(normalizeId(row.所属国家平台)));

    const keepTemplateIds = new Set(
      计算模板.value
        .filter(row => countryIds.has(normalizeId(row.所属国家平台)))
        .map(row => normalizeId(row.编号))
        .filter(Boolean),
    );
    计算模板.value = 计算模板.value.filter(row => keepTemplateIds.has(normalizeId(row.编号)));

    const removedRules = 费用规则.value.filter(
      row => !keepTemplateIds.has(normalizeId(row.所属模板)),
    );
    const removedLookupNames = new Set(
      removedRules
        .map(row => String(row.查表名称 || "").trim())
        .filter(Boolean),
    );

    费用规则.value = 费用规则.value.filter(row => keepTemplateIds.has(normalizeId(row.所属模板)));
    模板参数.value = 模板参数.value.filter(row => keepTemplateIds.has(normalizeId(row.模板编号)));
    const removedLookupConfigNames = new Set(
      查表配置.value
        .filter(row => normalizeId(row.所属模板) && !keepTemplateIds.has(normalizeId(row.所属模板)))
        .map(row => String(row.表名 || "").trim())
        .filter(Boolean),
    );
    查表配置.value = 查表配置.value.filter(
      row => !normalizeId(row.所属模板) || keepTemplateIds.has(normalizeId(row.所属模板)),
    );
    const lookupConfigNames = new Set(
      查表配置.value
        .map(row => String(row.表名 || "").trim())
        .filter(Boolean),
    );

    const remainingLookupNames = new Set(
      费用规则.value
        .map(row => String(row.查表名称 || "").trim())
        .filter(Boolean),
    );
    const nextLookupTables = { ...lookupTables.value };
    for (const name of removedLookupConfigNames) {
      if (!remainingLookupNames.has(name) && !lookupConfigNames.has(name))
        delete nextLookupTables[name];
    }
    for (const name of removedLookupNames) {
      if (!remainingLookupNames.has(name) && !lookupConfigNames.has(name))
        delete nextLookupTables[name];
    }
    lookupTables.value = nextLookupTables;
    syncLookupConfigs();
  }

  function syncLookupConfigs() {
    const byName = new Map();
    for (const row of 查表配置.value || []) {
      const name = String(row.表名 || "").trim();
      if (!name || byName.has(name))
        continue;
      byName.set(name, {
        ...row,
        启用: isEnabled(row) ? "是" : "否",
        所属模板: normalizeId(row.所属模板),
        表名: name,
      });
    }

    for (const name of Object.keys(lookupTables.value || {})) {
      if (!name || byName.has(name))
        continue;
      byName.set(name, {
        启用: "是",
        所属模板: findLookupTemplateId(name),
        表名: name,
        说明: "",
      });
    }

    for (const rule of 费用规则.value || []) {
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

    查表配置.value = [...byName.values()];
  }

  function findLookupTemplateId(name) {
    const rule = 费用规则.value.find(row => String(row.查表名称 || "").trim() === name);
    return normalizeId(rule?.所属模板);
  }

  function getLookupNames() {
    syncLookupConfigs();
    return 查表配置.value
      .filter(row => isEnabled(row))
      .map(row => String(row.表名 || "").trim())
      .filter(Boolean);
  }

  function getLookupConfigsByTemplate(templateId) {
    syncLookupConfigs();
    const id = normalizeId(templateId);
    return 查表配置.value.filter((row) => {
      const rowTemplateId = normalizeId(row.所属模板);
      return !id || !rowTemplateId || rowTemplateId === id;
    });
  }

  function upsertLookupConfig(name, patch = {}) {
    const tableName = String(name || "").trim();
    if (!tableName)
      return;
    const idx = 查表配置.value.findIndex(row => String(row.表名 || "").trim() === tableName);
    const next = {
      启用: "是",
      所属模板: "",
      说明: "",
      ...(idx >= 0 ? 查表配置.value[idx] : {}),
      ...patch,
      表名: tableName,
    };
    if (idx >= 0)
      查表配置.value[idx] = next;
    else
      查表配置.value.push(next);
  }

  function renameLookupConfig(oldName, newName) {
    const from = String(oldName || "").trim();
    const to = String(newName || "").trim();
    if (!from || !to)
      return;
    const idx = 查表配置.value.findIndex(row => String(row.表名 || "").trim() === from);
    if (idx >= 0)
      查表配置.value[idx] = { ...查表配置.value[idx], 表名: to };
    else
      upsertLookupConfig(to);
  }

  function removeLookupConfig(name) {
    const tableName = String(name || "").trim();
    查表配置.value = 查表配置.value.filter(row => String(row.表名 || "").trim() !== tableName);
  }

  function getTemplatesByCountry(cpId) {
    const countryId = normalizeId(cpId);
    return orderByNumber(
      计算模板.value.filter(t => normalizeId(t.所属国家平台) === countryId && isEnabled(t)),
      "排序",
    );
  }

  function getFeeRulesByTemplate(templateId) {
    const id = normalizeId(templateId);
    return orderByNumber(
      费用规则.value.filter(r => normalizeId(r.所属模板) === id),
      "计算顺序",
    );
  }

  function getFieldsByCountry(cpId) {
    const countryId = normalizeId(cpId);
    return 计算字段.value.filter(f => normalizeId(f.所属国家平台) === countryId);
  }

  function getEnabledFieldsByCountry(cpId) {
    return getFieldsByCountry(cpId).filter(field => isEnabled(field));
  }

  function getAllOptionGroupIdsByCountry(cpId) {
    const countryId = normalizeId(cpId);
    const seen = new Set();
    return 选项配置.value
      .filter(row => normalizeId(row.所属国家平台) === countryId && row.选项组编号 && row.选项值 && !seen.has(row.选项组编号) && seen.add(row.选项组编号))
      .map(row => ({
        名称: row.选项组名称 || row.选项组编号,
        所属国家平台: row.所属国家平台,
        排序: row.排序,
        编号: row.选项组编号,
      }));
  }

  function getOptionGroupsByCountry(cpId) {
    const countryId = normalizeId(cpId);

    const usedGroupIds = new Set(
      计算字段.value
        .filter(field => normalizeId(field.所属国家平台) === countryId)
        .map(field => normalizeId(field.选项组编号))
        .filter(Boolean),
    );

    const byGroupId = new Map();
    for (const row of 选项配置.value) {
      const gid = normalizeId(row.选项组编号);
      if (!gid || !usedGroupIds.has(gid) || byGroupId.has(gid))
        continue;
      byGroupId.set(gid, {
        名称: row.选项组名称 || gid,
        所属国家平台: row.所属国家平台,
        排序: row.排序 || "",
        编号: gid,
      });
    }

    return orderByNumber([...byGroupId.values()], "排序");
  }

  function getOptionItemsByGroup(groupId) {
    const id = normalizeId(groupId);
    return 选项配置.value.filter(
      item => normalizeId(item.选项组编号) === id && !item.父级,
    );
  }

  function getEnabledOptionItemsByGroup(groupId) {
    return getEnabledOptionItems(选项配置.value, groupId);
  }

  function getChildGroups(groupId, parentOptionValue = "") {
    return getCascadeChildGroups(选项配置.value, groupId, parentOptionValue);
  }

  function groupHasDescendants(groupId) {
    return hasOptionGroupDescendants(选项配置.value, groupId);
  }

  function buildOptionCascade(groupId, pathValues = []) {
    return buildCascadeSteps({
      optionConfigs: 选项配置.value,
      pathValues,
      rootGroupId: groupId,
    });
  }

  function getOptionCascadeDefault(groupId) {
    return getCascadeDefaultValue({
      optionConfigs: 选项配置.value,
      rootGroupId: groupId,
    });
  }

  function getGroupTree(countryId) {
    const all = orderByNumber(选项配置.value.filter(row => normalizeId(row.所属国家平台) === normalizeId(countryId)), "排序");
    const attachChildren = parent => ({
      ...parent,
      children: all
        .filter(g => normalizeId(g.父级) === normalizeId(parent.编号))
        .map(attachChildren),
    });
    return all.filter(g => !normalizeId(g.父级)).map(attachChildren);
  }

  function getField(fieldKey, cpId) {
    const key = normalizeId(fieldKey);
    const countryId = normalizeId(cpId);
    return 计算字段.value.find(
      f => normalizeId(f.字段键) === key && normalizeId(f.所属国家平台) === countryId,
    );
  }

  function getTemplateParams(templateId) {
    const id = normalizeId(templateId);
    return 模板参数.value.filter(param => normalizeId(param.模板编号) === id);
  }

  function clear() {
    filePath.value = "";
    workbook.value = null;
    isRemote.value = false;
    remoteUrl.value = "";
    国家平台.value = [];
    计算字段.value = [];
    选项配置.value = [];
    计算模板.value = [];
    费用规则.value = [];
    模板参数.value = [];
    查表配置.value = [];
    国家平台ColOrder.value = [];
    国家平台HiddenCols.value = [];
    lookupTables.value = {};
  }

  return {
    buildOptionCascade,
    clear,
    error,
    filePath,
    getAllOptionGroupIdsByCountry,
    getChildGroups,
    getEnabledFieldsByCountry,
    getEnabledOptionItemsByGroup,
    getExportBuffer,
    getFeeRulesByTemplate,
    getField,
    getFieldsByCountry,
    getGroupTree,
    getLookupConfigsByTemplate,
    getLookupNames,
    getOptionCascadeDefault,
    getOptionGroupsByCountry,
    getOptionItemsByGroup,
    getTemplateParams,
    getTemplatesByCountry,
    groupHasDescendants,
    isRemote,
    loaded,
    loadFromBuffer,
    loading,
    lookupTables,
    pruneOrphanConfig,
    remoteUrl,
    removeLookupConfig,
    renameLookupConfig,
    syncLookupConfigs,
    sync国家平台ColOrder,
    upsertLookupConfig,
    workbook,
    国家平台,
    国家平台ColOrder,
    国家平台HiddenCols,
    查表配置,
    模板参数,
    计算字段,
    计算模板,
    费用规则,
    选项配置,
    setFilePath: (p) => {
      filePath.value = p;
    },
  };
});
