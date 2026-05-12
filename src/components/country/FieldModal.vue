<script setup>
import { driver } from "driver.js";
import { reactive, watch } from "vue";
import { useConfigStore } from "@/stores/config";
import "driver.js/dist/driver.css";

const props = defineProps({
  open: Boolean,
  fieldIdx: Number,
  cpId: String,
});
const emit = defineEmits(["close"]);

const store = useConfigStore();
const form = reactive({});
const _CORE_KEYS = ["编号", "国家", "平台", "货币", "货币符号", "汇率", "启用", "排序"];

const fieldEditSteps = [
  {
    popover: {
      title: "字段编辑",
      description:
        "定义计算字段。字段键是唯一标识（中文），用于规则中的条件、公式引用。层级决定该字段在新建商品时的显示位置。",
    },
  },
  {
    element: '[data-tour="field-type"]',
    popover: {
      title: "字段类型",
      description: "下拉=选择框（需关联选项组），布尔=是/否，数字和文本=输入框。",
    },
  },
  {
    element: '[data-tour="field-level"]',
    popover: {
      title: "字段层级",
      description: "商品级=所有SKU共享（如刊登类型），SKU级=每个变体独立（如售价、重量）。",
    },
  },
  {
    element: '[data-tour="field-default"]',
    popover: {
      title: "默认值",
      description: "新建商品时自动填入的值。布尔字段选是/否，下拉字段选选项值，其他字段直接输入。",
    },
  },
];

function startTour(steps) {
  const d = driver({
    showProgress: true,
    animate: true,
    prevBtnText: "上一步",
    nextBtnText: "下一步",
    doneBtnText: "知道了",
    closeBtnText: "✕",
  });
  d.setSteps(steps);
  d.drive();
}

watch(
  () => props.open,
  (v) => {
    if (!v) return;
    if (props.fieldIdx >= 0) {
      const fields = store.getFieldsByCountry(props.cpId);
      Object.assign(form, JSON.parse(JSON.stringify(fields[props.fieldIdx])));
    } else {
      Object.assign(form, {
        字段键: "",
        字段名称: "",
        类型: "数字",
        单位: "",
        选项组编号: "",
        所属国家平台: props.cpId,
        层级: "商品级",
        输入输出: "输入",
        必填: "否",
        默认值: "",
        说明: "",
      });
    }
  },
);

function save() {
  if (props.fieldIdx >= 0) {
    const fields = store.getFieldsByCountry(props.cpId);
    const x = store["计算字段"].indexOf(fields[props.fieldIdx]);
    if (x !== -1) store["计算字段"][x] = { ...form };
  } else {
    store["计算字段"].push({ ...form });
  }
  emit("close");
}

function deleteField() {
  if (props.fieldIdx >= 0) {
    const fields = store.getFieldsByCountry(props.cpId);
    const x = store["计算字段"].indexOf(fields[props.fieldIdx]);
    if (x !== -1) store["计算字段"].splice(x, 1);
  }
  emit("close");
}
</script>

<template>
  <dialog :open="open" class="modal">
    <div class="modal-box max-w-lg">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold">
          {{ fieldIdx >= 0 ? "编辑字段" : "新建字段" }}
        </h3>
        <button class="btn btn-ghost btn-sm btn-circle" @click="startTour(fieldEditSteps)">
          ?
        </button>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="label py-0 text-xs">字段键</label>
          <input v-model="form.字段键" class="input input-bordered input-sm w-full" />
        </div>
        <div>
          <label class="label py-0 text-xs">字段名称</label>
          <input v-model="form.字段名称" class="input input-bordered input-sm w-full" />
        </div>
        <div data-tour="field-type">
          <label class="label py-0 text-xs">类型</label>
          <select v-model="form.类型" class="select select-bordered select-sm w-full">
            <option>数字</option>
            <option>文本</option>
            <option>下拉</option>
            <option>布尔</option>
          </select>
        </div>
        <div data-tour="field-level">
          <label class="label py-0 text-xs">层级</label>
          <select v-model="form.层级" class="select select-bordered select-sm w-full">
            <option>商品级</option>
            <option>SKU级</option>
          </select>
        </div>
        <div>
          <label class="label py-0 text-xs">输入/输出</label>
          <select v-model="form.输入输出" class="select select-bordered select-sm w-full">
            <option>输入</option>
            <option>输出</option>
          </select>
        </div>
        <div>
          <label class="label py-0 text-xs">单位</label>
          <input v-model="form.单位" class="input input-bordered input-sm w-full" />
        </div>
        <div>
          <label class="label py-0 text-xs">选项组编号</label>
          <input v-model="form.选项组编号" class="input input-bordered input-sm w-full" />
        </div>
        <div>
          <label class="label py-0 text-xs">必填</label>
          <select v-model="form.必填" class="select select-bordered select-sm w-full">
            <option>是</option>
            <option>否</option>
          </select>
        </div>
      </div>
      <div class="mt-2" data-tour="field-default">
        <label class="label py-0 text-xs">默认值</label>
        <select
          v-if="form.类型 === '布尔'"
          v-model="form.默认值"
          class="select select-bordered select-sm w-full"
        >
          <option value="">—</option>
          <option>是</option>
          <option>否</option>
        </select>
        <select
          v-else-if="form.类型 === '下拉' && form.选项组编号"
          v-model="form.默认值"
          class="select select-bordered select-sm w-full"
        >
          <option value="">—</option>
          <option
            v-for="item in store.getOptionItemsByGroup(form.选项组编号)"
            :key="item.选项值"
            :value="item.选项值"
          >
            {{ item.显示名 }} ({{ item.选项值 }})
          </option>
        </select>
        <input
          v-else
          v-model="form.默认值"
          class="input input-bordered input-sm w-full"
          placeholder="默认值"
        />
      </div>
      <div class="mt-2">
        <label class="label py-0 text-xs">说明</label>
        <input v-model="form.说明" class="input input-bordered input-sm w-full" />
      </div>
      <div class="modal-action">
        <button v-if="fieldIdx >= 0" class="btn btn-error btn-sm btn-outline" @click="deleteField">
          删除
        </button>
        <button class="btn btn-ghost btn-sm" @click="emit('close')">取消</button>
        <button class="btn btn-primary btn-sm" @click="save">保存</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="emit('close')">
      <button>关闭</button>
    </form>
  </dialog>
</template>
