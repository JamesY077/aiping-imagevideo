import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  clearApiBaseUrl,
  clearApiKey,
  getApiBaseUrl,
  getApiKey,
  markApiSessionReady,
  clearApiSessionReady,
  saveApiBaseUrl,
  saveApiKey,
} from '@/api/config'
import { testConnection } from '@/api/aiping'

export const useApiStore = defineStore('api', () => {
  const apiKey = ref<string | null>(getApiKey())
  const apiBaseUrl = ref(getApiBaseUrl())
  const isConnected = ref(false)
  const isTesting = ref(false)

  const hasApiKey = computed(() => !!apiKey.value)
  const hasApiConfig = computed(() => !!apiKey.value && !!apiBaseUrl.value)

  async function testAndSave(key: string, baseUrl = apiBaseUrl.value): Promise<boolean> {
    isTesting.value = true
    try {
      const valid = await testConnection(key, baseUrl)
      if (valid) {
        saveApiKey(key)
        saveApiBaseUrl(baseUrl)
        apiKey.value = key
        apiBaseUrl.value = getApiBaseUrl()
        markApiSessionReady()
        isConnected.value = true
        return true
      } else {
        return false
      }
    } catch {
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
    apiBaseUrl.value = getApiBaseUrl()
    isConnected.value = false
  }

  return { apiKey, apiBaseUrl, isConnected, isTesting, hasApiKey, hasApiConfig, testAndSave, clear }
})
