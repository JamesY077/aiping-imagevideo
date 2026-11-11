<template>
  <Teleport to="body">
    <div class="layer-editor-mask" @click.self="requestClose">
      <section class="layer-editor" role="dialog" aria-modal="true" :aria-label="`图层编辑 · ${editorModelLabel}`">
        <header class="editor-head">
          <div class="head-text">
            <h2>图层编辑 · {{ editorModelLabel }}</h2>
            <p v-if="isGlobalMode">
              拖动框调整元素位置和大小，也可以在右侧用自然语言让 AI 改布局。当前模型没有原生分层能力，
              会以参考图为底图，按图层描述与位置近似还原布局。改完点右下角「按此布局生成新图」才会出图。
            </p>
            <p v-else>
              拖动框调整元素位置和大小，也可以在右侧用自然语言让 AI 改布局。Moss 是文生图模型，
              布局改完必须点右下角「按此布局重新生成」才会出图。
            </p>
          </div>
          <button class="close-btn" type="button" aria-label="关闭图层编辑" @click="requestClose">✕</button>
        </header>

        <div class="editor-body">
          <div class="stage">
            <div v-if="dirty" class="stage-badge">布局已修改 · 预览仍是上一版图片</div>
            <div ref="canvasRef" class="canvas-wrap">
              <img :src="imageUrl" alt="待编辑的生成图片" draggable="false" @dragstart.prevent />
              <div
                v-for="(item, index) in draft.items"
                :key="item.id"
                class="bbox"
                :class="{
                  selected: item.id === selectedId,
                  background: isBackgroundLike(item),
                  'label-inside': item.y < draft.height * 0.03,
                }"
                :style="itemStyle(item, index)"
                @pointerdown="startDrag($event, item, 'move')"
              >
                <span class="bbox-label">
                  {{ index + 1 }} · {{ isBackgroundLike(item) ? '背景' : labelText(item.label) }}
                  <em v-if="isBackgroundLike(item)">底图</em>
                </span>
                <span
                  v-if="!isBackgroundLike(item)"
                  class="resize-handle"
                  aria-hidden="true"
                  @pointerdown.stop="startDrag($event, item, 'resize')"
                />
              </div>
            </div>
          </div>

          <aside class="side">
            <div class="side-scroll">
              <div class="panel-block layer-list-block">
              <div class="panel-head">
                <span class="panel-title">图层（{{ draft.items.length }}）</span>
                <button class="ghost-btn" type="button" @click="addLayer">＋ 添加</button>
              </div>
              <div class="layer-list">
                <button
                  v-for="(item, index) in draft.items"
                  :key="item.id"
                  class="layer-row"
                  :class="{ active: item.id === selectedId }"
                  type="button"
                  @click="selectedId = item.id"
                >
                  <span class="layer-index" :style="{ background: colorAt(index) }">{{ index + 1 }}</span>
                  <span class="layer-meta">
                    <span class="layer-kind">{{ isBackgroundLike(item) ? '背景 / 底图' : labelText(item.label) }}</span>
                    <span class="layer-caption" :class="{ missing: !isBackgroundLike(item) && !hasLayerContent(item) }">
                      {{
                        isBackgroundLike(item)
                          ? (item.caption || '整张参考图 · 底图')
                          : (item.text || item.caption || '缺少描述 · 不会出现在生成结果中')
                      }}
                    </span>
                  </span>
                  <span
                    v-if="editableLayerCount > 1 && !isBackgroundLike(item)"
                    class="layer-remove"
                    role="button"
                    tabindex="0"
                    title="删除该图层"
                    @click.stop="removeLayer(item.id)"
                    @keydown.enter.stop="removeLayer(item.id)"
                  >✕</span>
                </button>
              </div>
            </div>

            <div class="panel-block summary-block">
              <div class="panel-head">
                <span class="panel-title">整体画面</span>
                <span class="hint-text">背景 / 风格 / 光线</span>
              </div>
              <label class="field summary-field">
                <span>整体描述<em>作为底图与画面的补充说明</em></span>
                <textarea
                  v-model="draft.summary.caption"
                  rows="3"
                  :placeholder="summaryPlaceholder"
                />
              </label>
              <p class="panel-hint">
                {{ isGlobalMode
                  ? '会与参考图一起下发给模型；未提及区域尽量保持原图不变。'
                  : 'Moss 会把这里的内容当作整张图的背景与整体风格描述。' }}
              </p>
            </div>

            <div v-if="selectedItem" class="panel-block inspector-block">
              <div class="panel-head">
                <span class="panel-title">图层属性</span>
                <span class="hint-text">{{ isBackgroundLike(selectedItem) ? '整张参考图' : positionLabel(selectedItem) }}</span>
              </div>

              <label v-if="!isBackgroundLike(selectedItem)" class="field">
                <span>类型</span>
                <select v-model="selectedItem.label">
                  <option value="object">物体</option>
                  <option value="character">人物</option>
                  <option value="text">文字</option>
                </select>
              </label>

              <label class="field">
                <span>
                  {{ isBackgroundLike(selectedItem) ? '底图补充描述（可选）' : '元素描述' }}
                  <em v-if="!isBackgroundLike(selectedItem)">英文效果更好</em>
                </span>
                <textarea
                  ref="captionInputRef"
                  v-model="selectedItem.caption"
                  rows="3"
                  placeholder="例如：a white ceramic latte cup with leaf latte art, soft shadow"
                />
              </label>

              <label v-if="selectedItem.label === 'text' && !isBackgroundLike(selectedItem)" class="field">
                <span>文字内容</span>
                <textarea
                  v-model="selectedItem.text"
                  rows="2"
                  placeholder="要渲染的原文，可换行"
                />
              </label>

              <div v-if="!isBackgroundLike(selectedItem)" class="field">
                <span>位置与大小（像素）</span>
                <div class="coord-grid">
                  <label>X<input v-model.number="selectedItem.x" type="number" min="0" @change="clampSelected" /></label>
                  <label>Y<input v-model.number="selectedItem.y" type="number" min="0" @change="clampSelected" /></label>
                  <label>宽<input v-model.number="selectedItem.width" type="number" min="24" @change="clampSelected" /></label>
                  <label>高<input v-model.number="selectedItem.height" type="number" min="24" @change="clampSelected" /></label>
                </div>
              </div>
              <p v-else class="panel-hint">整张参考图作为底图，位置与大小固定，不可移动或缩放。</p>
            </div>

            <div class="panel-block ai-block">
              <div class="panel-head">
                <span class="panel-title">自然语言修改</span>
              </div>
              <textarea
                v-model="instruction"
                rows="3"
                :disabled="busy"
                placeholder="例如：把标题移到顶部居中，咖啡杯放大并移到正中偏左，右下角再加一行小字「手冲 · 拿铁」"
              />
              <p class="panel-hint">
                这里只修改图层与位置，不会自动出图。直接点下方
                「{{ isGlobalMode ? '按此布局生成新图' : '按此布局重新生成' }}」也会先执行这段修改。
              </p>
              <button class="ai-btn" type="button" :disabled="busy || !instruction.trim()" @click="applyInstruction">
                {{ busy ? 'AI 正在更新布局…' : '让 AI 修改布局' }}
              </button>
              <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
            </div>

            </div>

            <footer class="editor-foot">
              <p v-if="missingCaptionCount" class="foot-warn">
                有 {{ missingCaptionCount }} 个图层还没有描述，生成时会被忽略，请先补充「元素描述」。
              </p>
              <p v-if="dirty" class="foot-dirty">布局已修改，点右侧按钮才会按新布局生成新图。</p>
              <p v-else-if="isGlobalMode" class="foot-note">
                生成会以参考图为底图，按图层描述与位置近似还原；未提及区域尽量保持原样。
              </p>
              <p v-else class="foot-note">
                重新生成会消耗一次 Moss 调用。未移动的元素会按原布局尽量保持原位，但细节可能有轻微差异。
              </p>
              <div class="foot-actions">
                <button class="ghost-btn" type="button" @click="requestClose">放弃修改</button>
                <button
                  class="primary-btn"
                  type="button"
                  :disabled="busy || generating"
                  @click="regenerate"
                >
                  {{ generating
                    ? '正在生成中…'
                    : busy
                      ? '正在更新布局…'
                      : isGlobalMode
                        ? '按此布局生成新图'
                        : '按此布局重新生成' }}
                </button>
              </div>
            </footer>
          </aside>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { MossLayout, MossLayoutItem, MossLayoutLabel } from '@/types/layout'
import {
  clampLayoutItem,
  cloneLayout,
  createDefaultLayoutItem,
  describeItemPosition,
  isBackgroundLayer,
} from '@/features/layout/mossLayout'
import { editMossLayout } from '@/features/layout/planner'
import { normalizeErrorMessage } from '@/utils/errors'

const props = withDefaults(
  defineProps<{
    imageUrl: string
    layout: MossLayout
    /** 主页面是否正在生成；生成中禁止重复提交，避免点击后毫无反馈。 */
    generating?: boolean
    /** moss：使用原生分层 JSON；global：其他图片模型按图层描述近似还原。 */
    mode?: 'moss' | 'global'
    modelName?: string
  }>(),
  {
    generating: false,
    mode: 'moss',
    modelName: '',
  },
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'regenerate', layout: MossLayout): void
}>()

const isGlobalMode = computed(() => props.mode === 'global')
const editorModelLabel = computed(() => props.modelName || (isGlobalMode.value ? '通用图片模型' : 'Moss'))
const summaryPlaceholder = computed(() =>
  isGlobalMode.value
    ? '例如：以参考图为基础，保持人物与场景不变，整体改为黄昏暖色调'
    : '例如：夏日午后，暖光，极简海报风格',
)

const LAYER_COLORS = ['#f6c453', '#63b3ed', '#f687b3', '#68d391', '#b794f4', '#f6ad55', '#4fd1c5', '#fc8181']

const draft = ref<MossLayout>(cloneLayout(props.layout))
// 背景层不可编辑位置，默认选中第一个可编辑图层，没有时才回落到背景层。
const selectedId = ref<string | null>(
  draft.value.items.find((item) => !isBackgroundLayer(item))?.id ?? draft.value.items[0]?.id ?? null,
)
const instruction = ref('')
const busy = ref(false)
const dirty = ref(false)
const errorMessage = ref('')
const canvasRef = ref<HTMLElement | null>(null)
const captionInputRef = ref<HTMLTextAreaElement | null>(null)

// 任何图层改动都要显式提示：预览图是上一版生成结果，只有重新生成才会变。
watch(
  draft,
  () => {
    dirty.value = true
  },
  { deep: true }
)

const selectedItem = computed(() => draft.value.items.find((item) => item.id === selectedId.value) || null)

/** 没有描述或文字内容的图层不会出现在发送给 Moss 的布局里。 */
function hasLayerContent(item: MossLayoutItem): boolean {
  return !!(item.caption.trim() || item.text?.trim())
}

/** 背景层：整张参考图铺满画布，位置固定，也不参与「缺少描述」统计。 */
function isBackgroundLike(item: MossLayoutItem): boolean {
  return isBackgroundLayer(item)
}

const missingCaptionCount = computed(
  () => draft.value.items.filter((item) => !isBackgroundLike(item) && !hasLayerContent(item)).length,
)

/** 可移动 / 可删除的普通图层数量（不含背景层）。 */
const editableLayerCount = computed(() => draft.value.items.filter((item) => !isBackgroundLike(item)).length)

function colorAt(index: number): string {
  return LAYER_COLORS[index % LAYER_COLORS.length]
}

function labelText(label: MossLayoutLabel): string {
  if (label === 'text') return '文字'
  if (label === 'character') return '人物'
  return '物体'
}

function itemStyle(item: MossLayoutItem, index: number) {
  const color = colorAt(index)
  return {
    left: `${(item.x / draft.value.width) * 100}%`,
    top: `${(item.y / draft.value.height) * 100}%`,
    width: `${(item.width / draft.value.width) * 100}%`,
    height: `${(item.height / draft.value.height) * 100}%`,
    borderColor: color,
    '--layer-color': color,
  }
}

function positionLabel(item: MossLayoutItem): string {
  return `${describeItemPosition(item, draft.value.width, draft.value.height)} · ${item.width}×${item.height}`
}

function clampSelected() {
  const item = selectedItem.value
  if (!item || isBackgroundLike(item)) return
  const clamped = clampLayoutItem(
    {
      ...item,
      x: Number(item.x) || 0,
      y: Number(item.y) || 0,
      width: Number(item.width) || 24,
      height: Number(item.height) || 24,
    },
    draft.value.width,
    draft.value.height
  )
  Object.assign(item, clamped)
}

function addLayer() {
  const item = createDefaultLayoutItem(draft.value)
  draft.value.items.push(item)
  selectedId.value = item.id
  // 新图层默认没有描述，直接聚焦描述框，避免加完忘记写导致生成时被忽略。
  nextTick(() => captionInputRef.value?.focus())
}

function removeLayer(id: string) {
  const target = draft.value.items.find((item) => item.id === id)
  if (!target || isBackgroundLike(target)) return
  // 背景层之外至少要留一个图层。
  if (draft.value.items.filter((item) => !isBackgroundLike(item)).length <= 1) return
  const index = draft.value.items.findIndex((item) => item.id === id)
  if (index < 0) return
  draft.value.items.splice(index, 1)
  if (selectedId.value === id) {
    selectedId.value = draft.value.items[Math.min(index, draft.value.items.length - 1)]?.id ?? null
  }
}

interface DragState {
  mode: 'move' | 'resize'
  id: string
  startX: number
  startY: number
  origin: { x: number; y: number; width: number; height: number }
}

let dragState: DragState | null = null

function canvasRect(): DOMRect | null {
  const rect = canvasRef.value?.getBoundingClientRect()
  return rect && rect.width > 0 && rect.height > 0 ? rect : null
}

function startDrag(event: PointerEvent, item: MossLayoutItem, mode: 'move' | 'resize') {
  if (isBackgroundLike(item)) return
  event.preventDefault()
  selectedId.value = item.id
  dragState = {
    mode,
    id: item.id,
    startX: event.clientX,
    startY: event.clientY,
    origin: { x: item.x, y: item.y, width: item.width, height: item.height },
  }
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', stopDrag)
  window.addEventListener('pointercancel', stopDrag)
}

function onDragMove(event: PointerEvent) {
  const state = dragState
  const rect = canvasRect()
  if (!state || !rect) return
  const item = draft.value.items.find((candidate) => candidate.id === state.id)
  if (!item) return

  const scaleX = draft.value.width / rect.width
  const scaleY = draft.value.height / rect.height
  const dx = (event.clientX - state.startX) * scaleX
  const dy = (event.clientY - state.startY) * scaleY

  if (state.mode === 'move') {
    item.x = Math.round(Math.min(Math.max(state.origin.x + dx, 0), draft.value.width - item.width))
    item.y = Math.round(Math.min(Math.max(state.origin.y + dy, 0), draft.value.height - item.height))
    return
  }

  item.width = Math.round(Math.min(Math.max(state.origin.width + dx, 24), draft.value.width - item.x))
  item.height = Math.round(Math.min(Math.max(state.origin.height + dy, 24), draft.value.height - item.y))
}

function stopDrag() {
  dragState = null
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', stopDrag)
  window.removeEventListener('pointercancel', stopDrag)
}

async function applyInstructionLayout(): Promise<MossLayout | null> {
  const text = instruction.value.trim()
  if (!text || busy.value) return null

  busy.value = true
  errorMessage.value = ''
  try {
    const next = await editMossLayout({ layout: draft.value, instruction: text })
    draft.value = next
    instruction.value = ''
    if (!next.items.some((item) => item.id === selectedId.value)) {
      selectedId.value = next.items[0]?.id ?? null
    }
    return next
  } catch (error) {
    errorMessage.value = normalizeErrorMessage(error, 'AI 更新布局失败，请稍后重试。')
    return null
  } finally {
    busy.value = false
  }
}

async function applyInstruction() {
  if (busy.value) return
  await applyInstructionLayout()
}

async function regenerate() {
  if (busy.value || props.generating) return
  // 自然语言框里还有没应用的指令时，先执行它再出图，避免用户以为输入已生效。
  if (instruction.value.trim()) {
    const next = await applyInstructionLayout()
    if (!next) return
  }
  emit('regenerate', cloneLayout(draft.value))
}

/** 改动未应用时关闭前二次确认，避免用户误以为已经生成。 */
function requestClose() {
  if (dirty.value) {
    const ok = window.confirm('布局已修改但还没重新生成，关闭会放弃这些修改。确定关闭吗？')
    if (!ok) return
  }
  emit('close')
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') requestClose()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  stopDrag()
})
</script>

<style scoped>
.layer-editor-mask {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(4, 4, 5, 0.72);
  backdrop-filter: blur(10px);
}

.layer-editor {
  display: flex;
  flex-direction: column;
  width: min(1280px, 100%);
  height: min(860px, 100%);
  overflow: hidden;
  border: 1px solid rgba(217, 205, 184, 0.18);
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(22, 20, 17, 0.98), rgba(11, 10, 9, 0.98));
  color: rgba(255, 255, 255, 0.9);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.55);
}

.editor-head {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 18px 22px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.head-text h2 {
  margin: 0 0 6px;
  font-size: 17px;
  font-weight: 600;
}

.head-text p {
  margin: 0;
  max-width: 760px;
  font-size: 12px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.55);
}

.close-btn {
  margin-left: auto;
  width: 32px;
  height: 32px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.editor-body {
  display: flex;
  min-height: 0;
  flex: 1;
}

.stage {
  position: relative;
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background:
    radial-gradient(circle at 50% 0%, rgba(217, 205, 184, 0.09), transparent 60%),
    rgba(8, 8, 8, 0.55);
}

.stage-badge {
  position: absolute;
  top: 12px;
  left: 50%;
  z-index: 3;
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(246, 196, 83, 0.92);
  color: #241a06;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  transform: translateX(-50%);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
}

/* 画布容器必须与图片尺寸完全一致，否则 bbox 百分比定位会和图片错位。 */
.canvas-wrap {
  position: relative;
  display: block;
  flex: 0 0 auto;
  width: fit-content;
  height: fit-content;
  max-width: 100%;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.4);
  touch-action: none;
}

.canvas-wrap img {
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: calc(min(860px, 100vh - 40px) - 140px);
  user-select: none;
  -webkit-user-drag: none;
}

.bbox {
  position: absolute;
  border: 1.5px solid var(--layer-color, #f6c453);
  background: color-mix(in srgb, var(--layer-color, #f6c453) 12%, transparent);
  cursor: move;
  transition: background 0.15s ease, box-shadow 0.15s ease;
}

.bbox.background {
  cursor: default;
  border-color: rgba(255, 255, 255, 0.38);
  border-style: dashed;
  background: transparent;
}

.bbox.background.selected {
  background: transparent;
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.32);
}

.bbox.selected {
  background: color-mix(in srgb, var(--layer-color, #f6c453) 22%, transparent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--layer-color, #f6c453) 45%, transparent);
  z-index: 2;
}

.bbox-label {
  position: absolute;
  top: -22px;
  left: -1px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 220px;
  padding: 2px 7px;
  overflow: hidden;
  border-radius: 6px 6px 6px 0;
  background: var(--layer-color, #f6c453);
  color: rgba(10, 10, 10, 0.92);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.5;
  white-space: nowrap;
  text-overflow: ellipsis;
  pointer-events: none;
}

.bbox-label em {
  padding: 0 4px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.18);
  font-style: normal;
}

/* 贴近画布顶部的图层把标签放进框内，避免被裁切。 */
.bbox.label-inside .bbox-label {
  top: 0;
  border-radius: 0 6px 6px 0;
}

.resize-handle {
  position: absolute;
  right: -5px;
  bottom: -5px;
  width: 11px;
  height: 11px;
  border: 1.5px solid rgba(10, 10, 10, 0.85);
  border-radius: 3px;
  background: var(--layer-color, #f6c453);
  cursor: nwse-resize;
}

.side {
  display: flex;
  flex-direction: column;
  width: 360px;
  flex: 0 0 360px;
  min-height: 0;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

/* 面板区独立滚动，底部操作按钮始终可见。 */
.side-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.panel-block {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.panel-title {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.78);
}

.hint-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.42);
}

.panel-hint {
  margin: 8px 0 0;
  color: rgba(255, 255, 255, 0.38);
  font-size: 11px;
  line-height: 1.5;
}

.ghost-btn {
  padding: 5px 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.75);
  font-size: 12px;
  cursor: pointer;
}

.ghost-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.layer-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 180px;
  overflow-y: auto;
}

.layer-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 8px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.layer-row:hover {
  background: rgba(255, 255, 255, 0.07);
}

.layer-row.active {
  border-color: rgba(246, 196, 83, 0.55);
  background: rgba(246, 196, 83, 0.1);
}

.layer-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  border-radius: 7px;
  color: rgba(10, 10, 10, 0.9);
  font-size: 11px;
  font-weight: 700;
}

.layer-meta {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1px;
}

.layer-kind {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
}

.layer-caption {
  overflow: hidden;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.layer-caption.missing {
  color: #f6ad55;
  font-style: italic;
}

.layer-remove {
  margin-left: auto;
  padding: 2px 6px;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.35);
  font-size: 11px;
}

.layer-remove:hover {
  background: rgba(248, 113, 113, 0.18);
  color: #fca5a5;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
}

.field em {
  margin-left: 6px;
  color: rgba(255, 255, 255, 0.32);
  font-style: normal;
}

.field select,
.field input,
.field textarea,
.ai-block textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 9px;
  background: rgba(0, 0, 0, 0.28);
  color: rgba(255, 255, 255, 0.88);
  font-size: 12px;
  font-family: inherit;
  line-height: 1.5;
  resize: vertical;
}

.field select:focus,
.field input:focus,
.field textarea:focus,
.ai-block textarea:focus {
  outline: none;
  border-color: rgba(246, 196, 83, 0.5);
}

.coord-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.coord-grid label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.45);
}

.ai-btn {
  width: 100%;
  margin-top: 8px;
  padding: 9px 12px;
  border: 1px solid rgba(246, 196, 83, 0.4);
  border-radius: 10px;
  background: rgba(246, 196, 83, 0.12);
  color: #f6e3b0;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.ai-btn:hover:not(:disabled) {
  background: rgba(246, 196, 83, 0.2);
}

.ai-btn:disabled,
.primary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-text {
  margin: 8px 0 0;
  color: #fca5a5;
  font-size: 11px;
  line-height: 1.5;
}

.editor-foot {
  flex: 0 0 auto;
  padding: 12px 16px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: linear-gradient(180deg, rgba(18, 17, 15, 0.92), rgba(12, 11, 10, 0.98));
}

.foot-note {
  margin: 0 0 10px;
  color: rgba(255, 255, 255, 0.38);
  font-size: 11px;
  line-height: 1.5;
}

.foot-dirty {
  margin: 0 0 10px;
  color: #f6d98a;
  font-size: 11px;
  line-height: 1.5;
}

.foot-warn {
  margin: 0 0 8px;
  color: #f6ad55;
  font-size: 11px;
  line-height: 1.5;
}

.foot-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.primary-btn {
  padding: 9px 16px;
  border: 0;
  border-radius: 10px;
  background: linear-gradient(135deg, #f6d98a, #e0a83a);
  color: #241a06;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

@media (max-width: 1100px) {
  .side {
    width: 320px;
    flex-basis: 320px;
  }
}

@media (max-width: 820px) {
  .layer-editor-mask {
    padding: 0;
  }

  .layer-editor {
    width: 100%;
    height: 100%;
    border-radius: 0;
  }

  .editor-body {
    flex-direction: column;
  }

  .stage {
    flex: none;
    height: auto;
  }

  .canvas-wrap img {
    max-height: 42vh;
  }

  .side {
    width: 100%;
    flex: 1;
    border-left: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
}
</style>
