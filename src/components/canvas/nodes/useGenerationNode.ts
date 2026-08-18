/**
 * 生成型节点的共享逻辑（文本 / 图片 / 扩图 / 视频通用）。
 *
 * 各具体节点组件（TextNode / ImageNode / ExpandNode / VideoNode）通过本 composable
 * 复用「模型/比例/时长选项」「各类文件上传处理」「模式切换」等通用行为，
 * 从而让每个节点组件只需关注自己的工具栏结构差异。
 */
import { computed } from 'vue'

import { useCanvasStore, type CanvasNodeData } from '@/stores/canvasStore'
import {
  getSupportedAspectRatios,
  getSupportedVideoDurations,
  getSupportedVideoModes,
  type MediaType,
} from '@/types/model'

import { textModelModules } from '@/models'

const DEFAULT_RATIOS = ['16:9', '3:2', '4:3', '1:1', '3:4', '2:3', '9:16']

export interface GenerationNodeProps {
  id: string
  data: CanvasNodeData
  selected?: boolean
}

export function useGenerationNode(props: GenerationNodeProps) {
  const store = useCanvasStore()

  const kind = computed(() => props.data.nodeKind || 'text')
  const isRunning = computed(() => store.runningNodeId === props.id)

  // 模型选择器使用的媒体类型：扩图节点复用图片模型列表。
  const modelMediaType = computed<MediaType>(() => (kind.value === 'video' ? 'video' : 'image'))

  // 视频节点：当前模型支持的生成方式（文生/图生/首尾帧/主体参考/动作控制）。
  const videoModeOptions = computed(() => getSupportedVideoModes(props.data.model))

  const ratioOptions = computed(() => getSupportedAspectRatios(props.data.model) ?? DEFAULT_RATIOS)
  const durationOptions = computed(
    () => getSupportedVideoDurations(props.data.model) ?? [{ value: 5, label: '5s' }],
  )

  // 文本模型列表（PRD - 文本节点 - 文本模型列表，预定义于 @/models/text）
  const textModels = textModelModules

  // ------ 上传入口可见性（按节点类型 / 生成模式判断）------
  const showUpload = computed(
    () =>
      (kind.value === 'image' && props.data.imageMode === 'image2image') ||
      (kind.value === 'video' && props.data.videoMode === 'image2video'),
  )
  // 主体参考视频：与图生视频一样，只需一张参考图。
  const showSubjectUpload = computed(
    () => kind.value === 'video' && props.data.videoMode === 'subjectReference2video',
  )
  // 首尾帧生视频：需要首帧 + 尾帧两张图片。
  const showStartEndUpload = computed(
    () => kind.value === 'video' && props.data.videoMode === 'startEnd2video',
  )
  // 动作控制：需要参考图像 + 参考视频。
  const showMotionUpload = computed(
    () => kind.value === 'video' && props.data.videoMode === 'motionControl2video',
  )
  // 多模态参考（Seedance 2.0）：图片 0~9 / 视频 0~3 / 音频 0~3。
  const showMultimodalUpload = computed(
    () => kind.value === 'video' && props.data.videoMode === 'multimodalReference2video',
  )
  // 编辑视频（Seedance 2.0）：待编辑视频 + 替换图片。
  const showEditVideoUpload = computed(
    () => kind.value === 'video' && props.data.videoMode === 'editVideo',
  )
  // 多模态参考各模态的数量上限。
  const MULTIMODAL_LIMITS = { image: 9, video: 3, audio: 3 } as const


  // ------ 选择类控件的更新处理 ------
  function onImageMode(e: Event) {
    store.updateNodeData(props.id, { imageMode: (e.target as HTMLSelectElement).value as any })
  }
  function onVideoMode(e: Event) {
    store.updateNodeData(props.id, { videoMode: (e.target as HTMLSelectElement).value as any })
  }
  function onTextModel(e: Event) {
    store.updateNodeData(props.id, { model: (e.target as HTMLSelectElement).value })
  }
  function onRatio(e: Event) {
    store.updateNodeData(props.id, { aspectRatio: (e.target as HTMLSelectElement).value })
  }
  function onDuration(e: Event) {
    store.updateNodeData(props.id, { duration: Number((e.target as HTMLSelectElement).value) })
  }

  // ------ 文件上传处理 ------
  function onFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () =>
      store.updateNodeData(props.id, {
        referenceImage: reader.result as string,
        referenceFileName: file.name,
      })
    reader.readAsDataURL(file)
  }

  // 通用：把选中的文件读为 data url 并写入指定的节点字段。
  function readFileInto(e: Event, urlKey: keyof CanvasNodeData, nameKey: keyof CanvasNodeData) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () =>
      store.updateNodeData(props.id, {
        [urlKey]: reader.result as string,
        [nameKey]: file.name,
      } as Partial<CanvasNodeData>)
    reader.readAsDataURL(file)
  }

  function onStartFrame(e: Event) {
    readFileInto(e, 'startFrameImage', 'startFrameName')
  }
  function onEndFrame(e: Event) {
    readFileInto(e, 'endFrameImage', 'endFrameName')
  }
  function onMotionImage(e: Event) {
    readFileInto(e, 'motionImage', 'motionImageName')
  }
  function onMotionVideo(e: Event) {
    readFileInto(e, 'motionVideo', 'motionVideoName')
  }

  // ------ 多模态参考（Seedance 2.0）：图片 / 视频 / 音频列表 ------
  // 追加选中的多个文件到对应模态数组（受上限约束），以 data url 存储。
  function appendMultimodal(
    e: Event,
    listKey: 'multimodalImages' | 'multimodalVideos' | 'multimodalAudios',
    limit: number,
  ) {
    const input = e.target as HTMLInputElement
    const files = Array.from(input.files || [])
    if (!files.length) return
    const current = (props.data[listKey] as string[] | undefined) || []
    const room = Math.max(0, limit - current.length)
    const picked = files.slice(0, room)
    Promise.all(
      picked.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(file)
          }),
      ),
    ).then((urls) => {
      const latest = (props.data[listKey] as string[] | undefined) || []
      store.updateNodeData(props.id, { [listKey]: [...latest, ...urls] } as Partial<CanvasNodeData>)
    })
    // 允许连续选择同一批文件时也能触发 change
    input.value = ''
  }
  function onMultimodalImages(e: Event) {
    appendMultimodal(e, 'multimodalImages', MULTIMODAL_LIMITS.image)
  }
  function onMultimodalVideos(e: Event) {
    appendMultimodal(e, 'multimodalVideos', MULTIMODAL_LIMITS.video)
  }
  function onMultimodalAudios(e: Event) {
    appendMultimodal(e, 'multimodalAudios', MULTIMODAL_LIMITS.audio)
  }
  function removeMultimodal(
    listKey: 'multimodalImages' | 'multimodalVideos' | 'multimodalAudios',
    index: number,
  ) {
    const current = [...((props.data[listKey] as string[] | undefined) || [])]
    current.splice(index, 1)
    store.updateNodeData(props.id, { [listKey]: current } as Partial<CanvasNodeData>)
  }

  // ------ 编辑视频（Seedance 2.0）：待编辑视频 + 替换图片 ------
  function onEditVideo(e: Event) {
    readFileInto(e, 'editVideoUrl', 'editVideoName')
  }
  function onEditImage(e: Event) {
    readFileInto(e, 'editImageUrl', 'editImageName')
  }

  return {

    store,
    kind,
    isRunning,
    modelMediaType,
    videoModeOptions,
    ratioOptions,
    durationOptions,
    textModels,
    showUpload,
    showSubjectUpload,
    showStartEndUpload,
    showMotionUpload,
    showMultimodalUpload,
    showEditVideoUpload,
    MULTIMODAL_LIMITS,

    onImageMode,
    onVideoMode,
    onTextModel,
    onRatio,
    onDuration,
    onFile,
    onStartFrame,
    onEndFrame,
    onMotionImage,
    onMotionVideo,
    onMultimodalImages,
    onMultimodalVideos,
    onMultimodalAudios,
    removeMultimodal,
    onEditVideo,
    onEditImage,
  }
}
