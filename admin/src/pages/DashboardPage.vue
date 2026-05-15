<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import CodeTable from "@/components/CodeTable.vue";
import CreateModal from "@/components/CreateModal.vue";
import DetailModal from "@/components/DetailModal.vue";
import RemarkModal from "@/components/RemarkModal.vue";
import TemplateModal from "@/components/TemplateModal.vue";
import { useAdminStore } from "@/stores/admin";

const router = useRouter();
const store = useAdminStore();
const showCreate = ref(false);
const showDetail = ref(false);
const showRemark = ref(false);
const showTemplate = ref(false);
const remarkTarget = ref({ code: "", remark: "" });

const filters = [
  { label: "全部", value: "all" },
  { label: "已激活", value: "actived" },
  { label: "未使用", value: "inactive" },
];

onMounted(() => {
  store.fetchCodes();
});

function setFilter(val) {
  store.filter = val;
  store.fetchCodes();
}

function handleLogout() {
  store.clearSecret();
  router.push("/login");
}

function openCreate() {
  showCreate.value = true;
}

function openDetail(code) {
  store.doCheck(code);
  showDetail.value = true;
}

function openRemark({ code, remark }) {
  remarkTarget.value = { code, remark };
  showRemark.value = true;
}
</script>

<template>
  <div class="h-full px-4 py-3 flex flex-col gap-3">
    <!-- 顶栏 -->
    <div class="flex items-center justify-between">
      <div class="flex gap-1 items-center">
        <button
          @click="setFilter(f.value)"
          v-for="f in filters"
          :key="f.value"
          class="btn btn-sm"
          :class="store.filter === f.value ? 'btn-primary' : 'btn-ghost'"
        >
          {{ f.label }}
        </button>
      </div>
      <div class="flex gap-1 items-center">
        <button @click="openCreate" class="btn btn-sm btn-primary">
          批量创建
        </button>
        <button @click="showTemplate = true" class="btn btn-sm btn-ghost">
          备注模板
        </button>
        <button @click="store.fetchCodes()" class="btn btn-sm btn-ghost">
          刷新
        </button>
        <button @click="handleLogout" class="btn btn-sm btn-ghost">
          退出
        </button>
      </div>
    </div>

    <!-- API 信息 -->
    <div class="text-xs text-base-content/40">
      {{ store.apiBase }}
    </div>

    <!-- 错误 -->
    <div v-if="store.error" class="alert alert-error">
      <span>{{ store.error }}</span>
    </div>

    <!-- 加载 -->
    <div v-if="store.loading && store.codes.length === 0" class="flex justify-center py-10">
      <span class="loading loading-lg loading-spinner" />
    </div>

    <!-- 表格 -->
    <CodeTable
      v-if="store.codes.length > 0"
      @delete="store.doDelete"
      @detail="openDetail"
      @remark="openRemark"
      :codes="store.codes"
      :loading="store.loading"
    />

    <div v-if="!store.loading && store.codes.length === 0 && !store.error" class="text-center py-10 text-base-content/60">
      暂无激活码
    </div>

    <!-- 创建弹窗 -->
    <CreateModal v-if="showCreate" @close="showCreate = false" />

    <!-- 详情弹窗 -->
    <DetailModal v-if="showDetail" @close="showDetail = false" />

    <!-- 备注弹窗 -->
    <RemarkModal
      v-if="showRemark"
      :code="remarkTarget.code"
      :remark="remarkTarget.remark"
      @close="showRemark = false"
    />

    <!-- 模板弹窗 -->
    <TemplateModal v-if="showTemplate" @close="showTemplate = false" />
  </div>
</template>
