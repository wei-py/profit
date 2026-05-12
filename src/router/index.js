import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/activate',
    name: 'activate',
    component: () => import('@/pages/ActivationPage.vue'),
  },
  {
    path: '/',
    component: () => import('@/layouts/DefaultLayout.vue'),
    redirect: '/list',
    children: [
      { path: 'country', name: 'country', component: () => import('@/pages/CountryPage.vue') },
      { path: 'list', name: 'list', component: () => import('@/pages/ListPage.vue') },
    ],
  },
]

const router = createRouter({ history: createWebHistory(), routes })
export default router
