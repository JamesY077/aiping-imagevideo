/**
 * 生成型节点「组件映射」注册表。
 *
 * 新增一种节点的完整步骤：
 *  1. 在本目录新增一个节点组件文件（如 `AudioNode.vue`），基于 NodeShell 编写；
 *  2. 在 `nodeKinds.ts` 的 NODE_KINDS 中追加该节点的元信息与默认值；
 *  3. 在下方 GENERATION_NODE_COMPONENTS 中登记「vueFlowType → 组件」映射。
 *
 * 完成后：底部工具栏菜单、双击创建菜单、画布节点渲染、store 创建逻辑都会自动感知该节点，
 * 无需再改动 InfiniteCanvas / CanvasToolbar / canvasStore。
 */
import type { Component } from 'vue'

import TextNode from './TextNode.vue'
import ImageNode from './ImageNode.vue'
import ExpandNode from './ExpandNode.vue'
import VideoNode from './VideoNode.vue'
import { NODE_KINDS } from './nodeKinds'

export * from './nodeKinds'

/** VueFlow 节点 type → 渲染组件。 */
export const GENERATION_NODE_COMPONENTS: Record<string, Component> = {
  textNode: TextNode,
  imageNode: ImageNode,
  expandNode: ExpandNode,
  videoNode: VideoNode,
}

/**
 * 供工具栏 / 创建菜单使用的可创建节点列表（顺序即菜单展示顺序）。
 */
export const GENERATION_NODE_MENU = NODE_KINDS.map((def) => ({
  kind: def.kind,
  label: def.label,
}))
