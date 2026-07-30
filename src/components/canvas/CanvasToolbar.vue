<template>
  <div class="canvas-toolbar">
    <button
      v-for="button in buttons"
      :key="button.key"
      type="button"
      class="canvas-toolbar-button"
      @click="button.onClick"
    >
      {{ button.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useCanvasStore } from '@/stores/canvasStore'

const canvasStore = useCanvasStore()

const buttons = [
  { key: 'add', label: '添加节点', onClick: () => canvasStore.addNode() },
  { key: 'duplicate', label: '复制', onClick: () => canvasStore.duplicateSelected() },
  { key: 'group', label: '分组', onClick: () => canvasStore.groupSelected() },
  { key: 'delete', label: '删除', onClick: () => canvasStore.removeSelected() },
  { key: 'undo', label: '撤销', onClick: () => canvasStore.undo() },
  { key: 'redo', label: '重做', onClick: () => canvasStore.redo() },
  { key: 'reset', label: '清空', onClick: () => canvasStore.reset() },
]
</script>
