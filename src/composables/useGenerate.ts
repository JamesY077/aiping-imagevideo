import { generateImage, generateVideo, getVideoStatus } from '@/api/aiping'
import { useChatStore } from '@/stores/chatStore'
import type { GenerateType } from '@/types/chat'
import { getModelCapability } from '@/types/model'
import type { ModelIOType } from '@/types/model'
import type { UploadedFile } from '@/types/chat'
import type { ImageGenerateRequest, VideoGenerateRequest, VideoStatusResponse } from '@/types/api'

async function pollVideoStatus(
  taskId: string,
  onProgress?: (progress: number) => void,
  interval = 3000,
  maxAttempts = 100
): Promise<VideoStatusResponse> {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await getVideoStatus(taskId)
    if (status.progress && onProgress) {
      onProgress(status.progress)
    }
    if (status.status === 'completed') return status
    if (status.status === 'failed') {
      console.log('pollVideoStatus failed, full status:', JSON.stringify(status))
      throw new Error(status.error || `视频生成失败 (task: ${taskId})`)
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
  throw new Error('视频生成超时')
}

function ioTypeToGenerateType(ioType: ModelIOType): GenerateType {
  return ioType === 'text2image' || ioType === 'image2image' ? 'image' : 'video'
}

// 标准尺寸映射（默认图片模型）
const ASPECT_RATIO_SIZE_MAP: Record<string, { width: number; height: number }> = {
  '16:9': { width: 1280, height: 720 },
  '3:2':  { width: 1200, height: 800 },
  '4:3':  { width: 1024, height: 768 },
  '1:1':  { width: 1024, height: 1024 },
  '3:4':  { width: 768,  height: 1024 },
  '2:3':  { width: 800,  height: 1200 },
  '9:16': { width: 720,  height: 1280 },
}

// 即梦系列高清尺寸
const HQ_IMAGE_SIZE_MAP: Record<string, { width: number; height: number }> = {
  '16:9': { width: 2560, height: 1440 },
  '3:2':  { width: 2496, height: 1664 },
  '4:3':  { width: 2304, height: 1728 },
  '1:1':  { width: 2048, height: 2048 },
  '3:4':  { width: 1728, height: 2304 },
  '2:3':  { width: 1664, height: 2496 },
  '9:16': { width: 1440, height: 2560 },
}

// Doubao-Seedream 系列尺寸（通过 width/height 传递）
const SEEDREAM_SIZE_MAP: Record<string, { width: number; height: number }> = {
  '16:9': { width: 2848, height: 1600 },
  '3:2':  { width: 2496, height: 1664 },
  '4:3':  { width: 2304, height: 1728 },
  '1:1':  { width: 2048, height: 2048 },
  '3:4':  { width: 1728, height: 2304 },
  '2:3':  { width: 1664, height: 2496 },
  '9:16': { width: 1600, height: 2848 },
}

function aspectRatioToDimensions(
  aspectRatio: string,
  mode: 'default' | 'jimeng-width-height' | 'seedream' = 'default'
): { width: number; height: number } {
  if (mode === 'seedream') {
    return SEEDREAM_SIZE_MAP[aspectRatio] || SEEDREAM_SIZE_MAP['1:1']
  }
  if (mode === 'jimeng-width-height') {
    return HQ_IMAGE_SIZE_MAP[aspectRatio] || HQ_IMAGE_SIZE_MAP['1:1']
  }
  return ASPECT_RATIO_SIZE_MAP[aspectRatio] || { width: 1024, height: 1024 }
}

function aspectRatioToImageSize(
  aspectRatio: string,
  mode: 'default' | 'jimeng-width-height' | 'seedream' = 'default'
): string {
  const { width, height } = aspectRatioToDimensions(aspectRatio, mode)
  return `${width}x${height}`
}

function aspectRatioToVideoSize(aspectRatio: string): string {
  // 视频 size 格式用 * 分隔
  const { width, height } = aspectRatioToDimensions(aspectRatio)
  return `${width}*${height}`
}

// 可灵系列只支持 16:9 / 9:16 / 1:1，其他比例降级为 16:9
function normalizeKlingAspectRatio(aspectRatio: string): string {
  return ['16:9', '9:16', '1:1'].includes(aspectRatio) ? aspectRatio : '16:9'
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (error) => reject(error)
  })
}

export function useGenerate() {
  const chatStore = useChatStore()

  async function generate(
    prompt: string,
    ioType: ModelIOType,
    model: string | null,
    uploadedFile?: UploadedFile | null,
    aspectRatio = '1:1'
  ) {
    chatStore.isGenerating = true
    const generateType = ioTypeToGenerateType(ioType)

    // Add user message
    chatStore.addMessage({
      type: 'user',
      content: prompt,
      uploadedFile: uploadedFile || undefined,
      aspectRatio,
      model: model || undefined,
    })

    // Add assistant placeholder
    const assistantId = chatStore.addMessage({
      type: 'assistant',
      content: '',
      generateType,
      generateStatus: 'pending',
    })

    try {
      const capability = getModelCapability(model)

      if (generateType === 'image') {
        console.log('generateImage: start, model=', model)
        let imageInput = uploadedFile?.url
        if (uploadedFile?.file) {
          imageInput = await fileToBase64(uploadedFile.file)
        }

        const imageParams: ImageGenerateRequest = {
          prompt,
          model: model || undefined,
          image: imageInput,
          size: aspectRatioToImageSize(aspectRatio),
        }

        if (capability?.imageRequestMode === 'seedream') {
          // Doubao-Seedream: 通过 AIPing 代理使用 width/height 分开传，不支持 size 字符串
          const { width, height } = aspectRatioToDimensions(aspectRatio, 'seedream')
          imageParams.size = undefined
          imageParams.width = width
          imageParams.height = height
        } else if (capability?.imageRequestMode === 'jimeng-width-height') {
          // 即梦系列使用 width/height 分开传
          const { width, height } = aspectRatioToDimensions(aspectRatio, 'jimeng-width-height')
          imageParams.size = undefined
          imageParams.width = width
          imageParams.height = height
        }

        const result = await generateImage(imageParams)
        console.log('generateImage: result=', result)
        const url = result.data[0]?.url || ''
        console.log('generateImage: url=', url)
        const updateData = {
          generateStatus: 'completed' as const,
          generateResult: {
            type: 'image' as const,
            url,
            model: result.model || model || 'Kolors',
            provider: result.provider,
            cost: 0.05,
          },
        }
        console.log('updateMessage data:', updateData)
        chatStore.updateMessage(assistantId, updateData)
        console.log('after update, message:', chatStore.messages.find(m => m.id === assistantId))
      } else {
        let uploadValue = uploadedFile?.url
        if (uploadedFile?.file) {
          uploadValue = await fileToBase64(uploadedFile.file)
        }

        const videoParams: VideoGenerateRequest = {
          prompt,
          model: model || undefined,
          aspect_ratio: aspectRatio,
        }

        switch (capability?.videoRequestMode) {
          case 'kling-v26':
            // Kling-V2.6: 文生视频传 aspect_ratio（仅支持 16:9/9:16/1:1）
            // 图生视频传 image，不传 aspect_ratio（文档规定图生视频不支持 aspect_ratio）
            if (uploadValue) {
              videoParams.image = uploadValue
              delete videoParams.aspect_ratio
            } else {
              videoParams.aspect_ratio = normalizeKlingAspectRatio(aspectRatio)
            }
            break

          case 'kling-v3':
            // Kling-V3 / Kling-V3-Omni: 路由规则与 V2.6 一致
            // 文生视频传 aspect_ratio；图生视频传 image，不传 aspect_ratio
            if (uploadValue) {
              videoParams.image = uploadValue
              delete videoParams.aspect_ratio
            } else {
              videoParams.aspect_ratio = normalizeKlingAspectRatio(aspectRatio)
            }
            break

          case 'kling-o1':
            // Kling-Video-O1 (Omni): 图生视频用 first_frame_url，有图时不传 aspect_ratio
            if (uploadedFile?.type === 'image' && uploadValue) {
              videoParams.first_frame_url = uploadValue
              delete videoParams.aspect_ratio  // 有首帧时不支持 aspect_ratio
            } else if (uploadedFile?.type === 'video' && uploadedFile.url) {
              videoParams.video_list = [uploadedFile.url]
              delete videoParams.aspect_ratio  // 视频编辑不支持 aspect_ratio
            } else {
              // 文生视频：传 aspect_ratio（仅支持 16:9/9:16/1:1）
              videoParams.aspect_ratio = normalizeKlingAspectRatio(aspectRatio)
            }
            break

          case 'wan-i2v':
            if (uploadValue) videoParams.img_url = uploadValue
            delete videoParams.aspect_ratio
            videoParams.size = aspectRatioToVideoSize(aspectRatio)
            break

          default:
            if (uploadValue) videoParams.img_url = uploadValue
            if (model?.startsWith('Wan2.6-')) {
              delete videoParams.aspect_ratio
              videoParams.size = aspectRatioToVideoSize(aspectRatio)
            }
            break
        }

        const task = await generateVideo(videoParams)
        chatStore.updateMessage(assistantId, { generateStatus: 'processing' })

        const finalStatus = await pollVideoStatus(task.id, (progress) => {
          chatStore.updateMessage(assistantId, { progress })
        })

        const videoUrl = finalStatus.video_url || finalStatus.data?.[0]?.url || ''
        chatStore.updateMessage(assistantId, {
          generateStatus: 'completed',
          generateResult: {
            type: 'video',
            url: videoUrl,
            model: finalStatus.model,
            provider: finalStatus.provider,
            cost: 0.5,
            thumbnail: finalStatus.data?.[0]?.thumbnail,
            duration: finalStatus.seconds || finalStatus.data?.[0]?.duration,
          },
        })
      }
    } catch (e: unknown) {
      console.error('generate error:', e)
      const isTimeout = e instanceof Error && (e.message.includes('timeout') || e.message.includes('超时'))
      chatStore.updateMessage(assistantId, {
        generateStatus: 'failed',
        error: isTimeout ? '生成超时，请更换模型或重试' : (e instanceof Error ? e.message : '生成失败，请重试'),
      })
    } finally {
      chatStore.isGenerating = false
    }
  }

  return { generate }
}
