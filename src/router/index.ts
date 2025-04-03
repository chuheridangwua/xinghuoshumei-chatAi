import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/app/index'
  },
  {
    path: '/test/index',
    name: 'TestIndex',
    component: () => import('../app/test/index.vue')
  },
  {
    path: '/app/index',
    name: 'AppIndex',
    component: () => import('../app/index/index.vue')
  },
  {
    path: '/web/index',
    name: 'WebIndex',
    component: () => import('../web/index.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router 