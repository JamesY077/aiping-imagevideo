import { createRouter, createWebHistory } from 'vue-router'
import { hasActiveApiSession } from '@/api/config'

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
  if (to.meta.requiresAuth && !hasActiveApiSession()) {
    next('/setup')
  } else {
    next()
  }
})

export default router
