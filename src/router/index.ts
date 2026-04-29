import { createRouter, createWebHistory } from 'vue-router'
import { hasApiConfig } from '@/api/config'

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
  const configured = hasApiConfig()
  if (to.meta.requiresAuth && !configured) {
    next('/setup')
  } else if (to.meta.requiresNoAuth && configured) {
    next('/')
  } else {
    next()
  }
})

export default router
