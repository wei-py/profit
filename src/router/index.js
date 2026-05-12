import { createRouter, createWebHistory } from "vue-router";

const routes = [
  {
    name: "activate",
    path: "/activate",
    component: () => import("@/pages/ActivationPage.vue"),
  },
  {
    children: [
      {
        name: "country",
        path: "country",
        component: () => import("@/pages/CountryPage.vue"),
      },
      {
        name: "list",
        path: "list",
        component: () => import("@/pages/ListPage.vue"),
      },
    ],
    path: "/",
    redirect: "/list",
    component: () => import("@/layouts/DefaultLayout.vue"),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});
export default router;
