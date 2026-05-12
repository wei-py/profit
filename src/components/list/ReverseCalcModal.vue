<script setup>
import { ref, watch } from "vue";
import { execute } from "@/services/rule-engine";
import { useConfigStore } from "@/stores/config";
import { useCreateStore } from "@/stores/create";

const props = defineProps({
  open: Boolean,
  skuIndex: Number,
});
const emit = defineEmits(["apply", "close"]);

const configStore = useConfigStore();
const createStore = useCreateStore();
const calcPrice = ref("");
const calcProfit = ref("");
const calcMargin = ref("");

watch(
  [() => props.open, () => props.skuIndex],
  ([openVal, skuIdx]) => {
    if (!openVal || skuIdx < 0)
      return;
    const sku = createStore.skus[skuIdx];
    if (!sku)
      return;
    const price = Number.parseFloat(sku.inputs["售价"]) || 0;
    const pf = sku.results["净利润"] !== undefined ? Number.parseFloat(sku.results["净利润"]) : 0;
    calcPrice.value = price || "";
    calcProfit.value = pf || "";
    calcMargin.value
      = sku.results["利润率"] !== undefined
        ? (Number.parseFloat(sku.results["利润率"]) * 100).toFixed(2)
        : "";
  },
  { immediate: false },
);

function runEngine(price) {
  if (props.skuIndex < 0) {
    return {
      margin: 0,
      profit: 0,
    };
  }
  const sku = createStore.skus[props.skuIndex];
  if (!sku || !createStore.currentRules.length) {
    return {
      margin: 0,
      profit: 0,
    };
  }
  const tables = configStore.lookupTables;
  const cost = Number.parseFloat(sku.inputs["成本价"]) || 0;
  const weight = Number.parseFloat(sku.inputs["重量"]) || 0;
  const inputs = {
    ...createStore.productInputs,
    ...sku.inputs,
    售价: String(price),
    成本价: String(cost),
    重量: String(weight),
  };
  const { results } = execute(createStore.currentRules, tables, inputs);
  return {
    margin: results["利润率"] || 0,
    profit: results["净利润"] || 0,
  };
}

function recalc(field, event) {
  const raw = Number.parseFloat(event.target.value) || 0;
  if (props.skuIndex < 0)
    return;
  const sku = createStore.skus[props.skuIndex];
  if (!sku || !createStore.currentRules.length)
    return;
  const cost = Number.parseFloat(sku.inputs["成本价"]) || 0;

  if (field === "price") {
    if (raw <= 0)
      return;
    const r = runEngine(raw);
    calcProfit.value = r.profit.toFixed(2);
    calcMargin.value = (r.margin * 100).toFixed(2);
  }
  else if (field === "profit") {
    const target = raw;
    if (target <= 0)
      return;
    let lo = cost + 1;
    let hi = cost * 20;
    if (hi <= lo)
      hi = lo + 100;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      const r = runEngine(mid);
      if (r.profit < target)
        lo = mid;
      else hi = mid;
    }
    const best = (lo + hi) / 2;
    const r = runEngine(best);
    calcPrice.value = best.toFixed(2);
    calcMargin.value = (r.margin * 100).toFixed(2);
  }
  else if (field === "margin") {
    const targetPct = raw;
    if (targetPct <= 0)
      return;
    let lo = cost + 1;
    let hi = cost * 20;
    if (hi <= lo)
      hi = lo + 100;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      const r = runEngine(mid);
      if (r.margin * 100 < targetPct)
        lo = mid;
      else hi = mid;
    }
    const best = (lo + hi) / 2;
    const r = runEngine(best);
    calcPrice.value = best.toFixed(2);
    calcProfit.value = r.profit.toFixed(2);
  }
}

function applyCalc() {
  if (calcPrice.value) {
    const si = props.skuIndex;
    if (si >= 0 && createStore.skus[si])
      createStore.skus[si].inputs["售价"] = calcPrice.value;
  }
  emit("close");
}
</script>

<template>
  <dialog class="modal" :open="open">
    <div class="max-w-sm modal-box">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg">反推计算</h3>
        <button @click="emit('close')" class="btn btn-circle btn-ghost btn-sm">✕</button>
      </div>
      <div class="mb-3 text-base-content/50 text-xs">
        修改任意一个目标值，用当前费用率估算另两个（保存后点"计算"得精确值）
      </div>
      <div class="space-y-3">
        <div class="form-control">
          <label class="label py-1"><span class="font-semibold label-text">售价</span>
            <span class="label-text-alt">R$</span></label>
          <input
            v-model="calcPrice"
            @input="(e) => recalc('price', e)"
            class="input input-bordered input-sm"
            step="any"
            type="number"
          >
        </div>
        <div class="form-control">
          <label class="label py-1"><span class="font-semibold label-text">净利润</span>
            <span class="label-text-alt">R$</span></label>
          <input
            v-model="calcProfit"
            @input="(e) => recalc('profit', e)"
            class="input input-bordered input-sm"
            step="any"
            type="number"
          >
        </div>
        <div class="form-control">
          <label class="label py-1"><span class="font-semibold label-text">利润率</span>
            <span class="label-text-alt">%</span></label>
          <input
            v-model="calcMargin"
            @input="(e) => recalc('margin', e)"
            class="input input-bordered input-sm"
            step="any"
            type="number"
          >
        </div>
      </div>
      <div class="modal-action">
        <button @click="emit('close')" class="btn btn-ghost btn-sm">取消</button>
        <button @click="applyCalc" class="btn btn-primary btn-sm">应用售价到 SKU</button>
      </div>
    </div>
    <form @click="emit('close')" class="modal-backdrop" method="dialog">
      <button>关闭</button>
    </form>
  </dialog>
</template>
