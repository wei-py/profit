import { defineStore } from "pinia";
import { ref } from "vue";
import { checkCode, createCodes, deleteCode, listCodes } from "@/api/admin";

export const useAdminStore = defineStore("admin", () => {
  const secret = ref(localStorage.getItem("admin-secret") || "");
  const codes = ref([]);
  const detail = ref(null);
  const detailDevices = ref([]);
  const filter = ref("all");
  const loading = ref(false);
  const error = ref("");

  function setSecret(val) {
    secret.value = val;
    localStorage.setItem("admin-secret", val);
  }

  function clearSecret() {
    secret.value = "";
    localStorage.removeItem("admin-secret");
  }

  async function fetchCodes() {
    loading.value = true;
    error.value = "";
    try {
      const resp = await listCodes(filter.value);
      if (resp.success) {
        codes.value = resp.codes;
      }
      else {
        error.value = resp.error || "获取列表失败";
        if (resp.error === "未授权") {
          clearSecret();
        }
      }
    }
    catch (e) {
      error.value = e.message || "网络错误";
    }
    loading.value = false;
  }

  async function doCreate(params) {
    loading.value = true;
    error.value = "";
    try {
      const resp = await createCodes(params);
      if (resp.success) {
        await fetchCodes();
        return resp;
      }
      error.value = resp.error || "创建失败";
      return resp;
    }
    catch (e) {
      error.value = e.message || "网络错误";
      return { error: e.message, success: false };
    }
    finally {
      loading.value = false;
    }
  }

  async function doDelete(code) {
    loading.value = true;
    error.value = "";
    try {
      const resp = await deleteCode(code);
      if (resp.success) {
        await fetchCodes();
        return resp;
      }
      error.value = resp.error || "删除失败";
      return resp;
    }
    catch (e) {
      error.value = e.message || "网络错误";
      return { error: e.message, success: false };
    }
    finally {
      loading.value = false;
    }
  }

  async function doCheck(code) {
    loading.value = true;
    error.value = "";
    try {
      const resp = await checkCode(code);
      if (resp.success) {
        detail.value = resp.code;
        detailDevices.value = resp.devices;
        return resp;
      }
      error.value = resp.error || "查询失败";
      return resp;
    }
    catch (e) {
      error.value = e.message || "网络错误";
      return { error: e.message, success: false };
    }
    finally {
      loading.value = false;
    }
  }

  return {
    clearSecret,
    codes,
    detail,
    detailDevices,
    doCheck,
    doCreate,
    doDelete,
    error,
    fetchCodes,
    filter,
    loading,
    secret,
    setSecret,
  };
});
