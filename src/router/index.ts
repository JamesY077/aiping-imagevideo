import { createRouter, createWebHistory } from 'vue-router'
import { hasActiveApiSession, invalidateExpiredApiSession } from '@/api/config'

const routes = [
  {
    path: '/',
    name: 'Landing',
    component: () => import('@/views/LandingPage.vue'),
    meta: { requiresNoAuth: true },
  },
  {
    path: '/home',
    redirect: '/',
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
    meta: { requiresNoAuth: true },
  },
  {
    path: '/voice',
    name: 'Voice',
    component: () => import('@/views/VoiceCreate.vue'),
    meta: { requiresNoAuth: true },
  },
  {
    path: '/canvas',
    name: 'InfiniteCanvas',
    component: () => import('@/views/InfiniteCanvas.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/skill',
    name: 'SkillCreate',
    component: () => import('@/views/SkillCreate.vue'),
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
    next('/')
  } else if (to.path === '/setup' && hasActiveApiSession()) {
    next('/studio')
  } else {
    next()
  }
})

export default router
