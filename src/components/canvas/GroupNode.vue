<template>
  <div :class="['group-node', { 'group-node--selected': selected }]">
    <div class="group-node-header">
      <span class="group-node-title">{{ label }}</span>
      <button
        type="button"
        class="group-node-ungroup"
        @click.stop="canvasStore.ungroup(id)"
      >
        解组
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCanvasStore, type CanvasNodeData } from '@/stores/canvasStore'

const props = defineProps<{
  id: string
  data: CanvasNodeData
  selected?: boolean
}>()

const canvasStore = useCanvasStore()
const label = computed(() => props.data?.label ?? '分组')
</script>
