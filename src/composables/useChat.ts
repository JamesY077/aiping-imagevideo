import { useChatStore } from '@/stores/chatStore'

export function useChat() {
  const chatStore = useChatStore()
  return chatStore
}
