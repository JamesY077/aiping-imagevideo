import { useApiStore } from '@/stores/apiStore'

export function useApiKey() {
  const apiStore = useApiStore()
  return apiStore
}
