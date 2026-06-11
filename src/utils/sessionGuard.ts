import router from '@/router'
import { clearApiSessionReady, getMillisecondsUntilNextChinaMidnight, hasActiveApiSession, invalidateExpiredApiSession } from '@/api/config'

let midnightRefreshTimer: number | null = null

function redirectToSetupIfNeeded() {
  if (router.currentRoute.value.path !== '/setup') {
    router.replace('/setup')
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
    window.location.replace('/setup')
  }, delay)
}

export function enforceApiSessionGuard() {
  const wasExpired = invalidateExpiredApiSession()

  if (wasExpired || !hasActiveApiSession()) {
    clearApiSessionReady()
    redirectToSetupIfNeeded()
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