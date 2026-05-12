<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useActivationStore } from '@/stores/activation'

const router = useRouter()
const store = useActivationStore()
const code = ref('')
const loading = ref(false)

async function handleActivate() {
  const trimmed = code.value.trim()
  if (!trimmed) {
    store.error = '请输入激活码'
    return
  }
  if (trimmed.length < 8) {
    store.error = '激活码格式无效'
    return
  }

  loading.value = true
  store.error = ''

  const result = await store.activate(trimmed)

  loading.value = false
  if (result.success) {
    // 激活成功，跳转主页面
    router.push('/')
  }
}
</script>

<template>
  <div class="flex items-center justify-center h-screen bg-base-200">
    <div class="card bg-base-100 shadow-xl w-full max-w-sm">
      <div class="card-body gap-5">
        <div class="text-center">
          <h1 class="text-2xl font-bold">
            Profit
          </h1>
          <p class="text-sm text-base-content/60 mt-1">
            请输入激活码以继续使用
          </p>
        </div>

        <!-- 已过期 -->
        <div v-if="store.status === 'expired'" class="alert alert-warning">
          <span>{{ store.error || "激活码已失效，请联系管理员" }}</span>
        </div>

        <!-- 错误提示 -->
        <div v-if="store.error && store.status !== 'expired'" class="alert alert-error">
          <span>{{ store.error }}</span>
        </div>

        <!-- 加载中 -->
        <div v-if="store.status === 'checking'" class="flex justify-center">
          <span class="loading loading-spinner loading-md" />
        </div>

        <!-- 输入框 -->
        <label v-if="store.status !== 'checking'" class="form-control">
          <div class="label">
            <span class="label-text">激活码</span>
          </div>
          <input
            v-model="code"
            type="text"
            placeholder="PFT-XXXX-XXXX"
            class="input input-bordered"
            :disabled="loading"
            @keyup.enter="handleActivate"
          >
        </label>

        <button
          class="btn btn-primary"
          :disabled="loading || store.status === 'checking'"
          @click="handleActivate"
        >
          激活
        </button>
      </div>
    </div>
  </div>
</template>
