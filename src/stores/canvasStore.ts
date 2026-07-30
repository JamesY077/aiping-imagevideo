import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from '@vue-flow/core'

export interface CanvasNodeData {
  label: string
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

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function cloneGraph(nodes: CanvasNode[], edges: CanvasEdge[]): GraphSnapshot {
  const snapshot: GraphSnapshot = { nodes, edges }
  if (typeof structuredClone === 'function') {
    return structuredClone(snapshot)
  }
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

  function commitHistory() {
    const snapshot = cloneGraph(nodes.value, edges.value)
    historyPast.value = [...historyPast.value, snapshot].slice(-HISTORY_LIMIT)
    historyFuture.value = []
  }

  function onNodesChange(changes: NodeChange[]) {
    nodes.value = applyNodeChanges(changes, nodes.value as any) as unknown as CanvasNode[]
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
    nodes.value = [...nodes.value, node]
    nextNodeId.value += 1
  }

  function updateNodeLabel(id: string, label: string) {
    nodes.value = nodes.value.map((node) =>
      node.id === id ? { ...node, data: { ...node.data, label } } : node,
    )
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

  function duplicateSelected() {
    const selected = nodes.value.filter(
      (node) => node.selected && node.type === 'basicNode',
    )
    if (selected.length === 0) return

    commitHistory()
    const clones: CanvasNode[] = selected.map((node) => ({
      ...node,
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
      (node) => node.selected && node.type === 'basicNode' && !node.parentNode,
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

  return {
    nodes,
    edges,
    clipboard,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    updateNodeLabel,
    removeSelected,
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
  }
})
