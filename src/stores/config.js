import dayjs from "dayjs";
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { buildWorkbookBufferInWorker } from "@/services/config-export-worker";
import { readWorkbookBuffer } from "@/services/excel-reader";
import {
  buildCascadeSteps,
  getCascadeDefaultValue,
  getChildOptionItems,
  getRootOptionItems,
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
  const 计算配置 = ref([]);
  const lookupTables = ref({});
  const 国家平台ColOrder = ref([]);
  const 国家平台HiddenCols = ref([]);

  const isRemote = ref(false);
  const remoteUrl = ref("");
  const dirty = ref(false);
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
      restoreDraft();
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
    计算配置.value = config.计算配置 || [];
    lookupTables.value = config.lookupTables || {};
    国家平台ColOrder.value = config.国家平台ColOrder || [];
    国家平台HiddenCols.value = config.国家平台HiddenCols || [];
    sync国家平台ColOrder();
    pruneOrphanConfig();
  }

  async function getExportBuffer() {
    sync国家平台ColOrder();
    pruneOrphanConfig();
    return await buildWorkbookBufferInWorker({
      lookupTables: lookupTables.value,
      国家平台: 国家平台.value,
      国家平台ColOrder: 国家平台ColOrder.value,
      国家平台HiddenCols: 国家平台HiddenCols.value,
      计算字段: 计算字段.value,
      计算配置: 计算配置.value,
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
    const countryIds = new Set(国家平台.value.map(row => normalizeId(row.编号)).filter(Boolean));
    计算字段.value = 计算字段.value.filter(row => countryIds.has(normalizeId(row.所属国家平台)));
    选项配置.value = 选项配置.value.filter(row => countryIds.has(normalizeId(row.所属国家平台)));
    计算配置.value = 计算配置.value.filter(row => countryIds.has(normalizeId(row.所属国家平台)));
  }

  function getCalculationConfigsByCountry(cpId) {
    const countryId = normalizeId(cpId);
    return orderByNumber(
      计算配置.value.filter(row => normalizeId(row.所属国家平台) === countryId && isEnabled({ 启用: row.模板启用 })),
      "排序",
    );
  }

  function getCalculationConfigById(templateId) {
    const id = normalizeId(templateId);
    return 计算配置.value.find(row => normalizeId(row.模板编号) === id);
  }

  function upsertCalculationConfig(row, previousTemplateId = "") {
    const templateId = normalizeId(row.模板编号);
    const previousId = normalizeId(previousTemplateId);
    const idx = 计算配置.value.findIndex(item => normalizeId(item.模板编号) === (previousId || templateId));
    const next = {
      所属国家平台: normalizeId(row.所属国家平台),
      排序: row.排序 || "",
      模板名称: row.模板名称 || templateId,
      模板启用: row.模板启用 || "是",
      模板编号: templateId,
      模板说明: row.模板说明 || "",
      流程JSON: row.流程JSON || "",
    };
    if (idx >= 0)
      计算配置.value[idx] = next;
    else
      计算配置.value.push(next);
    markDirty();
  }

  function deleteCalculationConfig(templateId) {
    const id = normalizeId(templateId);
    计算配置.value = 计算配置.value.filter(row => normalizeId(row.模板编号) !== id);
    markDirty();
  }

  function getLookupNames() {
    return Object.keys(lookupTables.value || {}).filter(Boolean).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  }

  function getFieldsByCountry(cpId) {
    const countryId = normalizeId(cpId);
    return orderByNumber(
      计算字段.value.filter(f => normalizeId(f.所属国家平台) === countryId),
      "排序",
    );
  }

  function getEnabledFieldsByCountry(cpId) {
    return getFieldsByCountry(cpId).filter(field => isEnabled(field));
  }

  function getAllOptionGroupsByCountry(cpId) {
    const countryId = normalizeId(cpId);
    const rootItems = getRootOptionItems(
      选项配置.value.filter(r => normalizeId(r.所属国家平台) === countryId),
    );
    return rootItems.map(r => ({
      名称: r.选项值编号 || r.选项值,
      所属国家平台: r.所属国家平台,
      排序: r.排序,
    }));
  }

  function getOptionGroupsByCountry(cpId) {
    const countryId = normalizeId(cpId);
    const usedRootIds = new Set(
      计算字段.value
        .filter(field => normalizeId(field.所属国家平台) === countryId)
        .map(field => (field.选项组 || "").trim())
        .filter(Boolean),
    );
    const byId = new Map();
    for (const row of 选项配置.value) {
      const nodeId = (row.选项值编号 || "").trim();
      if (!nodeId || !usedRootIds.has(nodeId) || byId.has(nodeId))
        continue;
      byId.set(nodeId, {
        名称: nodeId,
        所属国家平台: row.所属国家平台,
        排序: row.排序 || "",
      });
    }
    return orderByNumber([...byId.values()], "排序");
  }

  function getOptionItemsByGroup(nodeId) {
    return getChildOptionItems(选项配置.value, nodeId);
  }

  function getEnabledOptionItemsByGroup(nodeId) {
    return getChildOptionItems(选项配置.value, nodeId);
  }

  function getChildGroups(nodeId) {
    return getChildOptionItems(选项配置.value, nodeId);
  }

  function groupHasDescendants(nodeId) {
    return hasOptionGroupDescendants(选项配置.value, nodeId);
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
        .filter(g => (g.父级选项值编号 || "").trim() === (parent.选项值编号 || "").trim())
        .map(attachChildren),
    });
    return all.filter(g => !(g.父级选项值编号 || "").trim()).map(attachChildren);
  }

  function getField(fieldKey, cpId) {
    const key = normalizeId(fieldKey);
    const countryId = normalizeId(cpId);
    return 计算字段.value.find(
      f => normalizeId(f.字段键) === key && normalizeId(f.所属国家平台) === countryId,
    );
  }

  function clear() {
    filePath.value = "";
    workbook.value = null;
    isRemote.value = false;
    remoteUrl.value = "";
    国家平台.value = [];
    计算字段.value = [];
    选项配置.value = [];
    计算配置.value = [];
    国家平台ColOrder.value = [];
    国家平台HiddenCols.value = [];
    lookupTables.value = {};
    clearDraft();
  }

  function draftKey() {
    const key = filePath.value || remoteUrl.value || "default";
    return `profit_config_draft:${key}`;
  }

  function snapshotConfig() {
    return {
      lookupTables: JSON.parse(JSON.stringify(lookupTables.value)),
      国家平台: JSON.parse(JSON.stringify(国家平台.value)),
      国家平台ColOrder: [...国家平台ColOrder.value],
      国家平台HiddenCols: [...国家平台HiddenCols.value],
      计算字段: JSON.parse(JSON.stringify(计算字段.value)),
      计算配置: JSON.parse(JSON.stringify(计算配置.value)),
      选项配置: JSON.parse(JSON.stringify(选项配置.value)),
    };
  }

  function persistDraft() {
    const payload = {
      config: snapshotConfig(),
      filePath: filePath.value,
      remoteUrl: remoteUrl.value,
      savedAt: dayjs().valueOf(),
    };
    try {
      localStorage.setItem(draftKey(), JSON.stringify(payload));
    }
    catch {
      // storage full or unavailable
    }
  }

  function markDirty() {
    dirty.value = true;
    persistDraft();
  }

  function clearDirty() {
    dirty.value = false;
  }

  function restoreDraft() {
    try {
      const raw = localStorage.getItem(draftKey());
      if (!raw)
        return false;
      const payload = JSON.parse(raw);
      if (!payload?.config)
        return false;
      applyConfig(payload.config);
      dirty.value = true;
      return true;
    }
    catch {
      return false;
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(draftKey());
    }
    catch {
      // ignore
    }
    dirty.value = false;
  }

  return {
    buildOptionCascade,
    clear,
    clearDirty,
    clearDraft,
    deleteCalculationConfig,
    dirty,
    error,
    filePath,
    getAllOptionGroupsByCountry,
    getCalculationConfigById,
    getCalculationConfigsByCountry,
    getChildGroups,
    getEnabledFieldsByCountry,
    getEnabledOptionItemsByGroup,
    getExportBuffer,
    getField,
    getFieldsByCountry,
    getGroupTree,
    getLookupNames,
    getOptionCascadeDefault,
    getOptionGroupsByCountry,
    getOptionItemsByGroup,
    groupHasDescendants,
    isRemote,
    loaded,
    loadFromBuffer,
    loading,
    lookupTables,
    markDirty,
    pruneOrphanConfig,
    remoteUrl,
    sync国家平台ColOrder,
    upsertCalculationConfig,
    workbook,
    国家平台,
    国家平台ColOrder,
    国家平台HiddenCols,
    计算字段,
    计算配置,
    选项配置,
    setFilePath: (p) => {
      filePath.value = p;
    },
  };
});
