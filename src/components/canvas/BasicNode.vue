<template>
  <div :class="['basic-node', { 'basic-node--selected': selected }]">
    <Handle class="basic-node-handle basic-node-handle--target" type="target" :position="Position.Left" />
    <input
      v-if="editing"
      ref="inputRef"
      class="basic-node-input"
      :value="label"
      @input="handleInput"
      @blur="editing = false"
      @keydown.enter="editing = false"
    />
    <div
      v-else
      class="basic-node-label"
      title="双击编辑名称"
      @dblclick="startEditing"
    >
      {{ label || '未命名节点' }}
    </div>
    <Handle class="basic-node-handle basic-node-handle--source" type="source" :position="Position.Right" />

  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { useCanvasStore, type CanvasNodeData } from '@/stores/canvasStore'

const props = defineProps<{
  id: string
  data: CanvasNodeData
  selected?: boolean
}>()

const canvasStore = useCanvasStore()
const editing = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

const label = computed(() => props.data?.label ?? '')

async function startEditing() {
  editing.value = true
  await nextTick()
  inputRef.value?.focus()
  inputRef.value?.select()
}

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  canvasStore.updateNodeLabel(props.id, target.value)
}
</script>

<style scoped>
.basic-node {
  position: relative;
}
</style>
