import { createRouter, createWebHistory } from 'vue-router'

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
        path: 'field',
        name: 'field',
        component: () => import('@/pages/FieldPage.vue'),
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

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
