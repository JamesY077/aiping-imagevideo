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
import { pollVideoStatus } from '@/features/generate/video'
import { getModelCapability } from '@/types/model'
import { buildTextExtraBody, DEFAULT_TEXT_MODEL_ID, getTextModelModule } from '@/models'
import {
  useSettingsStore,
  DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
  DEFAULT_TEXT_SYSTEM_PROMPT,
} from '@/stores/settingsStore'
import { normalizeErrorMessage } from '@/utils/errors'
import type { ChatMessage, ChatMessageContentPart } from '@/types/api'
import type { UploadedFile } from '@/types/chat'

export type CanvasNodeKind = 'text' | 'image' | 'video'
export type CanvasNodeRunStatus = 'idle' | 'running' | 'completed' | 'failed'

export interface CanvasNodeData {
  label: string
  nodeKind?: CanvasNodeKind
  prompt?: string
  model?: string | null
  // image
  imageMode?: 'text2image' | 'image2image'
  aspectRatio?: string
  // video
  videoMode?: 'text2video' | 'image2video'
  duration?: number
  // reference image (data url), used by image2image / image2video
  referenceImage?: string
  referenceFileName?: string
  polish?: boolean
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

const NODE_KIND_LABEL: Record<CanvasNodeKind, string> = {
  text: '文本节点',
  image: '图片节点',
  video: '视频节点',
}

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


  // 创建生成型节点（文本/图片/视频）
  function addGenerationNode(kind: CanvasNodeKind, position?: { x: number; y: number }) {
    commitHistory()
    const id = generateId('node')
    const data: CanvasNodeData = {
      label: NODE_KIND_LABEL[kind],
      nodeKind: kind,
      prompt: '',
      model: null,
      status: 'idle',
    }
    if (kind === 'text') {
      data.model = DEFAULT_TEXT_MODEL_ID
    } else if (kind === 'image') {
      data.imageMode = 'text2image'
      data.aspectRatio = '1:1'
      data.polish = false
    } else if (kind === 'video') {
      data.videoMode = 'text2video'
      data.aspectRatio = '16:9'
      data.duration = 5
      data.polish = false
    }

    const node: CanvasNode = {
      id,
      type: `${kind}Node`,
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
    const minX = Math.min(...selected.map((node) => node.position.x))
    const minY = Math.min(...selected.map((node) => node.position.y))
    const maxX = Math.max(
      ...selected.map((node) => node.position.x + (node.dimensions?.width || 200)),
    )
    const maxY = Math.max(
      ...selected.map((node) => node.position.y + (node.dimensions?.height || 80)),
    )

    const groupId = `group-${nextGroupId.value}`
    const groupNode: CanvasNode = {
      id: groupId,
      type: 'groupNode',
      position: { x: minX - padding, y: minY - padding },
      data: { label: `分组 ${nextGroupId.value}` },
      style: {
        width: `${maxX - minX + padding * 2}px`,
        height: `${maxY - minY + padding * 2}px`,
      },
    }

    const selectedIds = new Set(selected.map((node) => node.id))
    const reparented = nodes.value.map((node) => {
      if (!selectedIds.has(node.id)) return node
      return {
        ...node,
        parentNode: groupId,
        extent: 'parent' as const,
        selected: false,
        position: {
          x: node.position.x - (minX - padding),
          y: node.position.y - (minY - padding),
        },
      }
    })

    nodes.value = [groupNode, ...reparented]
    nextGroupId.value += 1
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
    nodes.value.filter((node) => ['textNode', 'imageNode', 'videoNode'].includes(node.type)),
  )

  const hasGenerationNodes = computed(() => generationNodes.value.length > 0)

  /**
   * 依据连线做拓扑排序，从左到右决定执行顺序。
   * 无连线的节点按 x 坐标从左到右排序。
   */
  function resolveExecutionOrder(): string[] {
    const genNodes = generationNodes.value
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

  // 找到某节点的上游生成型节点（用于把上游文本结果串联为 prompt）
  function getUpstreamNodeIds(nodeId: string): string[] {
    return edges.value.filter((edge) => edge.target === nodeId).map((edge) => edge.source)
  }

  async function maybePolish(prompt: string): Promise<string> {
    const settingsStore = useSettingsStore()
    const model = settingsStore.promptPolishModel.trim()
    if (!model) return prompt
    try {
      return await polishPrompt({
        model,
        messages: [
          {
            role: 'system',
            content: settingsStore.promptPolishSystemPrompt.trim() || DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
          },
          { role: 'user', content: prompt },
        ],
      })
    } catch {
      return prompt
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
      // 拼接上游文本节点的结果作为额外上下文
      const upstreamIds = getUpstreamNodeIds(nodeId)
      const upstreamTexts = upstreamIds
        .map((uid) => nodes.value.find((n) => n.id === uid))
        .filter((n): n is CanvasNode => !!n && n.data.nodeKind === 'text' && !!n.data.resultText)
        .map((n) => n.data.resultText as string)

      let prompt = (node.data.prompt || '').trim()
      if (upstreamTexts.length > 0) {
        prompt = [...upstreamTexts, prompt].filter(Boolean).join('\n')
      }

      if (!prompt) {
        throw new Error('请输入内容后再运行。')
      }

      // image / video 需要参考图（上游图片节点结果可作为参考图）
      let referenceFile: UploadedFile | null = null
      const upstreamImageUrl = upstreamIds
        .map((uid) => nodes.value.find((n) => n.id === uid))
        .find((n) => n?.data.resultType === 'image' && n?.data.resultUrl)?.data.resultUrl
      const referenceImage = node.data.referenceImage || upstreamImageUrl

      if (kind === 'text') {
        const model = node.data.model
        if (!model) throw new Error('请先选择文本模型。')

        // 系统提示词：所有文本模型生成前统一经过一遍，明确身份和边界（对应 PRD）
        const settingsStore = useSettingsStore()
        const systemPrompt = settingsStore.textSystemPrompt.trim() || DEFAULT_TEXT_SYSTEM_PROMPT

        // 视觉模型且携带参考图片时，走多模态 content（image_url + text）
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

        const text = await chatCompletion({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            userMessage,
          ],
          extra_body: buildTextExtraBody(model),
        })
        updateNodeData(nodeId, {
          status: 'completed',
          progress: 100,
          resultText: text,
          resultType: 'text',
        })
        return
      }

      if (kind === 'image') {
        const model = node.data.model
        if (!model) throw new Error('请先选择图片模型。')
        const isImage2Image = node.data.imageMode === 'image2image'
        if (isImage2Image && !referenceImage) {
          throw new Error('图生图模式需要上传参考图片。')
        }
        if (isImage2Image && referenceImage) {
          referenceFile = {
            name: node.data.referenceFileName || 'reference',
            type: 'image',
            url: referenceImage,
            size: 0,
          }
        }

        const finalPrompt = node.data.polish ? await maybePolish(prompt) : prompt
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

      // video
      const model = node.data.model
      if (!model) throw new Error('请先选择视频模型。')
      const isImage2Video = node.data.videoMode === 'image2video'
      if (isImage2Video && !referenceImage) {
        throw new Error('图生视频模式需要上传参考图片。')
      }
      if (isImage2Video && referenceImage) {
        referenceFile = {
          name: node.data.referenceFileName || 'reference',
          type: 'image',
          url: referenceImage,
          size: 0,
        }
      }

      const finalPrompt = node.data.polish ? await maybePolish(prompt) : prompt
      const capability = getModelCapability(model)
      const params = await buildVideoParams(
        finalPrompt,
        model,
        referenceFile,
        node.data.aspectRatio || '16:9',
        node.data.duration || 5,
        capability?.videoRequestMode,
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

  return {
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
  }
})
