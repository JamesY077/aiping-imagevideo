import router from '@/router'
import { clearApiSessionReady, getMillisecondsUntilNextChinaMidnight, hasActiveApiSession, invalidateExpiredApiSession } from '@/api/config'

let midnightRefreshTimer: number | null = null

function redirectToLandingIfNeeded() {
  if (router.currentRoute.value.path !== '/home') {
    router.replace('/home')
  }
}

function clearMidnightRefreshTimer() {
  if (midnightRefreshTimer !== null) {
    window.clearTimeout(midnightRefreshTimer)
    midnightRefreshTimer = null
  }
}

function scheduleNextChinaMidnightRefresh() {
  clearMidnightRefreshTimer()

  const delay = getMillisecondsUntilNextChinaMidnight(new Date())
  midnightRefreshTimer = window.setTimeout(() => {
    clearApiSessionReady()
    window.location.replace('/home')
  }, delay)
}

export function enforceApiSessionGuard() {
  const wasExpired = invalidateExpiredApiSession()

  if (wasExpired || !hasActiveApiSession()) {
    clearApiSessionReady()
    redirectToLandingIfNeeded()
  }

  if (hasActiveApiSession()) {
    scheduleNextChinaMidnightRefresh()
  } else {
    clearMidnightRefreshTimer()
  }
}

export function restartApiSessionGuard() {
  enforceApiSessionGuard()
}

export function stopApiSessionGuard() {
  clearMidnightRefreshTimer()
}