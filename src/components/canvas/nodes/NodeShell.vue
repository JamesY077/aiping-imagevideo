<template>
  <div
    :class="[
      'gen-node',
      `gen-node--${kind}`,
      {
        'gen-node--selected': selected,
        'gen-node--expanded': expanded,
        'gen-node--running': isRunning,
        'gen-node--failed': data.status === 'failed',
        'gen-node--done': data.status === 'completed',
      },
    ]"
  >
    <Handle class="gen-handle" type="target" :position="Position.Left" />

    <!-- 头部：步骤图标 + 标题 + 状态 -->
    <div class="gen-head">
      <span class="gen-icon" :class="`gen-icon--${kind}`">
        <slot name="icon" />
      </span>
      <span class="gen-title">{{ title }}</span>
      <span v-if="data.status === 'running'" class="gen-badge gen-badge--run">运行中</span>
      <span v-else-if="data.status === 'completed'" class="gen-badge gen-badge--ok">完成</span>
      <span v-else-if="data.status === 'failed'" class="gen-badge gen-badge--err">失败</span>
      <span v-else class="gen-badge gen-badge--idle">待运行</span>
      <button
        v-if="expanded"
        class="gen-gear"
        :class="{ 'gen-gear--active': showSettings }"
        title="设置：自定义 AI 润色系统提示词"
        @click.stop="showSettings = !showSettings"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path
            d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
          />
          <path
            d="M19.4 13a7.6 7.6 0 0 0 .06-1 7.6 7.6 0 0 0-.06-1l2-1.6-2-3.4-2.4 1a7.3 7.3 0 0 0-1.7-1l-.4-2.5H10.1l-.4 2.5a7.3 7.3 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.3 7.3 0 0 0 1.7 1l.4 2.5h3.8l.4-2.5a7.3 7.3 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.2"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <button v-if="expanded" class="gen-del" title="删除节点" @click.stop="store.removeNode(id)">✕</button>
    </div>

    <!-- 设置面板：可查看并自定义本节点的 AI 润色系统提示词 -->
    <div v-if="expanded && showSettings" class="gen-settings nodrag" @mousedown.stop @wheel.stop>
      <div class="gen-settings-head">
        <span class="gen-settings-title">AI 润色系统提示词</span>
        <button
          class="gen-settings-reset"
          title="恢复为默认系统提示词"
          @click="store.updateNodeData(id, { systemPrompt: '' })"
        >
          恢复默认
        </button>
      </div>
      <textarea
        class="gen-settings-input"
        :value="data.systemPrompt ?? ''"
        :placeholder="defaultSystemPrompt"
        rows="5"
        @input="onSystemPromptInput"
        @mousedown.stop
        @dblclick.stop
        @wheel.stop
      />
      <div class="gen-settings-hint">
        留空则使用默认系统提示词（上方占位内容），仅在开启「AI 润色」时生效。
      </div>
    </div>

    <!-- 结果预览（始终可见，工作流每步的产出） -->
    <div v-if="data.resultType === 'image' && data.resultUrl" class="gen-preview">
      <img :src="data.resultUrl" alt="result" />
    </div>
    <div v-else-if="data.resultType === 'video' && data.resultUrl" class="gen-preview">
      <video :src="data.resultUrl" controls />
    </div>
    <div
      v-else-if="data.resultType === 'text' && data.resultText"
      class="gen-result-text"
      :class="{ 'gen-result-text--clamp': !expanded }"
    >
      {{ data.resultText }}
    </div>

    <!-- 未展开且尚无结果时，显示 prompt 摘要 / 提示 -->
    <div v-if="!expanded && !hasResult && data.status !== 'running'" class="gen-collapsed-hint">
      <span v-if="data.prompt" class="gen-prompt-preview">{{ data.prompt }}</span>
      <span v-else class="gen-empty-hint">点击编辑此步骤</span>
    </div>

    <div v-if="data.status === 'failed' && data.error" class="gen-error">{{ data.error }}</div>

    <!-- 进度条 -->
    <div v-if="data.status === 'running'" class="gen-progress">
      <div class="gen-progress-bar" :style="{ width: (data.progress || 0) + '%' }" />
    </div>

    <!-- 展开后的编辑区：输入框 + 操作 -->
    <template v-if="expanded">
      <textarea
        ref="promptRef"
        class="gen-input nodrag"
        :value="data.prompt"
        :placeholder="placeholder"
        rows="3"
        @input="onPromptInput"
        @mousedown.stop
        @dblclick.stop
        @wheel.stop
      />

      <div class="gen-toolbar nodrag" @mousedown.stop>
        <!-- 各节点差异化控件（模型、比例、上传等）由具体节点通过插槽注入 -->
        <slot name="toolbar" />

        <!-- 运行：所有生成型节点通用 -->
        <button class="gen-run" :disabled="isRunning" @click="store.runNode(id)">
          {{ data.status === 'running' ? '生成中' : data.status === 'completed' ? '重新运行' : '运行' }}
        </button>
      </div>
    </template>

    <Handle class="gen-handle" type="source" :position="Position.Right" />
  </div>
</template>

<script setup lang="ts">
/**
 * 生成型节点的共享外壳：承载所有节点通用的结构与行为，
 * 包括连线锚点、头部（图标/标题/状态/设置/删除）、AI 润色系统提示词设置面板、
 * 结果预览、进度条、prompt 输入框（含高度自适应）与运行按钮。
 *
 * 各具体节点（TextNode / ImageNode / ExpandNode / VideoNode）只需：
 *  - 通过 `#icon` 插槽提供节点身份图标；
 *  - 通过 `#toolbar` 插槽提供自己的差异化控件；
 *  - 通过 props 传入 title / placeholder / defaultSystemPrompt。
 */
import { computed, nextTick, ref, watch } from 'vue'
import { Handle, Position } from '@vue-flow/core'

import { useCanvasStore, type CanvasNodeData } from '@/stores/canvasStore'

const props = defineProps<{
  id: string
  data: CanvasNodeData
  selected?: boolean
  title: string
  placeholder: string
  defaultSystemPrompt: string
}>()

const store = useCanvasStore()

const kind = computed(() => props.data.nodeKind || 'text')
const isRunning = computed(() => store.runningNodeId === props.id)

// 选中即展开：用户点击某个节点后才出现输入框与操作
const expanded = computed(() => !!props.selected)

// 节点"设置"面板：显示 / 隐藏自定义系统提示词编辑区
const showSettings = ref(false)

const hasResult = computed(
  () =>
    (props.data.resultType === 'image' && !!props.data.resultUrl) ||
    (props.data.resultType === 'video' && !!props.data.resultUrl) ||
    (props.data.resultType === 'text' && !!props.data.resultText),
)

function onSystemPromptInput(e: Event) {
  store.updateNodeData(props.id, { systemPrompt: (e.target as HTMLTextAreaElement).value })
}

// 输入框自适应高度：随内容增减撑高/收缩，超过上限出现内部滚动条，
// 避免润色后文字过多导致节点/拖拽框溢出错位。
const promptRef = ref<HTMLTextAreaElement | null>(null)
const MAX_TEXTAREA_HEIGHT = 220

function autoResize() {
  const el = promptRef.value
  if (!el) return
  el.style.height = 'auto'
  const next = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)
  el.style.height = `${next}px`
  el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden'
}

// 展开或 prompt（如润色覆盖）变化时，等 DOM 更新后重新计算高度
watch(
  () => [expanded.value, props.data.prompt] as const,
  async () => {
    if (!expanded.value) return
    await nextTick()
    autoResize()
  },
  { immediate: true },
)

function onPromptInput(e: Event) {
  store.updateNodeData(props.id, { prompt: (e.target as HTMLTextAreaElement).value })
  autoResize()
}
</script>

<!-- 共享样式（非 scoped）：外壳与各节点插槽内容共用同一套 gen-* 类名 -->
<style src="./generationNode.css"></style>
