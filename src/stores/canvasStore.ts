import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  addEdge,
  applyEdgeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from '@vue-flow/core'

import { chatCompletion, generateImage, generateVideo, polishPrompt } from '@/api/aiping'
import { buildImageParams, buildVideoParams } from '@/features/generate/buildParams'
import type { UploadInput } from '@/features/generate/buildParams'

import { pollVideoStatus } from '@/features/generate/video'
import { buildEffectivePrompt } from '@/features/skill/apply'
import { getModelCapability, getSupportedVideoModes } from '@/types/model'
import type { VideoGenerationMode } from '@/types/model'

import { buildTextExtraBody, getTextModelModule } from '@/models'
import {
  getNodeKindDef,
  isGenerationNodeType,
  type CanvasNodeKind,
} from '@/components/canvas/nodes/nodeKinds'


import {
  useSettingsStore,
  DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
  DEFAULT_TEXT_SYSTEM_PROMPT,
  DEFAULT_IMAGE_SYSTEM_PROMPT,
  DEFAULT_VIDEO_SYSTEM_PROMPT,
  DEFAULT_EXPAND_SYSTEM_PROMPT,
  EXPAND_IMAGE_INSTRUCTION,
} from '@/stores/settingsStore'




import { normalizeErrorMessage } from '@/utils/errors'
import type { ChatMessage, ChatMessageContentPart } from '@/types/api'
import type { UploadedFile } from '@/types/chat'

// CanvasNodeKind 现在统一在 @/components/canvas/nodes/nodeKinds 中定义，
// 此处 re-export 以兼容既有从 canvasStore 引入该类型的调用方。
export type { CanvasNodeKind }
export type CanvasNodeRunStatus = 'idle' | 'running' | 'completed' | 'failed'



export interface CanvasNodeData {
  label: string
  nodeKind?: CanvasNodeKind
  prompt?: string
  model?: string | null
  // group：分组主题色（groupNode 专用），取值见 GROUP_COLORS
  groupColor?: string
  // image
  imageMode?: 'text2image' | 'image2image'
  aspectRatio?: string
  // video
  videoMode?: VideoGenerationMode
  duration?: number
  // 视频分辨率档位（当前仅 MiniMax-H3 使用：768P / 2K）。
  resolution?: string
  // Kling 系列「是否生成声音」：true 生成带声音的视频（audio=native），false 无声音（默认）。
  klingSound?: boolean

  // reference image (data url), used by image2image / image2video / subjectReference2video
  referenceImage?: string
  referenceFileName?: string
  // 首尾帧生视频（startEnd2video）：首帧 / 尾帧图片（data url）
  startFrameImage?: string
  startFrameName?: string
  endFrameImage?: string
  endFrameName?: string
  // 动作控制（motionControl2video）：参考图像 + 参考视频（data url）及选项
  motionImage?: string
  motionImageName?: string
  motionVideo?: string
  motionVideoName?: string
  motionKeepOriginalSound?: 'yes' | 'no'
  motionCharacterOrientation?: 'image' | 'video'
  // 多模态参考（multimodalReference2video, Seedance 2.0）：
  // 图片 0~9 / 视频 0~3 / 音频 0~3，均以 data url 存储。
  multimodalImages?: string[]
  multimodalVideos?: string[]
  multimodalAudios?: string[]
  // 编辑视频（editVideo, Seedance 2.0）：待编辑视频 + 替换图片（data url）
  editVideoUrl?: string
  editVideoName?: string
  editImageUrl?: string
  editImageName?: string
  polish?: boolean


  // 每个节点自定义的 AI 润色系统提示词（可在节点“设置”里编辑）。
  // 为空时回退到该类型的默认系统提示词。
  systemPrompt?: string

  // 文本节点：润色进行中（供“润色”按钮显示 loading，与整体运行状态区分）
  polishing?: boolean
  // 文本节点上传的 Skill 规范（.md 原文），会随链路传播到图片/视频生成。
  skillContent?: string
  skillName?: string
  // runtime state
  status?: CanvasNodeRunStatus

  progress?: number
  error?: string
  // results
  resultText?: string
  resultUrl?: string
  resultType?: CanvasNodeKind
}

export interface CanvasNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: CanvasNodeData
  selected?: boolean
  parentNode?: string
  extent?: 'parent'
  style?: Record<string, string>
  dimensions?: { width: number; height: number }
  [key: string]: unknown
}

export interface CanvasEdge {
  id: string
  source: string
  target: string
  type?: string
  selected?: boolean
  [key: string]: unknown
}

interface GraphSnapshot {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

const HISTORY_LIMIT = 100


// 5 种可选分组主题色（用于边框 / 标题 / 背景着色）

export interface GroupColorOption {
  key: string
  label: string
  color: string
}

export const GROUP_COLORS: GroupColorOption[] = [
  { key: 'blue', label: '蓝色', color: '#0a84ff' },
  { key: 'purple', label: '紫色', color: '#bf5af2' },
  { key: 'green', label: '绿色', color: '#30d158' },
  { key: 'orange', label: '橙色', color: '#ff9f0a' },
  { key: 'pink', label: '粉色', color: '#ff375f' },
]

export const DEFAULT_GROUP_COLOR = GROUP_COLORS[0].color


function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function cloneGraph(nodes: CanvasNode[], edges: CanvasEdge[]): GraphSnapshot {
  // 注意：这里的 nodes / edges 通常来源于 Vue 的响应式 ref，元素是 reactive Proxy，
  // structuredClone 无法克隆 Proxy 对象（会抛 DataCloneError），
  // 因此统一使用 JSON 序列化做深拷贝，可安全解除响应式引用。
  const snapshot: GraphSnapshot = { nodes, edges }
  return JSON.parse(JSON.stringify(snapshot)) as GraphSnapshot
}


export const useCanvasStore = defineStore('canvas', () => {
  const nodes = ref<CanvasNode[]>([])
  const edges = ref<CanvasEdge[]>([])
  const nextNodeId = ref(1)
  const nextGroupId = ref(1)
  const clipboard = ref<GraphSnapshot | null>(null)
  const historyPast = ref<GraphSnapshot[]>([])
  const historyFuture = ref<GraphSnapshot[]>([])

  // 运行引擎状态
  const isRunning = ref(false)
  const runProgress = ref(0)
  const runTotal = ref(0)
  const runDone = ref(0)
  const runningNodeId = ref<string | null>(null)
  // 当前正在运行的分组 id（用于分组“运行”按钮显示 loading）
  const runningGroupId = ref<string | null>(null)


  function commitHistory() {
    const snapshot = cloneGraph(nodes.value, edges.value)
    historyPast.value = [...historyPast.value, snapshot].slice(-HISTORY_LIMIT)
    historyFuture.value = []
  }

  function onNodesChange(changes: NodeChange[]) {
    // 说明：不能直接使用 VueFlow 的 applyNodeChanges。因为它内部的 applyChanges
    // 只有在元素是「graph node」（带 computedPosition 字段）时才会写回 position。
    // 而我们外部 store 中的节点是普通对象（没有 computedPosition），导致拖拽产生的
    // 位置变更永远不会同步回 store。这样一旦触发 VueFlow 用外部 nodes 重建内部状态
    // （例如新增节点使 nodes 数组长度变化），就会用 store 里的旧 position 覆盖，
    // 造成“所有节点跳回原点”。
    //
    // 因此这里手动处理各类变更，并就地写回 nodes.value，保证 store 位置与视图一致。
    for (const change of changes) {
      switch (change.type) {
        case 'position': {
          const node = nodes.value.find((n) => n.id === change.id)
          if (node && change.position) {
            node.position = { x: change.position.x, y: change.position.y }
          }
          break
        }
        case 'dimensions': {
          const node = nodes.value.find((n) => n.id === change.id)
          if (node && change.dimensions) {
            node.dimensions = { ...change.dimensions }
          }
          break
        }
        case 'select': {
          const node = nodes.value.find((n) => n.id === change.id)
          if (node) node.selected = change.selected
          break
        }
        case 'remove': {
          const index = nodes.value.findIndex((n) => n.id === change.id)
          if (index !== -1) nodes.value.splice(index, 1)
          break
        }
        case 'add': {
          if (!nodes.value.some((n) => n.id === change.item.id)) {
            nodes.value.push(change.item as unknown as CanvasNode)
          }
          break
        }
      }
    }
  }


  function onEdgesChange(changes: EdgeChange[]) {
    edges.value = applyEdgeChanges(changes, edges.value as any) as unknown as CanvasEdge[]
  }

  function onConnect(connection: Connection) {
    commitHistory()
    edges.value = addEdge({ ...connection, type: 'default' }, edges.value as any) as unknown as CanvasEdge[]
  }

  function addNode(position?: { x: number; y: number }) {
    commitHistory()
    const id = generateId('node')
    const label = `节点 ${nextNodeId.value}`
    const node: CanvasNode = {
      id,
      type: 'basicNode',
      position: position ?? {
        x: 120 + (nextNodeId.value % 6) * 40,
        y: 120 + (nextNodeId.value % 6) * 40,
      },
      data: { label },
    }
    // 就地追加，避免替换整个数组导致 VueFlow 用旧 position 重置所有已存在节点。
    nodes.value.push(node)
    nextNodeId.value += 1
  }


  // 创建生成型节点（文本/图片/扩图/视频）。
  // 节点的标题、VueFlow type、默认 data 字段全部来自节点注册表（nodeKinds），
  // 因此新增节点类型时无需修改本函数，只需在注册表中追加一条配置。
  function addGenerationNode(kind: CanvasNodeKind, position?: { x: number; y: number }) {
    commitHistory()
    const id = generateId('node')
    const def = getNodeKindDef(kind)
    const data: CanvasNodeData = {
      label: def.label,
      nodeKind: kind,
      prompt: '',
      model: null,
      status: 'idle',
      // 该类型节点的默认字段（模型 / 模式 / 比例 / 时长 / 润色开关等）
      ...def.createData(),
    }

    const node: CanvasNode = {
      id,
      type: def.vueFlowType,
      position: position ?? {
        x: 160 + (nextNodeId.value % 6) * 48,
        y: 140 + (nextNodeId.value % 6) * 48,
      },
      data,
    }

    // 就地追加，避免替换整个数组导致 VueFlow 用旧 position 重置所有已存在节点。
    nodes.value.push(node)
    nextNodeId.value += 1
    return id
  }


  function updateNodeLabel(id: string, label: string) {
    // 就地更新 data，保持节点对象引用与 position 不变，避免 VueFlow 因节点引用
    // 变化而用旧的 position 重新初始化，导致节点“跳回”原点。
    const node = nodes.value.find((n) => n.id === id)
    if (!node) return
    node.data.label = label
  }

  // 更新生成型节点的任意 data 字段
  function updateNodeData(id: string, updates: Partial<CanvasNodeData>) {
    // 就地更新 data（不替换整个节点对象），从而保留节点当前位置。
    const node = nodes.value.find((n) => n.id === id)
    if (!node) return
    Object.assign(node.data, updates)
  }


  function removeSelected() {
    const selectedNodeIds = new Set(
      nodes.value.filter((node) => node.selected).map((node) => node.id),
    )
    const selectedEdgeIds = new Set(
      edges.value.filter((edge) => edge.selected).map((edge) => edge.id),
    )
    if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0) return

    commitHistory()
    nodes.value = nodes.value.filter((node) => !selectedNodeIds.has(node.id))
    edges.value = edges.value.filter(
      (edge) =>
        !selectedEdgeIds.has(edge.id) &&
        !selectedNodeIds.has(edge.source) &&
        !selectedNodeIds.has(edge.target),
    )
  }

  function removeNode(id: string) {
    commitHistory()
    nodes.value = nodes.value.filter((node) => node.id !== id)
    edges.value = edges.value.filter((edge) => edge.source !== id && edge.target !== id)
  }

  function duplicateSelected() {
    const selected = nodes.value.filter(
      (node) => node.selected && node.type !== 'groupNode',
    )
    if (selected.length === 0) return

    commitHistory()
    const clones: CanvasNode[] = selected.map((node) => ({
      ...cloneGraph([node], []).nodes[0],
      id: generateId('node'),
      position: { x: node.position.x + 40, y: node.position.y + 40 },
      selected: false,
    }))
    nodes.value = [...nodes.value, ...clones]
  }

  function copySelected() {
    const selectedNodes = nodes.value.filter((node) => node.selected)
    if (selectedNodes.length === 0) {
      clipboard.value = null
      return
    }
    const selectedIds = new Set(selectedNodes.map((node) => node.id))
    const relatedEdges = edges.value.filter(
      (edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target),
    )
    clipboard.value = cloneGraph(selectedNodes, relatedEdges)
  }

  function pasteFromClipboard() {
    if (!clipboard.value || clipboard.value.nodes.length === 0) return

    commitHistory()
    const idMap = new Map<string, string>()
    const pastedNodes: CanvasNode[] = clipboard.value.nodes.map((node) => {
      const nextId = generateId('node')
      idMap.set(node.id, nextId)
      return {
        ...node,
        id: nextId,
        position: { x: node.position.x + 48, y: node.position.y + 48 },
        selected: true,
      }
    })
    const pastedEdges: CanvasEdge[] = clipboard.value.edges.map((edge) => ({
      ...edge,
      id: generateId('edge'),
      source: idMap.get(edge.source) ?? edge.source,
      target: idMap.get(edge.target) ?? edge.target,
      selected: false,
    }))
    const deselectedNodes = nodes.value.map((node) =>
      node.selected ? { ...node, selected: false } : node,
    )
    nodes.value = [...deselectedNodes, ...pastedNodes]
    edges.value = [...edges.value, ...pastedEdges]
  }

  function groupSelected() {
    const selected = nodes.value.filter(
      (node) => node.selected && node.type !== 'groupNode' && !node.parentNode,
    )
    if (selected.length < 1) return

    commitHistory()
    const padding = 32
    // 顶部标题栏高度：为标题/按钮预留空间，避免子节点压住工具条
    const headerHeight = 16
    const minX = Math.min(...selected.map((node) => node.position.x))
    const minY = Math.min(...selected.map((node) => node.position.y))
    const maxX = Math.max(
      ...selected.map((node) => node.position.x + (node.dimensions?.width || 260)),
    )
    const maxY = Math.max(
      ...selected.map((node) => node.position.y + (node.dimensions?.height || 120)),
    )

    const groupWidth = Math.round(maxX - minX + padding * 2)
    const groupHeight = Math.round(maxY - minY + padding * 2 + headerHeight)
    const groupX = minX - padding
    const groupY = minY - padding - headerHeight

    const groupId = `group-${nextGroupId.value}`
    const groupNode: CanvasNode = {
      id: groupId,
      type: 'groupNode',
      position: { x: groupX, y: groupY },
      data: { label: `分组 ${nextGroupId.value}`, groupColor: DEFAULT_GROUP_COLOR },
      // 同时提供 style 与 dimensions：VueFlow 计算子节点 extent='parent'
      // 依赖父节点尺寸，缺失 dimensions 会导致子节点定位异常（Ctrl+G 位置错乱）。
      style: {
        width: `${groupWidth}px`,
        height: `${groupHeight}px`,
      },
      dimensions: { width: groupWidth, height: groupHeight },
      selected: false,
    }

    const selectedIds = new Set(selected.map((node) => node.id))
    // 就地更新选中节点的父子关系与相对坐标，保留节点对象引用，避免整体替换
    // nodes 数组触发 VueFlow 重建导致的位置重置/闪跳。
    nodes.value.forEach((node) => {
      if (!selectedIds.has(node.id)) return
      node.parentNode = groupId
      node.extent = 'parent'
      node.selected = false
      node.position = {
        x: node.position.x - groupX,
        y: node.position.y - groupY,
      }
    })

    // VueFlow 要求父节点在数组中位于子节点之前，故插入到数组头部。
    nodes.value.unshift(groupNode)
    nextGroupId.value += 1
  }


  // 更新分组主题色
  function updateGroupColor(groupId: string, color: string) {
    const group = nodes.value.find(
      (node) => node.id === groupId && node.type === 'groupNode',
    )
    if (!group) return
    group.data.groupColor = color
  }

  // 取分组内的所有子节点 id（parentNode 指向该分组）
  function getGroupChildIds(groupId: string): string[] {
    return nodes.value
      .filter((node) => node.parentNode === groupId)
      .map((node) => node.id)
  }

  function ungroup(groupId: string) {

    const group = nodes.value.find(
      (node) => node.id === groupId && node.type === 'groupNode',
    )
    if (!group) return

    commitHistory()
    nodes.value = nodes.value
      .filter((node) => node.id !== groupId)
      .map((node) => {
        if (node.parentNode !== groupId) return node
        const { parentNode: _parentNode, extent: _extent, ...rest } = node
        return {
          ...rest,
          position: {
            x: node.position.x + group.position.x,
            y: node.position.y + group.position.y,
          },
        } as CanvasNode
      })
  }

  function selectAll() {
    nodes.value = nodes.value.map((node) => ({ ...node, selected: true }))
  }

  function clearSelection() {
    nodes.value = nodes.value.map((node) =>
      node.selected ? { ...node, selected: false } : node,
    )
    edges.value = edges.value.map((edge) =>
      edge.selected ? { ...edge, selected: false } : edge,
    )
  }

  function undo() {
    if (historyPast.value.length === 0) return
    const previous = historyPast.value[historyPast.value.length - 1]
    const current = cloneGraph(nodes.value, edges.value)
    nodes.value = previous.nodes
    edges.value = previous.edges
    historyPast.value = historyPast.value.slice(0, -1)
    historyFuture.value = [current, ...historyFuture.value].slice(0, HISTORY_LIMIT)
  }

  function redo() {
    if (historyFuture.value.length === 0) return
    const next = historyFuture.value[0]
    const current = cloneGraph(nodes.value, edges.value)
    nodes.value = next.nodes
    edges.value = next.edges
    historyPast.value = [...historyPast.value, current].slice(-HISTORY_LIMIT)
    historyFuture.value = historyFuture.value.slice(1)
  }

  function reset() {
    commitHistory()
    nodes.value = []
    edges.value = []
  }

  // ============ 生成引擎 ============

  const generationNodes = computed(() =>
    nodes.value.filter((node) => isGenerationNodeType(node.type)),
  )



  const hasGenerationNodes = computed(() => generationNodes.value.length > 0)

  /**
   * 依据连线做拓扑排序，从左到右决定执行顺序。
   * 无连线的节点按 x 坐标从左到右排序。
   * 可传入 subsetIds 仅对指定节点子集（如某个分组内的节点）排序。
   */
  function resolveExecutionOrder(subsetIds?: Set<string>): string[] {
    const genNodes = subsetIds
      ? generationNodes.value.filter((node) => subsetIds.has(node.id))
      : generationNodes.value
    const genIds = new Set(genNodes.map((node) => node.id))


    // 仅保留生成型节点之间的连线
    const relevantEdges = edges.value.filter(
      (edge) => genIds.has(edge.source) && genIds.has(edge.target),
    )

    const indegree = new Map<string, number>()
    const adjacency = new Map<string, string[]>()
    genNodes.forEach((node) => {
      indegree.set(node.id, 0)
      adjacency.set(node.id, [])
    })
    relevantEdges.forEach((edge) => {
      adjacency.get(edge.source)!.push(edge.target)
      indegree.set(edge.target, (indegree.get(edge.target) || 0) + 1)
    })

    const nodeById = new Map(genNodes.map((node) => [node.id, node]))
    // 按 x 坐标排序作为同层的稳定次序（从左到右）
    const byX = (a: string, b: string) =>
      (nodeById.get(a)?.position.x ?? 0) - (nodeById.get(b)?.position.x ?? 0)

    // Kahn 拓扑排序，队列每次取当前入度为 0 中最靠左的
    const order: string[] = []
    const available = genNodes.filter((node) => (indegree.get(node.id) || 0) === 0).map((n) => n.id)
    available.sort(byX)

    while (available.length > 0) {
      const current = available.shift()!
      order.push(current)
      const neighbors = [...(adjacency.get(current) || [])].sort(byX)
      for (const next of neighbors) {
        indegree.set(next, (indegree.get(next) || 0) - 1)
        if ((indegree.get(next) || 0) === 0) {
          available.push(next)
        }
      }
      available.sort(byX)
    }

    // 若存在环，未处理的节点按 x 追加到末尾
    if (order.length < genNodes.length) {
      const remaining = genNodes
        .map((n) => n.id)
        .filter((id) => !order.includes(id))
        .sort(byX)
      order.push(...remaining)
    }

    return order
  }

  // 找到某节点的「直接上游」生成型节点（仅一跳）
  function getUpstreamNodeIds(nodeId: string): string[] {
    return edges.value.filter((edge) => edge.target === nodeId).map((edge) => edge.source)
  }

  // 递归找到某节点的「所有上游祖先」节点（多跳，用于跨节点传播文本 / 图片）。
  // 例如 文本→图片→视频 链路中，视频节点可借此拿到最上游文本节点的结果。
  // 返回顺序：距离当前节点由近到远（BFS）。带环保护。
  function getAncestorNodeIds(nodeId: string): string[] {
    const result: string[] = []
    const visited = new Set<string>([nodeId])
    const queue: string[] = [nodeId]
    while (queue.length > 0) {
      const current = queue.shift()!
      const parents = edges.value
        .filter((edge) => edge.target === current)
        .map((edge) => edge.source)
      for (const parent of parents) {
        if (!visited.has(parent)) {
          visited.add(parent)
          result.push(parent)
          queue.push(parent)
        }
      }
    }
    return result
  }


  async function maybePolish(prompt: string, systemPrompt?: string): Promise<string> {
    const settingsStore = useSettingsStore()
    const model = settingsStore.promptPolishModel.trim()
    if (!model) return prompt
    // 优先使用节点自定义的系统提示词，其次是全局设置，最后回退到内置默认。
    const finalSystemPrompt =
      (systemPrompt || '').trim() ||
      settingsStore.promptPolishSystemPrompt.trim() ||
      DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT
    try {
      return await polishPrompt({
        model,
        messages: [
          {
            role: 'system',
            content: finalSystemPrompt,
          },
          { role: 'user', content: prompt },
        ],
      })
    } catch {
      return prompt
    }
  }


  // 文本节点：用所选文本模型对 prompt 进行润色。
  // 系统提示词沿用文本节点系统提示词（默认包含“文本创作、扩写与润色”定位），
  // 视觉模型且携带参考图时走多模态 content。
  async function polishTextWith(
    model: string,
    prompt: string,
    referenceImage?: string,
    nodeSystemPrompt?: string,
  ): Promise<string> {
    const settingsStore = useSettingsStore()
    // 优先使用节点自定义系统提示词，其次是全局设置，最后回退到内置默认。
    const systemPrompt =
      (nodeSystemPrompt || '').trim() ||
      settingsStore.textSystemPrompt.trim() ||
      DEFAULT_TEXT_SYSTEM_PROMPT

    const textModel = getTextModelModule(model)
    const userMessage: ChatMessage =
      textModel?.supportsVision && referenceImage
        ? {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: referenceImage } },
            { type: 'text', text: prompt },
          ] as ChatMessageContentPart[],
        }
        : { role: 'user', content: prompt }
    return await chatCompletion({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        userMessage,
      ],
      extra_body: buildTextExtraBody(model),
    })
  }

  // 文本节点“润色”按钮：对当前输入框（prompt）的文字进行 AI 润色，
  // 结果写入「发送框」（resultText）而非覆盖输入框：
  //  - 输入框（prompt）保留用户原始创作内容，可反复润色；
  //  - 发送框（resultText）即下游节点实际接收到的内容，用户可在其上继续手动修改。
  async function polishTextNode(nodeId: string) {
    const node = nodes.value.find((n) => n.id === nodeId)
    if (!node || node.data.nodeKind !== 'text') return
    if (node.data.polishing) return

    const model = node.data.model
    if (!model) {
      updateNodeData(nodeId, { error: '请先选择润色模型。' })
      return
    }
    const prompt = (node.data.prompt || '').trim()
    if (!prompt) {
      updateNodeData(nodeId, { error: '请先输入需要润色的文字。' })
      return
    }

    updateNodeData(nodeId, { polishing: true, error: undefined })
    try {
      const polished = await polishTextWith(model, prompt, undefined, node.data.systemPrompt)
      // 润色结果写入发送框（resultText），供下游节点消费；用户可继续修改发送框内容。
      updateNodeData(nodeId, {
        resultText: polished,
        resultType: 'text',
        status: 'completed',
      })
    } catch (error) {
      updateNodeData(nodeId, { error: normalizeErrorMessage(error, '润色失败，请重试') })
    } finally {
      updateNodeData(nodeId, { polishing: false })
    }
  }


  async function executeNode(nodeId: string) {
    const node = nodes.value.find((n) => n.id === nodeId)
    if (!node) return
    const kind = node.data.nodeKind
    if (!kind) return

    runningNodeId.value = nodeId
    updateNodeData(nodeId, { status: 'running', progress: 0, error: undefined })

    try {
      // 收集上游上下文：

      // - 直接上游（一跳）：用于识别"最近的"图片输入作为参考图。
      // - 全部祖先（多跳）：用于把链路上所有文本节点的结果串联进 prompt，
      //   从而支持 文本→图片→视频 这类跨节点传播（视频节点仍能拿到最上游文本）。
      const upstreamIds = getUpstreamNodeIds(nodeId)
      const ancestorIds = getAncestorNodeIds(nodeId)
      const ancestorNodes = ancestorIds
        .map((uid) => nodes.value.find((n) => n.id === uid))
        .filter((n): n is CanvasNode => !!n)

      // 祖先文本按"由远到近"拼接，使距离当前节点更近的上下文排在后面（更贴近本步意图）。
      const upstreamTexts = ancestorNodes
        .filter((n) => n.data.nodeKind === 'text' && !!n.data.resultText)
        .map((n) => n.data.resultText as string)
        .reverse()

      const upstreamSkills = ancestorNodes
        .filter((n) => n.data.nodeKind === 'text' && !!n.data.skillContent)
        .map((n) => n.data.skillContent as string)
        .reverse()

      let prompt = (node.data.prompt || '').trim()
      if (upstreamTexts.length > 0) {
        prompt = [...upstreamTexts, prompt].filter(Boolean).join('\n')
      }

      // image / video 参考图：优先取本节点手动上传的参考图；
      // 否则取"最近的"上游图片结果（先看直接上游，再回退到更远的祖先）。
      let referenceFile: UploadedFile | null = null
      const findImageUrl = (ids: string[]) =>
        ids
          .map((uid) => nodes.value.find((n) => n.id === uid))
          .find((n) => n?.data.resultType === 'image' && n?.data.resultUrl)?.data.resultUrl
      const upstreamImageUrl = findImageUrl(upstreamIds) || findImageUrl(ancestorIds)
      const referenceImage = node.data.referenceImage || upstreamImageUrl

      // prompt 边界：若没有任何可用输入（既无 prompt 文本，也无参考图），才判定为"没有输入"。
      // 有上游图片时（如 图片→视频），即使 prompt 为空也允许继续运行。
      if (!prompt && !referenceImage) {
        throw new Error('请输入内容或连接可用的上游节点后再运行。')
      }


      if (kind === 'text') {
        // 关闭 AI 润色：文本节点不调用模型，直接把用户输入（含上游文本）透传给下游节点。
        if (!node.data.polish) {
          updateNodeData(nodeId, {
            status: 'completed',
            progress: 100,
            resultText: prompt,
            resultType: 'text',
          })
          return
        }

        // 开启 AI 润色：用所选文本模型对 prompt 润色，结果作为本节点输出向下游传播。
        const model = node.data.model
        if (!model) throw new Error('请先选择润色模型。')

        const text = await polishTextWith(model, prompt, referenceImage, node.data.systemPrompt)
        updateNodeData(nodeId, {
          status: 'completed',
          progress: 100,
          resultText: text,
          resultType: 'text',
        })
        return
      }

      const hasDirectTextUpstream =
        (kind === 'image' || kind === 'video') &&
        upstreamIds.some((uid) => nodes.value.find((n) => n.id === uid)?.data.nodeKind === 'text')
      const ownSkillContent = hasDirectTextUpstream ? '' : node.data.skillContent?.trim()
      const skillContent = ownSkillContent || upstreamSkills.join('\n\n')
      if (skillContent) {
        prompt = await buildEffectivePrompt(prompt, skillContent)
      }



      if (kind === 'image') {
        const model = node.data.model
        if (!model) throw new Error('请先选择图片模型。')
        const isImage2Image = node.data.imageMode === 'image2image'
        // 图生图模式必须要有参考图（手动上传或上游图片）。
        if (isImage2Image && !referenceImage) {
          throw new Error('图生图模式需要上传参考图片，或连接一个已生成图片的上游节点。')
        }
        // 只要存在参考图（含上游连线传入的图片），即作为参考图使用；
        // 上游图片是明确的连接意图，即便当前是"文生图"模式也一并消费。
        if (referenceImage) {
          referenceFile = {
            name: node.data.referenceFileName || 'reference',
            type: 'image',
            url: referenceImage,
            size: 0,
          }
        }


        const finalPrompt = node.data.polish
          ? await maybePolish(prompt, node.data.systemPrompt || DEFAULT_IMAGE_SYSTEM_PROMPT)
          : prompt
        const capability = getModelCapability(model)
        const params = await buildImageParams(


          finalPrompt,
          model,
          referenceFile,
          node.data.aspectRatio || '1:1',
          capability?.imageRequestMode,
        )
        const result = await generateImage(params)
        const url = result.data?.[0]?.url
        if (!url) throw new Error('图片生成完成但未返回有效地址。')
        updateNodeData(nodeId, {
          status: 'completed',
          progress: 100,
          resultUrl: url,
          resultType: 'image',
        })
        return
      }


      if (kind === 'expand') {
        // 扩图节点：本质是「保持原图不变、向外扩展」的图生图（outpainting）。
        // 必须存在参考图：用户在本节点上传，或连接一个已生成图片的上游图片节点。
        const model = node.data.model
        if (!model) throw new Error('请先选择图片模型。')
        if (!referenceImage) {
          throw new Error('扩图需要上传原始图片，或连接一个已生成图片的上游节点。')
        }

        // 作为参考图传入图片模型。
        referenceFile = {
          name: node.data.referenceFileName || 'reference',
          type: 'image',
          url: referenceImage,
          size: 0,
        }

        // 扩图提示词：始终以扩图指令为前缀，明确要求保持原图内容不变、仅向外扩展；
        // 用户自定义描述作为对新扩展区域的补充说明拼接在后面。
        // 开启 AI 润色时，用扩图系统提示词对「用户描述部分」做优化，再拼接扩图指令。
        const userPrompt = node.data.polish
          ? await maybePolish(prompt, node.data.systemPrompt || DEFAULT_EXPAND_SYSTEM_PROMPT)
          : prompt
        const finalPrompt = [EXPAND_IMAGE_INSTRUCTION, userPrompt].filter(Boolean).join('\n')

        const capability = getModelCapability(model)
        const params = await buildImageParams(
          finalPrompt,
          model,
          referenceFile,
          node.data.aspectRatio || '16:9',
          capability?.imageRequestMode,
        )
        const result = await generateImage(params)
        const url = result.data?.[0]?.url
        if (!url) throw new Error('扩图完成但未返回有效地址。')
        updateNodeData(nodeId, {
          status: 'completed',
          progress: 100,
          resultUrl: url,
          resultType: 'image',
        })
        return
      }

      // video

      const model = node.data.model
      if (!model) throw new Error('请先选择视频模型。')

      // 依据模型支持的模式，纠正/兜底当前节点选择的生成方式，
      // 避免切换模型后遗留不支持的模式（如从 MiniMax 切到普通模型仍停留在主体参考）。
      const supportedModes = getSupportedVideoModes(model).map((m) => m.value)
      const videoMode: VideoGenerationMode = supportedModes.includes(node.data.videoMode as VideoGenerationMode)
        ? (node.data.videoMode as VideoGenerationMode)
        : supportedModes[0] || 'text2video'

      // 依据不同生成方式组装视频请求的文件输入（buildVideoParams 支持单文件或文件数组）。
      let videoInput: UploadInput = null

      if (videoMode === 'multimodalReference2video') {
        // 多模态参考（Seedance 2.0）：图片 0~9 / 视频 0~3 / 音频 0~3 任意组合。
        // 注意：不支持「纯音频」或「文本 + 音频」。
        const images = node.data.multimodalImages || []
        const videos = node.data.multimodalVideos || []
        const audios = node.data.multimodalAudios || []
        // 若本节点未上传任何图片，但有上游图片结果，则将其作为一张参考图消费。
        const effectiveImages = images.length || videos.length ? images : referenceImage ? [referenceImage] : []
        const hasAnyMedia = effectiveImages.length + videos.length > 0
        if (!hasAnyMedia && audios.length > 0) {
          throw new Error('多模态参考不支持「纯音频」或「文本 + 音频」，请至少添加一张图片或一个视频。')
        }
        const files: UploadedFile[] = []
        effectiveImages.forEach((url, i) =>
          files.push({ name: `图片${i + 1}`, type: 'image', url, size: 0, purpose: 'multimodal-image' }),
        )
        videos.forEach((url, i) =>
          files.push({ name: `视频${i + 1}`, type: 'video', url, size: 0, purpose: 'multimodal-video' }),
        )
        audios.forEach((url, i) =>
          files.push({ name: `音频${i + 1}`, type: 'audio', url, size: 0, purpose: 'multimodal-audio' }),
        )
        videoInput = files.length ? files : null
      } else if (videoMode === 'editVideo') {
        // 编辑视频（Seedance 2.0）：待编辑视频 + 替换图片。
        const editVideoUrl = node.data.editVideoUrl
        const editImageUrl = node.data.editImageUrl
        if (!editVideoUrl || !editImageUrl) {
          throw new Error('编辑视频需要同时上传待编辑视频和替换图片。')
        }
        videoInput = [
          { name: node.data.editVideoName || '视频1', type: 'video', url: editVideoUrl, size: 0, purpose: 'multimodal-video' },
          { name: node.data.editImageName || '图片1', type: 'image', url: editImageUrl, size: 0, purpose: 'multimodal-image' },
        ]
      } else if (videoMode === 'startEnd2video') {
        // 首尾帧生视频：首帧必填，尾帧可选（仅首帧时等价于图生视频的起始帧）。
        const startFrame = node.data.startFrameImage
        const endFrame = node.data.endFrameImage
        if (!startFrame) {
          throw new Error('首尾帧生视频需要上传首帧图片，尾帧可选。')
        }
        const frameFiles: UploadedFile[] = [
          { name: node.data.startFrameName || 'first-frame', type: 'image', url: startFrame, size: 0, purpose: 'start-frame' },
        ]
        if (endFrame) {
          frameFiles.push({ name: node.data.endFrameName || 'end-frame', type: 'image', url: endFrame, size: 0, purpose: 'end-frame' })
        }
        videoInput = frameFiles
      } else if (videoMode === 'subjectReference2video') {

        // 主体参考视频：需要一张主体参考图（本节点上传或上游图片）。
        if (!referenceImage) {
          throw new Error('主体参考视频需要上传主体参考图片，或连接一个已生成图片的上游节点。')
        }
        videoInput = { name: 'Subject Reference', type: 'image', url: referenceImage, size: 0 }
      } else if (videoMode === 'motionControl2video') {
        // 动作控制：需要参考图像 + 参考视频。
        const motionImage = node.data.motionImage
        const motionVideo = node.data.motionVideo
        if (!motionImage || !motionVideo) {
          throw new Error('动作控制需要同时上传参考图像和参考视频。')
        }
        videoInput = [
          {
            name: node.data.motionImageName || 'motion-image',
            type: 'image',
            url: motionImage,
            size: 0,
            purpose: 'motion-control-image',
            motionControlOptions: {
              keep_original_sound: node.data.motionKeepOriginalSound || 'yes',
              character_orientation: node.data.motionCharacterOrientation || 'image',
            },
          },
          {
            name: node.data.motionVideoName || 'motion-video',
            type: 'video',
            url: motionVideo,
            size: 0,
            purpose: 'motion-control-video',
          },
        ]
      } else if (videoMode === 'endFrame2video') {
        // 尾帧生视频（MiniMax-H3）：需要一张尾帧图（本节点上传或上游图片）。
        if (!referenceImage) {
          throw new Error('尾帧生视频需要上传尾帧图片，或连接一个已生成图片的上游节点。')
        }
        videoInput = {
          name: node.data.referenceFileName || 'end-frame',
          type: 'image',
          url: referenceImage,
          size: 0,
          purpose: 'end-frame',
        }
      } else if (videoMode === 'image2video') {
        // 图生视频：需要一张参考图（本节点上传或上游图片）。
        if (!referenceImage) {
          throw new Error('图生视频模式需要上传参考图片，或连接一个已生成图片的上游节点。')
        }
        videoInput = {
          name: node.data.referenceFileName || 'reference',
          type: 'image',
          url: referenceImage,
          size: 0,
        }
      } else {
        // 文生视频：默认无文件；若上游连线传入了图片（明确的连接意图），一并消费。
        if (referenceImage) {
          videoInput = {
            name: node.data.referenceFileName || 'reference',
            type: 'image',
            url: referenceImage,
            size: 0,
          }
        }
      }

      // 保留 referenceFile 变量语义：非文生/图生场景不再单独使用。
      void referenceFile

      const finalPrompt = node.data.polish
        ? await maybePolish(prompt, node.data.systemPrompt || DEFAULT_VIDEO_SYSTEM_PROMPT)
        : prompt
      const capability = getModelCapability(model)
      const params = await buildVideoParams(


        finalPrompt,
        model,
        videoInput,
        node.data.aspectRatio || '16:9',
        node.data.duration || 5,
        capability?.videoRequestMode,
        // 可灵系列是否生成声音：新协议使用 sound=on/off。
        node.data.klingSound ? 'on' : 'off',
        node.data.resolution || null,
      )


      const task = await generateVideo(params)
      if (!task.id) throw new Error('视频任务创建成功但未返回任务 ID。')
      updateNodeData(nodeId, { progress: 5 })

      const finalStatus = await pollVideoStatus(
        task.id,
        (progress) => updateNodeData(nodeId, { progress: Math.max(5, Math.min(99, progress)) }),
        3000,
        100,
        task.provider,
        task.providerCreateEndpoint,
      )
      const videoUrl = finalStatus.video_url || finalStatus.data?.[0]?.url
      if (!videoUrl) throw new Error('视频生成完成但未返回有效地址。')
      updateNodeData(nodeId, {
        status: 'completed',
        progress: 100,
        resultUrl: videoUrl,
        resultType: 'video',
      })
    } catch (error) {
      updateNodeData(nodeId, {
        status: 'failed',
        error: normalizeErrorMessage(error, '生成失败，请重试'),
      })
      throw error
    } finally {
      runningNodeId.value = null
    }
  }

  // 运行整个画布：按拓扑顺序从左到右依次执行
  async function runAll() {
    if (isRunning.value) return
    const order = resolveExecutionOrder()
    if (order.length === 0) return

    isRunning.value = true
    runTotal.value = order.length
    runDone.value = 0
    runProgress.value = 0

    // 重置所有节点运行状态
    order.forEach((id) => updateNodeData(id, { status: 'idle', progress: 0, error: undefined }))

    try {
      for (const nodeId of order) {
        try {
          await executeNode(nodeId)
        } catch {
          // 单节点失败不阻断整体，继续后续节点
        } finally {
          runDone.value += 1
          runProgress.value = Math.round((runDone.value / runTotal.value) * 100)
        }
      }
    } finally {
      isRunning.value = false
      runningNodeId.value = null
    }
  }

  // 运行单个节点
  async function runNode(nodeId: string) {
    if (isRunning.value) return
    isRunning.value = true
    runTotal.value = 1
    runDone.value = 0
    runProgress.value = 0
    try {
      await executeNode(nodeId)
    } catch {
      // ignore
    } finally {
      runDone.value = 1
      runProgress.value = 100
      isRunning.value = false
    }
  }

  // 运行某个分组：仅按拓扑顺序依次执行该分组内的生成型节点。
  async function runGroup(groupId: string) {
    if (isRunning.value) return
    const childIds = new Set(getGroupChildIds(groupId))
    if (childIds.size === 0) return
    const order = resolveExecutionOrder(childIds)
    if (order.length === 0) return

    isRunning.value = true
    runningGroupId.value = groupId
    runTotal.value = order.length
    runDone.value = 0
    runProgress.value = 0

    // 重置分组内节点运行状态
    order.forEach((id) => updateNodeData(id, { status: 'idle', progress: 0, error: undefined }))

    try {
      for (const nodeId of order) {
        try {
          await executeNode(nodeId)
        } catch {
          // 单节点失败不阻断整体，继续后续节点
        } finally {
          runDone.value += 1
          runProgress.value = Math.round((runDone.value / runTotal.value) * 100)
        }
      }
    } finally {
      isRunning.value = false
      runningNodeId.value = null
      runningGroupId.value = null
    }
  }

  return {
    runningGroupId,
    updateGroupColor,
    getGroupChildIds,
    runGroup,


    nodes,
    edges,
    clipboard,
    isRunning,
    runProgress,
    runTotal,
    runDone,
    runningNodeId,
    hasGenerationNodes,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    addGenerationNode,
    updateNodeLabel,
    updateNodeData,
    removeSelected,
    removeNode,
    duplicateSelected,
    copySelected,
    pasteFromClipboard,
    groupSelected,
    ungroup,
    selectAll,
    clearSelection,
    undo,
    redo,
    reset,
    runAll,
    runNode,
    polishTextNode,
  }
})
