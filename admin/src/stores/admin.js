import { defineStore } from "pinia";
import { ref } from "vue";
import { checkCode, createCodes, deleteCode, getTemplate, listCodes, saveTemplate, updateRemark } from "@/api/admin";

export const useAdminStore = defineStore("admin", () => {
  const apiBase = ref(
    localStorage.getItem("admin-api-base") || import.meta.env.VITE_API_BASE || "",
  );
  const secret = ref(localStorage.getItem("admin-secret") || "");
  const codes = ref([]);
  const detail = ref(null);
  const detailDevices = ref([]);
  const filter = ref("all");
  const loading = ref(false);
  const error = ref("");

  function setApiBase(val) {
    apiBase.value = val;
    localStorage.setItem("admin-api-base", val);
  }

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
    detail.value = null;
    detailDevices.value = [];
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

  async function doUpdateRemark(code, remark) {
    try {
      const resp = await updateRemark(code, remark);
      if (resp.success) {
        await fetchCodes();
        return resp;
      }
      error.value = resp.error || "更新备注失败";
      return resp;
    }
    catch (e) {
      error.value = e.message || "网络错误";
      return { error: e.message, success: false };
    }
  }

  async function doGetTemplate() {
    try {
      const resp = await getTemplate();
      return resp;
    }
    catch (e) {
      error.value = e.message || "网络错误";
      return { error: e.message, success: false };
    }
  }

  async function doSaveTemplate(value) {
    try {
      const resp = await saveTemplate(value);
      return resp;
    }
    catch (e) {
      error.value = e.message || "网络错误";
      return { error: e.message, success: false };
    }
  }

  return {
    apiBase,
    clearSecret,
    codes,
    detail,
    detailDevices,
    doCheck,
    doCreate,
    doDelete,
    doGetTemplate,
    doSaveTemplate,
    doUpdateRemark,
    error,
    fetchCodes,
    filter,
    loading,
    secret,
    setApiBase,
    setSecret,
  };
});
