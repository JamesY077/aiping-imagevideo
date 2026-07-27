import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  clearApiBaseUrl,
  clearApiKey,
  getApiBaseUrlInputValue,
  getApiKey,
  markApiSessionReady,
  clearApiSessionReady,
  saveApiAuth,
} from '@/api/config'
import { testConnectionWithDetail } from '@/api/aiping'
import { restartApiSessionGuard, stopApiSessionGuard } from '@/utils/sessionGuard'

export const useApiStore = defineStore('api', () => {
  const apiKey = ref<string | null>(getApiKey())
  const apiBaseUrl = ref(getApiBaseUrlInputValue())
  const isConnected = ref(false)
  const isTesting = ref(false)
  const connectionError = ref('')

  const hasApiKey = computed(() => !!apiKey.value)
  const hasApiConfig = computed(() => !!apiKey.value && !!apiBaseUrl.value)

  async function testAndSave(key: string, baseUrl = apiBaseUrl.value): Promise<boolean> {
    isTesting.value = true
    connectionError.value = ''
    const trimmedKey = key.trim()
    const trimmedBaseUrl = baseUrl.trim()
    try {
      const result = await testConnectionWithDetail(trimmedKey, trimmedBaseUrl)
      if (result.ok) {
        saveApiAuth(trimmedKey, trimmedBaseUrl)
        apiKey.value = trimmedKey
        apiBaseUrl.value = getApiBaseUrlInputValue()
        markApiSessionReady()
        restartApiSessionGuard()
        isConnected.value = true
        return true
      } else {
        connectionError.value = result.message || '连接验证失败，请检查 Base URL 和 API Key。'
        return false
      }
    } catch (error: any) {
      connectionError.value = error?.message || '连接验证失败，请检查 Base URL 和 API Key。'
      return false
    } finally {
      isTesting.value = false
    }
  }

  async function updateBaseUrl(baseUrl: string): Promise<boolean> {
    if (!apiKey.value) {
      connectionError.value = '请先填写 API Key。'
      return false
    }

    return testAndSave(apiKey.value, baseUrl)
  }

  function clear() {
    clearApiKey()
    clearApiBaseUrl()
    clearApiSessionReady()
    stopApiSessionGuard()
    apiKey.value = null
    apiBaseUrl.value = getApiBaseUrlInputValue()
    isConnected.value = false
    connectionError.value = ''
  }

  return { apiKey, apiBaseUrl, isConnected, isTesting, connectionError, hasApiKey, hasApiConfig, testAndSave, updateBaseUrl, clear }
})
