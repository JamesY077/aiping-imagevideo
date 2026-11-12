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
    // 三个创作页都必须在「登录页」完成登录后才能进入（首页 → 登录页 → 创作页）。
    meta: { requiresAuth: true },
  },
  {
    path: '/voice',
    name: 'Voice',
    component: () => import('@/views/VoiceCreate.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/model3d',
    name: 'Model3D',
    component: () => import('@/views/Model3D.vue'),
    meta: { requiresAuth: true },
  },
  {
    // 视频动捕与 3D 建模共用一套页面与任务流，只是初始进入的分区不同。
    path: '/motion',
    name: 'Motion',
    component: () => import('@/views/Model3D.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/skill',
    name: 'SkillCreate',
    component: () => import('@/views/SkillCreate.vue'),
    meta: { requiresAuth: true },
  },
  // 无限画布已下线，旧书签统一回到图片视频生成页。
  {
    path: '/canvas',
    redirect: '/studio',
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

  // 未登录访问任何创作页时统一进登录页，并记住目标页，登录完成后直接回到该页。
  if (to.meta.requiresAuth && !hasActiveApiSession()) {
    next({ path: '/setup', query: { redirect: to.fullPath } })
  } else if (to.path === '/setup' && hasActiveApiSession() && !to.query.redirect) {
    next('/studio')
  } else {
    next()
  }
})

export default router
