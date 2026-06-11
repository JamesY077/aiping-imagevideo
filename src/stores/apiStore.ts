import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  clearApiBaseUrl,
  clearApiKey,
  getApiBaseUrlInputValue,
  getApiKey,
  markApiSessionReady,
  clearApiSessionReady,
  saveApiBaseUrl,
  saveApiKey,
} from '@/api/config'
import { testConnectionWithDetail } from '@/api/aiping'

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
    try {
      const result = await testConnectionWithDetail(key, baseUrl)
      if (result.ok) {
        saveApiKey(key)
        saveApiBaseUrl(baseUrl)
        apiKey.value = key
        apiBaseUrl.value = getApiBaseUrlInputValue()
        markApiSessionReady()
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

  function clear() {
    clearApiKey()
    clearApiBaseUrl()
    clearApiSessionReady()
    apiKey.value = null
    apiBaseUrl.value = getApiBaseUrlInputValue()
    isConnected.value = false
    connectionError.value = ''
  }

  return { apiKey, apiBaseUrl, isConnected, isTesting, connectionError, hasApiKey, hasApiConfig, testAndSave, clear }
})
