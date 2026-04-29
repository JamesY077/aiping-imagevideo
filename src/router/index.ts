import { createRouter, createWebHistory } from 'vue-router'
import { getApiKey } from '@/api/config'

const routes = [
  {
    path: '/setup',
    name: 'Setup',
    component: () => import('@/views/ApiKeySetup.vue'),
    meta: { requiresNoAuth: true },
  },
  {
    path: '/',
    name: 'Chat',
    component: () => import('@/views/ChatCreate.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/Settings.vue'),
    meta: { requiresAuth: true },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, _from, next) => {
  const hasApiKey = !!getApiKey()
  if (to.meta.requiresAuth && !hasApiKey) {
    next('/setup')
  } else if (to.meta.requiresNoAuth && hasApiKey) {
    next('/')
  } else {
    next()
  }
})

export default router
