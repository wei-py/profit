<script setup>
import { driver } from "driver.js";
import { computed, reactive, ref, watch } from "vue";
import OptionTreeSelect from "@/components/common/OptionTreeSelect.vue";
import { useModalEsc } from "@/composables/useModalEsc";
import { useConfigStore } from "@/stores/config";
import { normalizeId } from "@/utils/value";

import "driver.js/dist/driver.css";

const props = defineProps({
  cpId: String,
  fieldIdx: Number,
  open: Boolean,
});
const emit = defineEmits(["close"]);
useModalEsc(
  () => props.open,
  () => emit("close"),
);

const store = useConfigStore();
const form = reactive({});
const showTreeDefaultPicker = ref(false);

const fieldEditSteps = [
  {
    element: "[data-tour=\"field-edit-modal\"]",
    popover: {
      description:
        "定义计算字段。字段键是唯一标识（中文），用于规则中的条件、公式引用。层级决定该字段在新建商品时的显示位置。",
      title: "字段编辑",
    },
  },
  {
    element: "[data-tour=\"field-type\"]",
    popover: {
      description: "下拉字段会直接使用选项树，默认值也在树上选择，不再手填选项编号。",
      title: "字段类型",
    },
  },
  {
    element: "[data-tour=\"field-default\"]",
    popover: {
      description: "默认值可以停在任意层级，也可以继续选择子级。",
      title: "默认值",
    },
  },
];

function startTour(steps) {
  const d = driver({
    animate: true,
    closeBtnText: "✕",
    doneBtnText: "知道了",
    nextBtnText: "下一步",
    prevBtnText: "上一步",
    showProgress: true,
  });
  d.setSteps(steps);
  d.drive();
}

watch(
  () => props.open,
  (v) => {
    if (!v)
      return;
    showTreeDefaultPicker.value = false;
    for (const key of Object.keys(form)) delete form[key];
    if (props.fieldIdx >= 0) {
      const fields = store.getFieldsByCountry(props.cpId);
      Object.assign(form, JSON.parse(JSON.stringify(fields[props.fieldIdx])));
    }
    else {
      Object.assign(form, {
        单位: "",
        字段名称: "",
        层级: "商品级",
        必填: "否",
        所属国家平台: props.cpId,
        类型: "数字",
        说明: "",
        输入输出: "输入",
        选项组: "",
        默认值: "",
      });
    }
  },
);

const isDropdownField = computed(() => form.类型 === "下拉");

const rootGroupOptions = computed(() =>
  store
    .getAllOptionGroupsByCountry(props.cpId)
    .sort((a, b) => String(a.名称 || "").localeCompare(String(b.名称 || ""), "zh-Hans-CN"))
    .map(group => ({
      label: group.名称,
      value: group.名称,
    })),
);

const fieldTypeOptions = ["数字", "文本", "下拉", "布尔"];
const fieldLevelOptions = ["平台级", "商品级", "SKU级"];
const inputOutputOptions = ["输入", "输出"];
const yesNoOptions = ["是", "否"];

const canUseTreeDefault = computed(
  () =>
    isDropdownField.value
    && form.选项组
    && store["选项配置"].length > 0,
);

function selectOptionGroup(groupName) {
  if (form.选项组 !== groupName) {
    form.选项组 = groupName;
    form.默认值 = "";
  }
}

function save() {
  if (!isDropdownField.value) {
    form.选项组 = "";
  }

  form.字段键 = normalizeId(form.字段名称);

  if (props.fieldIdx >= 0) {
    const fields = store.getFieldsByCountry(props.cpId);
    const x = store["计算字段"].indexOf(fields[props.fieldIdx]);
    if (x !== -1) {
      store["计算字段"][x] = { ...form };
      store.markDirty();
    }
  }
  else {
    store["计算字段"].push({ ...form });
    store.markDirty();
  }
  emit("close");
}

function deleteField() {
  if (props.fieldIdx >= 0) {
    const fields = store.getFieldsByCountry(props.cpId);
    const x = store["计算字段"].indexOf(fields[props.fieldIdx]);
    if (x !== -1) {
      store["计算字段"].splice(x, 1);
      store.markDirty();
    }
  }
  emit("close");
}
</script>

<template>
  <dialog @cancel.prevent class="modal" :open="open">
    <div class="modal-box w-[min(32rem,calc(100vw-1rem))] max-w-none" data-tour="field-edit-modal">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg">
          {{ fieldIdx >= 0 ? "编辑字段" : "新建字段" }}
        </h3>
        <button @click="startTour(fieldEditSteps)" class="btn btn-circle btn-ghost btn-sm">
          ?
        </button>
      </div>

      <div class="gap-3 grid grid-cols-1 sm:grid-cols-2">
        <div>
          <label class="label py-0 text-xs">字段名称</label>
          <input v-model="form.字段名称" class="input input-bordered input-sm w-full">
        </div>
        <div data-tour="field-type">
          <label class="label py-0 text-xs">类型</label>
          <OptionTreeSelect
            v-model="form.类型"
            :options="fieldTypeOptions"
            placeholder="—"
            size="sm"
          />
        </div>
        <div>
          <label class="label py-0 text-xs">层级</label>
          <OptionTreeSelect
            v-model="form.层级"
            :options="fieldLevelOptions"
            placeholder="—"
            size="sm"
          />
        </div>
        <div>
          <label class="label py-0 text-xs">输入/输出</label>
          <OptionTreeSelect
            v-model="form.输入输出"
            :options="inputOutputOptions"
            placeholder="—"
            size="sm"
          />
        </div>
        <div>
          <label class="label py-0 text-xs">单位</label>
          <input v-model="form.单位" class="input input-bordered input-sm w-full">
        </div>
        <div>
          <label class="label py-0 text-xs">必填</label>
          <OptionTreeSelect
            v-model="form.必填"
            :options="yesNoOptions"
            placeholder="—"
            size="sm"
          />
        </div>
      </div>

      <div v-if="isDropdownField" class="mt-3">
        <label class="label py-0 text-xs">选项来源</label>
        <OptionTreeSelect
          @update:model-value="selectOptionGroup"
          :modelValue="form.选项组"
          :options="rootGroupOptions"
          placeholder="选择选项来源"
          size="sm"
        />
      </div>

      <div class="mt-3" data-tour="field-default">
        <label class="label py-0 text-xs">默认值</label>
        <OptionTreeSelect
          v-if="form.类型 === '布尔'"
          v-model="form.默认值"
          :options="yesNoOptions"
          placeholder="—"
          size="sm"
        />
        <OptionTreeSelect
          v-else-if="canUseTreeDefault && showTreeDefaultPicker"
          @update:model-value="form.默认值 = $event"
          :modelValue="form.默认值"
          :optionConfigs="store['选项配置']"
          placeholder="选择默认值"
          :rootGroupId="form.选项组"
          size="sm"
        />
        <button
          v-else-if="canUseTreeDefault && !showTreeDefaultPicker"
          @click="showTreeDefaultPicker = true"
          class="btn btn-outline btn-sm w-full"
          type="button"
        >
          选择默认值
        </button>
        <div
          v-else-if="isDropdownField"
          class="border border-dashed border-base-300 px-3 py-2 text-sm opacity-60"
        >
          先选择选项来源
        </div>
        <input
          v-else
          v-model="form.默认值"
          class="input input-bordered input-sm w-full"
          placeholder="默认值"
        >
      </div>

      <div class="mt-2">
        <label class="label py-0 text-xs">说明</label>
        <input v-model="form.说明" class="input input-bordered input-sm w-full">
      </div>
      <div class="modal-action">
        <button v-if="fieldIdx >= 0" @click="deleteField" class="btn btn-error btn-outline btn-sm">
          删除
        </button>
        <button @click="emit('close')" class="btn btn-ghost btn-sm">取消</button>
        <button @click="save" class="btn btn-primary btn-sm">保存</button>
      </div>
    </div>
    <form @click="emit('close')" class="modal-backdrop" method="dialog">
      <button>关闭</button>
    </form>
  </dialog>
</template>
