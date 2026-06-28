import { generateImage, generateVideo } from '@/api/aiping'
import { useChatStore } from '@/stores/chatStore'
import type { GenerateType, UploadedFile } from '@/types/chat'
import { getModelCapability } from '@/types/model'
import type { ModelCapability, ModelIOType } from '@/types/model'
import type { ImageGenerateRequest, VideoGenerateRequest } from '@/types/api'
import { validatePromptOrThrow } from '@/utils/errorHandling'
import { normalizeErrorMessage, showErrorMessage } from '@/utils/errors'
import { aspectRatioToDimensions, aspectRatioToImageSize } from '@/features/generate/aspectRatio'
import { fileToBase64, toRawBase64 } from '@/features/generate/files'
import { pollVideoStatus, setVideoRatio, deleteVideoRatio } from '@/features/generate/video'
import { resolveRealCost } from '@/utils/format'

type ImageRequestMode = NonNullable<ModelCapability['imageRequestMode']>

function ioTypeToGenerateType(ioType: ModelIOType): GenerateType {
  return ioType === 'text2image' || ioType === 'image2image' ? 'image' : 'video'
}

function getKlingAspectRatio(aspectRatio: string): string {
  if (['16:9', '9:16', '1:1'].includes(aspectRatio)) return aspectRatio
  throw new Error('当前可灵视频模型仅支持 16:9、9:16、1:1，请切换比例或模型后重试。')
}

function buildImageParams(
  prompt: string,
  model: string | null,
  uploadedFile: UploadedFile | null | undefined,
  aspectRatio: string,
  mode: ImageRequestMode | undefined
): Promise<ImageGenerateRequest> | ImageGenerateRequest {
  const build = async () => {
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

    if (mode && mode !== 'default') {
      const { width, height } = aspectRatioToDimensions(aspectRatio, mode)
      imageParams.output_format = 'png'
      imageParams.watermark = false

      if (mode === 'seedream-5-lite') {
        imageParams.size = aspectRatioToImageSize(aspectRatio, mode, 'x')
      } else {
        imageParams.size = undefined
        imageParams.width = width
        imageParams.height = height
      }

    }

    return imageParams
  }

  return build()
}

async function buildVideoParams(
  prompt: string,
  model: string | null,
  uploadedFile: UploadedFile | null | undefined,
  aspectRatio: string,
  duration: number,
  videoRequestMode: ModelCapability['videoRequestMode']
): Promise<VideoGenerateRequest> {
  let uploadValue = uploadedFile?.url
  if (uploadedFile?.file) {
    uploadValue = await fileToBase64(uploadedFile.file)
  }

  const videoParams: VideoGenerateRequest = {
    prompt,
    model: model || undefined,
    duration,
  }
  setVideoRatio(videoParams, aspectRatio)

  switch (videoRequestMode) {
    case 'kling-v26':
    case 'kling-v3':
      if (uploadValue) {
        videoParams.image = uploadValue
        deleteVideoRatio(videoParams)
      } else {
        setVideoRatio(videoParams, getKlingAspectRatio(aspectRatio))
      }
      break
    case 'kling-o1':
      if (uploadedFile?.type === 'image' && uploadValue) {
        videoParams.first_frame_url = uploadedFile.file ? toRawBase64(uploadValue) : uploadValue
        deleteVideoRatio(videoParams)
      } else if (uploadedFile?.type === 'video' && uploadedFile.url) {
        videoParams.video_list = [uploadedFile.url]
        deleteVideoRatio(videoParams)
      } else {
        setVideoRatio(videoParams, getKlingAspectRatio(aspectRatio))
      }
      break
    case 'viduq3-fast':
      if (uploadValue) {
        videoParams.image = uploadValue
        videoParams.resolution = '720p'
      }
      delete videoParams.images
      delete videoParams.img_url
      delete videoParams.first_frame_url
      delete videoParams.last_frame_url
      delete videoParams.reference_images
      delete videoParams.video_list
      delete videoParams.aspect_ratio
      delete videoParams.ratio
      delete videoParams.size
      delete videoParams.audio
      delete videoParams.off_peak
      delete videoParams.watermark
      videoParams.movement_amplitude = 'auto'
      delete videoParams.extra_body
      break
    default:
      if (uploadValue) videoParams.img_url = uploadValue
      break
  }

  return videoParams
}

export function useGenerate() {
  const chatStore = useChatStore()

  async function generate(
    prompt: string,
    ioType: ModelIOType,
    model: string | null,
    uploadedFile?: UploadedFile | null,
    aspectRatio = '1:1',
    duration = 6
  ) {
    validatePromptOrThrow(prompt)

    chatStore.isGenerating = true
    const generateType = ioTypeToGenerateType(ioType)

    chatStore.addMessage({
      type: 'user',
      content: prompt,
      uploadedFile: uploadedFile || undefined,
      aspectRatio,
      model: model || undefined,
        duration,
    })

    const assistantId = chatStore.addMessage({
      type: 'assistant',
      content: '',
      generateType,
      generateStatus: 'pending',
    })

    try {
      const capability = getModelCapability(model)

      if (generateType === 'image') {
        const imageParams = await buildImageParams(
          prompt,
          model,
          uploadedFile,
          aspectRatio,
          capability?.imageRequestMode
        )

        const result = await generateImage(imageParams)
        const url = result.data[0]?.url || ''
        chatStore.updateMessage(assistantId, {
          generateStatus: 'completed',
          generateResult: {
            type: 'image',
            url,
            model: result.model || model || 'Qwen-Image-2.0-Pro',
            provider: result.provider,
            cost: resolveRealCost(result),
            aspectRatio,
            createdAt: Date.now(),
            size: aspectRatioToDimensions(aspectRatio, capability?.imageRequestMode),
          },
        })
        return
      }

      const videoParams = await buildVideoParams(
        prompt,
        model,
        uploadedFile,
        aspectRatio,
        duration,
        capability?.videoRequestMode
      )

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
          cost: resolveRealCost(finalStatus),
          aspectRatio,
          createdAt: Date.now(),
          size: aspectRatioToDimensions(aspectRatio),
          thumbnail: finalStatus.data?.[0]?.thumbnail,
          duration: finalStatus.seconds || finalStatus.data?.[0]?.duration,
        },
      })
    } catch (e: unknown) {
      const isTimeout = e instanceof Error && (e.message.includes('timeout') || e.message.includes('超时'))
      const errorMessage = isTimeout ? '生成超时，请更换模型或重试' : normalizeErrorMessage(e, '生成失败，请重试')
      chatStore.updateMessage(assistantId, {
        generateStatus: 'failed',
        error: errorMessage,
      })
      showErrorMessage(errorMessage, '生成失败，请重试')
    } finally {
      chatStore.isGenerating = false
    }
  }

  return { generate }
}
