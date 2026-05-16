import { createRouter, createWebHistory } from "vue-router";

const routes = [
  {
    name: "login",
    path: "/login",
    component: () => import("@/pages/LoginPage.vue"),
  },
  {
    meta: { requiresAuth: true },
    name: "dashboard",
    path: "/",
    component: () => import("@/pages/DashboardPage.vue"),
  },
  {
    meta: { requiresAuth: true },
    name: "files",
    path: "/files",
    component: () => import("@/pages/FilesPage.vue"),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const secret = localStorage.getItem("admin-secret");
  if (to.meta.requiresAuth && !secret) {
    return { name: "login" };
  }
});

export default router;
