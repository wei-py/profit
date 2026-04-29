import { createRouter, createWebHistory } from 'vue-router'

/** 路由配置数组 */
const routes = [
  {
    path: '/',
    component: () => import('@/layouts/DefaultLayout.vue'),
    redirect: '/preset',
    children: [
      {
        path: 'preset',
        name: 'preset',
        component: () => import('@/pages/PresetPage.vue'),
      },
      {
        path: 'option',
        name: 'option',
        component: () => import('@/pages/OptionPage.vue'),
      },
      {
        path: 'template',
        name: 'template',
        component: () => import('@/pages/TemplatePage.vue'),
      },
      {
        path: 'create',
        name: 'create',
        component: () => import('@/pages/CreatePage.vue'),
      },
      {
        path: 'list',
        name: 'list',
        component: () => import('@/pages/ListPage.vue'),
      },
    ],
  },
]

/** Vue Router 实例 */
const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
