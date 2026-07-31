/**
 * 生成型节点「元信息 + 默认值」注册表（纯数据，不引用任何 .vue 组件）。
 *
 * 设计目的：让「新增一种节点」= 新增一个节点组件文件 + 在此表内追加一条配置。
 * - canvasStore 通过本表创建节点（标题、VueFlow type、默认 data 字段）。
 * - 组件映射见同目录 `index.ts`（那里会 import 各 .vue 组件）。
 *
 * 之所以把「纯数据」与「组件映射」拆成两个文件：
 * canvasStore → nodeKinds（纯数据）不会形成循环；而组件 → useGenerationNode → canvasStore
 * 已存在依赖链，若 store 再直接引用组件会造成循环依赖。
 */
import { DEFAULT_TEXT_MODEL_ID } from '@/models'
import type { VideoGenerationMode } from '@/types/model'

export type CanvasNodeKind = 'text' | 'image' | 'video' | 'expand'

/**
 * 单种生成节点的元信息。
 * 新增节点时在 NODE_KINDS 里追加一条，并在 index.ts 注册对应组件即可。
 */
export interface NodeKindDef {
  /** 节点类型标识，同时用于生成 data.nodeKind */
  kind: CanvasNodeKind
  /** 节点标题 / 菜单显示名 */
  label: string
  /** VueFlow 使用的节点 type（约定为 `${kind}Node`） */
  vueFlowType: string
  /**
   * 创建节点时的默认 data 字段（不含 label / nodeKind / status / prompt / model 这些通用字段，
   * 通用字段由 canvasStore 统一注入）。
   */
  createData: () => Record<string, unknown>
}

export const NODE_KINDS: NodeKindDef[] = [
  {
    kind: 'text',
    label: '文本节点',
    vueFlowType: 'textNode',
    createData: () => ({
      // 文本节点默认选中默认文本模型，并默认开启 AI 润色；
      // 关闭润色后直接把用户输入透传给下游节点。
      model: DEFAULT_TEXT_MODEL_ID,
      polish: true,
    }),
  },
  {
    kind: 'image',
    label: '图片节点',
    vueFlowType: 'imageNode',
    createData: () => ({
      imageMode: 'text2image',
      aspectRatio: '1:1',
      polish: false,
    }),
  },
  {
    kind: 'expand',
    label: '扩图节点',
    vueFlowType: 'expandNode',
    createData: () => ({
      // 扩图节点：复用图片模型列表，默认目标比例 16:9（常见横向扩展），不开启 AI 润色。
      aspectRatio: '16:9',
      polish: false,
    }),
  },
  {
    kind: 'video',
    label: '视频节点',
    vueFlowType: 'videoNode',
    createData: () => ({
      videoMode: 'text2video' as VideoGenerationMode,
      aspectRatio: '16:9',
      duration: 5,
      polish: false,
    }),
  },
]

const NODE_KIND_MAP: Record<string, NodeKindDef> = Object.fromEntries(
  NODE_KINDS.map((def) => [def.kind, def]),
)

export function getNodeKindDef(kind: CanvasNodeKind): NodeKindDef {
  return NODE_KIND_MAP[kind] ?? NODE_KINDS[0]
}

/** 所有生成型节点的 VueFlow type 集合（供 store 判断"是否为生成型节点"）。 */
export const GENERATION_NODE_TYPES: string[] = NODE_KINDS.map((def) => def.vueFlowType)

/** 判断某个 VueFlow 节点 type 是否为生成型节点。 */
export function isGenerationNodeType(type: string): boolean {
  return GENERATION_NODE_TYPES.includes(type)
}

