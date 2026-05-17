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
  normalizeOptionGroup,
} from "@/utils/optionCascade";
import { isEnabled, normalizeId, orderByNumber } from "@/utils/value";

export const useConfigStore = defineStore("config", () => {
  const filePath = ref("");
  const workbook = ref(null);
  const loading = ref(false);
  const error = ref("");

  const 国家平台 = ref([]);
  const 计算字段 = ref([]);
  const 选项组 = ref([]);
  const 选项值 = ref([]);
  const 计算模板 = ref([]);
  const 费用规则 = ref([]);
  const 模板参数 = ref([]);
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
    选项组.value = (config.选项组 || []).map(normalizeOptionGroup);
    选项值.value = config.选项值 || [];
    计算模板.value = config.计算模板 || [];
    费用规则.value = config.费用规则 || [];
    模板参数.value = config.模板参数 || [];
    lookupTables.value = config.lookupTables || {};
    国家平台ColOrder.value = config.国家平台ColOrder || [];
    国家平台HiddenCols.value = config.国家平台HiddenCols || [];
    sync国家平台ColOrder();
  }

  async function getExportBuffer() {
    sync国家平台ColOrder();
    return await buildWorkbookBuffer({
      lookupTables: lookupTables.value,
      国家平台: 国家平台.value,
      国家平台ColOrder: 国家平台ColOrder.value,
      国家平台HiddenCols: 国家平台HiddenCols.value,
      模板参数: 模板参数.value,
      计算字段: 计算字段.value,
      计算模板: 计算模板.value,
      费用规则: 费用规则.value,
      选项值: 选项值.value,
      选项组: 选项组.value,
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

  function getOptionGroupsByCountry(cpId) {
    const countryId = normalizeId(cpId);
    return 选项组.value.filter(g => normalizeId(g.所属国家平台) === countryId);
  }

  function getOptionItemsByGroup(groupId) {
    const id = normalizeId(groupId);
    return 选项值.value.filter(item => normalizeId(item.所属分组) === id);
  }

  function getEnabledOptionItemsByGroup(groupId) {
    return getEnabledOptionItems(选项值.value, groupId);
  }

  function getChildGroups(groupId, parentOptionValue = "") {
    return getCascadeChildGroups(选项组.value, groupId, parentOptionValue);
  }

  function groupHasDescendants(groupId) {
    return hasOptionGroupDescendants(选项组.value, groupId);
  }

  function buildOptionCascade(groupId, pathValues = []) {
    return buildCascadeSteps({
      optionGroups: 选项组.value,
      optionItems: 选项值.value,
      pathValues,
      rootGroupId: groupId,
    });
  }

  function getOptionCascadeDefault(groupId) {
    return getCascadeDefaultValue({
      optionGroups: 选项组.value,
      optionItems: 选项值.value,
      rootGroupId: groupId,
    });
  }

  function getGroupTree(countryId) {
    const all = orderByNumber(getOptionGroupsByCountry(countryId), "排序");
    const attachChildren = parent => ({
      ...parent,
      children: all
        .filter(g => normalizeId(g.父级编号) === normalizeId(parent.编号))
        .map(attachChildren),
    });
    return all.filter(g => !normalizeId(g.父级编号)).map(attachChildren);
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
    选项组.value = [];
    选项值.value = [];
    计算模板.value = [];
    费用规则.value = [];
    模板参数.value = [];
    国家平台ColOrder.value = [];
    国家平台HiddenCols.value = [];
    lookupTables.value = {};
  }

  return {
    buildOptionCascade,
    clear,
    error,
    filePath,
    getChildGroups,
    getEnabledFieldsByCountry,
    getEnabledOptionItemsByGroup,
    getExportBuffer,
    getFeeRulesByTemplate,
    getField,
    getFieldsByCountry,
    getGroupTree,
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
    remoteUrl,
    sync国家平台ColOrder,
    workbook,
    国家平台,
    国家平台ColOrder,
    国家平台HiddenCols,
    模板参数,
    计算字段,
    计算模板,
    费用规则,
    选项值,
    选项组,
    setFilePath: (p) => {
      filePath.value = p;
    },
  };
});
