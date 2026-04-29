import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getApiKey, saveApiKey, clearApiKey } from '@/api/config'
import { testConnection } from '@/api/aiping'

export const useApiStore = defineStore('api', () => {
  const apiKey = ref<string | null>(getApiKey())
  const isConnected = ref(false)
  const isTesting = ref(false)

  const hasApiKey = computed(() => !!apiKey.value)

  async function testAndSave(key: string): Promise<boolean> {
    isTesting.value = true
    try {
      const valid = await testConnection(key)
      if (valid) {
        saveApiKey(key)
        apiKey.value = key
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
    apiKey.value = null
    isConnected.value = false
  }

  return { apiKey, isConnected, isTesting, hasApiKey, testAndSave, clear }
})
