import { defineStore } from "pinia";
import { computed, reactive, ref } from "vue";
import { buildProductRows, parseVariantValues } from "@/domain/product-records";
import { execute } from "@/services/rule-engine";
import { normalizeId, nowText } from "@/utils/value";
import { useConfigStore } from "./config";

export const useCreateStore = defineStore("create", () => {
  const configStore = useConfigStore();

  const productId = ref("");
  const productName = ref("");
  const selectedCountryId = ref("");
  const selectedTemplateId = ref("");
  const productInputs = reactive({});

  const variantAttributes = ref([]);
  const skuPrefix = ref("");
  const skus = reactive([]);

  const calculating = ref(false);
  const lastCalculatedAt = ref("");

  const selectedTemplate = computed(() =>
    configStore.计算模板.find(t => normalizeId(t.编号) === normalizeId(selectedTemplateId.value)),
  );

  const currentRules = computed(() => configStore.getFeeRulesByTemplate(selectedTemplateId.value));

  const productFields = computed(() => getFields("商品级", "输入"));
  const skuInputFields = computed(() => getFields("SKU级", "输入"));
  const skuOutputFields = computed(() => getFields("SKU级", "输出"));

  function getFields(level, ioType) {
    if (!selectedCountryId.value)
      return [];
    return configStore
      .getEnabledFieldsByCountry(selectedCountryId.value)
      .filter(field => field.层级 === level && field.输入输出 === ioType);
  }

  function selectCountry(countryId) {
    selectedCountryId.value = countryId;
    selectedTemplateId.value = "";
    resetForm();
  }

  function selectTemplate(templateId) {
    selectedTemplateId.value = templateId;
    resetForTemplate();
  }

  function resetForm() {
    productId.value = "";
    productName.value = "";
    skuPrefix.value = "";
    clearObject(productInputs);
    variantAttributes.value = [];
    skus.splice(0, skus.length);
    calculating.value = false;
    lastCalculatedAt.value = "";
  }

  function resetForTemplate() {
    clearObject(productInputs);
    variantAttributes.value = [];
    skus.splice(0, skus.length);
    calculating.value = false;
    lastCalculatedAt.value = "";
    applyDefaultProductInputs();
  }

  function applyDefaultProductInputs() {
    const paramDefaults = new Map(
      configStore
        .getTemplateParams(selectedTemplateId.value)
        .map(param => [param.字段键, param.默认值]),
    );
    for (const field of productFields.value)
      productInputs[field.字段键] = defaultValueForField(field, paramDefaults.get(field.字段键));
  }

  function defaultValueForField(field, templateDefault = undefined) {
    if (templateDefault !== undefined && templateDefault !== "")
      return templateDefault;
    if (field.默认值)
      return field.默认值;
    if (field.类型 === "下拉" && field.选项组编号)
      return configStore.getOptionCascadeDefault(field.选项组编号);
    return "";
  }

  function makeDefaultSkuInputs() {
    const paramDefaults = new Map(
      configStore
        .getTemplateParams(selectedTemplateId.value)
        .map(param => [param.字段键, param.默认值]),
    );
    const inputs = {};
    for (const field of skuInputFields.value)
      inputs[field.字段键] = defaultValueForField(field, paramDefaults.get(field.字段键));
    return inputs;
  }

  function addVariantAttribute() {
    variantAttributes.value = [...variantAttributes.value, { name: "", values: "" }];
  }

  function updateVariantAttribute(index, attr) {
    const arr = [...variantAttributes.value];
    arr[index] = { ...arr[index], ...attr };
    variantAttributes.value = arr;
  }

  function removeVariantAttribute(index) {
    variantAttributes.value = variantAttributes.value.filter((_, i) => i !== index);
  }

  function generateSkus() {
    const attrs = variantAttributes.value
      .filter(attr => normalizeId(attr.name) && normalizeId(attr.values))
      .map(attr => ({
        name: normalizeId(attr.name),
        values: parseVariantValues(attr.values),
      }))
      .filter(attr => attr.values.length);

    if (!attrs.length) {
      skus.splice(
        0,
        skus.length,
        makeSkuRow({
          attrs: {},
          index: 0,
          key: productName.value || "默认",
          oldInputs: skus[0]?.inputs,
          parts: [],
        }),
      );
      return;
    }

    const oldInputsByKey = new Map(skus.map(sku => [sku.key, { ...(sku.inputs || {}) }]));
    const combos = attrs.reduce(
      (rows, attr) =>
        rows.flatMap(row => attr.values.map(value => ({ ...row, [attr.name]: value }))),
      [{}],
    );

    const rows = combos.map((combo, index) => {
      const parts = attrs.map(attr => combo[attr.name]);
      const key = parts.join(",");
      return makeSkuRow({
        attrs: combo,
        index,
        key,
        oldInputs: oldInputsByKey.get(key),
        parts,
      });
    });
    skus.splice(0, skus.length, ...rows);
  }

  function makeSkuRow({ attrs, index, key, oldInputs, parts }) {
    const num = String(index + 1).padStart(3, "0");
    const suffix = parts.length ? `-${parts.join("-")}` : "";
    return {
      attrs,
      error: "",
      images: "",
      inputs: oldInputs || makeDefaultSkuInputs(),
      key,
      results: {},
      skuCode: skuPrefix.value ? `${skuPrefix.value}${num}${suffix}` : `${num}${suffix}`,
      traces: {},
    };
  }

  function updateSkuInput(skuIndex, fieldKey, value) {
    if (skus[skuIndex])
      skus[skuIndex].inputs[fieldKey] = value;
  }

  function updateSkuField(skuIndex, field, value) {
    if (!skus[skuIndex])
      return;
    if (field === "sku")
      skus[skuIndex].skuCode = value;
    else if (field === "images")
      skus[skuIndex].images = value;
    else updateSkuInput(skuIndex, field, value);
  }

  function calculateAll() {
    calculating.value = true;
    if (!skus.length)
      generateSkus();

    for (const sku of skus) {
      try {
        const inputs = {
          ...productInputs,
          ...(sku.inputs || {}),
        };
        const { errors, results, traces } = execute(
          currentRules.value,
          configStore.lookupTables,
          inputs,
        );
        sku.results = results;
        sku.traces = traces;
        sku.error = errors.length ? errors.join("; ") : "";
      }
      catch (error) {
        sku.error = error.message;
        sku.results = {};
        sku.traces = {};
      }
    }

    calculating.value = false;
    lastCalculatedAt.value = nowText();
  }

  function productRows() {
    return buildProductRows({
      calculatedAt: lastCalculatedAt.value,
      productId: productId.value,
      productInputs,
      productName: productName.value,
      selectedCountryId: selectedCountryId.value,
      selectedTemplateId: selectedTemplateId.value,
      skus,
    });
  }

  function reset() {
    selectedCountryId.value = "";
    selectedTemplateId.value = "";
    resetForm();
  }

  function clearObject(target) {
    for (const key of Object.keys(target)) delete target[key];
  }

  return {
    addVariantAttribute,
    calculateAll,
    calculating,
    currentRules,
    generateSkus,
    lastCalculatedAt,
    makeDefaultSkuInputs,
    productFields,
    productId,
    productInputs,
    productName,
    productRows,
    removeVariantAttribute,
    reset,
    resetForm,
    resetForTemplate,
    selectCountry,
    selectedCountryId,
    selectedTemplate,
    selectedTemplateId,
    selectTemplate,
    skuInputFields,
    skuOutputFields,
    skuPrefix,
    skus,
    updateSkuField,
    updateSkuInput,
    updateVariantAttribute,
    variantAttributes,
  };
});
