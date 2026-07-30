<template>
  <div class="canvas-toolbar">
    <!-- 添加节点下拉 -->
    <div class="ct-dropdown">
      <button type="button" class="canvas-toolbar-button" @click.stop="menuOpen = !menuOpen">
        添加节点 ▾
      </button>
      <div v-if="menuOpen" class="ct-menu" @click.stop>
        <button type="button" class="ct-menu-item" @click="addGen('text')">文本节点</button>
        <button type="button" class="ct-menu-item" @click="addGen('image')">图片节点</button>
        <button type="button" class="ct-menu-item" @click="addGen('video')">视频节点</button>
      </div>
    </div>

    <button
      v-for="button in buttons"
      :key="button.key"
      type="button"
      class="canvas-toolbar-button"
      @click="button.onClick"
    >
      {{ button.label }}
    </button>

    <!-- 运行整个画布 -->
    <button
      type="button"
      class="canvas-toolbar-button canvas-toolbar-button--run"
      :disabled="canvasStore.isRunning || !canvasStore.hasGenerationNodes"
      @click="canvasStore.runAll()"
    >
      {{ canvasStore.isRunning ? '运行中…' : '▶ 运行' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useCanvasStore, type CanvasNodeKind } from '@/stores/canvasStore'

const canvasStore = useCanvasStore()
const menuOpen = ref(false)

const emit = defineEmits<{ (e: 'add-node', kind: CanvasNodeKind): void }>()

function addGen(kind: CanvasNodeKind) {
  emit('add-node', kind)
  menuOpen.value = false
}


function closeMenu() {
  menuOpen.value = false
}

onMounted(() => window.addEventListener('click', closeMenu))
onBeforeUnmount(() => window.removeEventListener('click', closeMenu))

const buttons = [
  { key: 'duplicate', label: '复制', onClick: () => canvasStore.duplicateSelected() },
  { key: 'group', label: '分组', onClick: () => canvasStore.groupSelected() },
  { key: 'delete', label: '删除', onClick: () => canvasStore.removeSelected() },
  { key: 'undo', label: '撤销', onClick: () => canvasStore.undo() },
  { key: 'redo', label: '重做', onClick: () => canvasStore.redo() },
  { key: 'reset', label: '清空', onClick: () => canvasStore.reset() },
]
</script>

<style scoped>
.ct-dropdown {
  position: relative;
}
.ct-menu {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  display: flex;
  flex-direction: column;
  min-width: 130px;
  padding: 6px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(28, 28, 30, 0.96);
  -webkit-backdrop-filter: saturate(180%) blur(24px);
  backdrop-filter: saturate(180%) blur(24px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  z-index: 20;
}
.ct-menu-item {
  padding: 8px 12px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: #f5f5f7;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.ct-menu-item:hover {
  background: rgba(72, 72, 74, 0.9);
}
.canvas-toolbar-button--run {
  background: #0a84ff !important;
  color: #fff;
}
.canvas-toolbar-button--run:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
