import { createRouter, createWebHistory } from 'vue-router'
import { hasActiveApiSession, invalidateExpiredApiSession } from '@/api/config'

const routes = [
  {
    path: '/',
    redirect: '/home',
  },
  {
    path: '/home',
    name: 'Landing',
    component: () => import('@/views/LandingPage.vue'),
    meta: { requiresNoAuth: true },
  },
  {
    path: '/setup',
    name: 'Setup',
    component: () => import('@/views/ApiKeySetup.vue'),
    meta: { requiresNoAuth: true },
  },
  {
    path: '/studio',
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
  invalidateExpiredApiSession()

  if (to.meta.requiresAuth && !hasActiveApiSession()) {
    next('/home')
  } else if ((to.path === '/' || to.path === '/home' || to.path === '/setup') && hasActiveApiSession()) {
    next('/studio')
  } else {
    next()
  }
})

export default router
