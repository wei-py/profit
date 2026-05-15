<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAdminStore } from "@/stores/admin";

const router = useRouter();
const store = useAdminStore();
const secret = ref(store.secret);
const loading = ref(false);
const error = ref("");

async function handleLogin() {
  const trimmed = secret.value.trim();
  if (!trimmed) {
    error.value = "请输入管理密钥";
    return;
  }

  loading.value = true;
  error.value = "";
  store.setSecret(trimmed);

  const resp = await store.fetchCodes();
  loading.value = false;

  if (store.codes.length > 0 || !store.error) {
    router.push("/");
  }
  else {
    error.value = store.error || "密钥验证失败";
    store.clearSecret();
  }
}
</script>

<template>
  <div class="bg-base-200 flex h-full items-center justify-center">
    <div class="bg-base-100 card max-w-sm shadow-xl w-full">
      <div class="card-body gap-5">
        <div class="text-center">
          <h1 class="font-bold text-2xl">激活码管理</h1>
          <p class="mt-1 text-base-content/60 text-sm">请输入管理密钥以登录</p>
        </div>

        <div v-if="error" class="alert alert-error">
          <span>{{ error }}</span>
        </div>

        <label class="form-control">
          <div class="label">
            <span class="label-text">ADMIN_SECRET</span>
          </div>
          <input
            v-model="secret"
            @keyup.enter="handleLogin"
            class="input input-bordered"
            :disabled="loading"
            placeholder="输入管理密钥"
            type="password"
          >
        </label>

        <button
          @click="handleLogin"
          class="btn btn-primary"
          :disabled="loading"
        >
          <span v-if="loading" class="loading loading-spinner" />
          登录
        </button>
      </div>
    </div>
  </div>
</template>
