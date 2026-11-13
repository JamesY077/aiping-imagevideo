import { createRouter, createWebHistory, type RouteLocation } from 'vue-router'
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
    path: '/image',
    name: 'ImageCreate',
    component: () => import('@/views/ImageCreate.vue'),
    // 三个创作页都必须在「登录页」完成登录后才能进入（首页 → 登录页 → 创作页）。
    meta: { requiresAuth: true },
  },
  {
    path: '/video',
    name: 'VideoCreate',
    component: () => import('@/views/ChatCreate.vue'),
    meta: { requiresAuth: true, mediaType: 'video' },
  },
  {
    // 旧入口兼容：平台早期只有 /studio，按 query.type 转发到图片页或视频页。
    path: '/studio',
    redirect: (to: RouteLocation) => ({
      path: to.query.type === 'video' ? '/video' : '/image',
      query: to.query,
    }),
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
    // 视频动捕入口已下线（上游服务不可用），旧书签统一回到 3D 建模页。
    path: '/motion',
    redirect: '/model3d',
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
    redirect: '/image',
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
    next('/image')
  } else {
    next()
  }
})

export default router
