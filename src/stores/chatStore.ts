import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Message } from '@/types/chat'

export const useChatStore = defineStore('chat', () => {
  const messages = ref<Message[]>([])
  const isGenerating = ref(false)

  let _idCounter = 0
  function addMessage(message: Omit<Message, 'id' | 'timestamp'>): string {
    const id = `${Date.now()}_${++_idCounter}`
    messages.value.push({
      ...message,
      id,
      timestamp: Date.now(),
    })
    return id
  }

  function updateMessage(id: string, updates: Partial<Message>) {
    const index = messages.value.findIndex((m) => m.id === id)
    if (index !== -1) {
      messages.value.splice(index, 1, { ...messages.value[index], ...updates })
    }
  }

  function clearMessages() {
    messages.value = []
  }

  return { messages, isGenerating, addMessage, updateMessage, clearMessages }
})
