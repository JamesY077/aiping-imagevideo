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
type UploadInput = UploadedFile | UploadedFile[] | null | undefined

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
  uploadedFile: UploadInput,
  aspectRatio: string,
  mode: ImageRequestMode | undefined
): Promise<ImageGenerateRequest> | ImageGenerateRequest {
  const build = async () => {
    const primaryFile = Array.isArray(uploadedFile) ? uploadedFile[0] : uploadedFile
    let imageInput = primaryFile?.url
    if (primaryFile?.file) {
      imageInput = await fileToBase64(primaryFile.file)
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
  uploadedFile: UploadInput,
  aspectRatio: string,
  duration: number,
  videoRequestMode: ModelCapability['videoRequestMode']
): Promise<VideoGenerateRequest> {
  const uploadedFiles = (Array.isArray(uploadedFile) ? uploadedFile : uploadedFile ? [uploadedFile] : [])
  const uploadValues = await Promise.all(
    uploadedFiles.map(async (file) => (file.file ? fileToBase64(file.file) : file.url))
  )
  const primaryFile = uploadedFiles[0]
  const uploadValue = uploadValues[0]

  const videoParams: VideoGenerateRequest = {
    prompt,
    model: model || undefined,
    duration,
    resolution: '1080p',
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
      if (primaryFile?.type === 'image' && uploadValue) {
        videoParams.first_frame_url = primaryFile.file ? toRawBase64(uploadValue) : uploadValue
        deleteVideoRatio(videoParams)
      } else if (primaryFile?.type === 'video' && primaryFile.url) {
        videoParams.video_list = [primaryFile.url]
        deleteVideoRatio(videoParams)
      } else {
        setVideoRatio(videoParams, getKlingAspectRatio(aspectRatio))
      }
      break
    case 'viduq3-fast':
      if (uploadValues.length) {
        videoParams.images = uploadValues.slice(0, 2)
        videoParams.resolution = '1080p'
        videoParams.movement_amplitude = 'auto'
      } else {
        videoParams.aspect_ratio = aspectRatio || '4:3'
        videoParams.resolution = '1080p'
        videoParams.style = 'general'
        videoParams.movement_amplitude = 'auto'
      }
      delete videoParams.image
      delete videoParams.img_url
      delete videoParams.first_frame_url
      delete videoParams.last_frame_url
      delete videoParams.reference_images
      delete videoParams.video_list
      delete videoParams.ratio
      delete videoParams.size
      delete videoParams.audio
      delete videoParams.off_peak
      delete videoParams.watermark
      delete videoParams.extra_body
      break
    case 'minimax-hailuo':
      if (uploadValues.length >= 2) {
        videoParams.first_frame_image = uploadValues[0]
        videoParams.last_frame_image = uploadValues[1]
      } else if (uploadValue) {
        if (primaryFile?.type === 'image' && primaryFile?.name === 'Subject Reference') {
          videoParams.subject_reference = [
            {
              type: 'character',
              image: [uploadValue],
            },
          ]
        } else {
          videoParams.first_frame_image = uploadValue
        }
      }
      if (!videoParams.subject_reference) {
        videoParams.duration = duration || 6
        videoParams.resolution = '1080P'
      }
      deleteVideoRatio(videoParams)
      delete videoParams.seconds
      delete videoParams.size
      delete videoParams.image
      delete videoParams.images
      delete videoParams.img_url
      delete videoParams.first_frame_url
      delete videoParams.last_frame_url
      delete videoParams.reference_images
      delete videoParams.video_list
      delete videoParams.audio
      delete videoParams.movement_amplitude
      delete videoParams.off_peak
      delete videoParams.watermark
      delete videoParams.seed
      delete videoParams.style
      delete videoParams.payload
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
    uploadedFile?: UploadInput,
    aspectRatio = '1:1',
    duration = 6
  ) {
    validatePromptOrThrow(prompt)

    chatStore.isGenerating = true
    const generateType = ioTypeToGenerateType(ioType)

    chatStore.addMessage({
      type: 'user',
      content: prompt,
      uploadedFile: Array.isArray(uploadedFile) ? uploadedFile[0] : uploadedFile || undefined,
      uploadedFiles: Array.isArray(uploadedFile) ? uploadedFile : undefined,
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
        if (!url) {
          throw new Error('图片生成完成但未返回有效图片地址，请稍后重试或切换模型。')
        }
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
      if (!task.id) {
        throw new Error('视频任务创建成功但未返回任务 ID，请稍后重试或切换模型。')
      }
      chatStore.updateMessage(assistantId, { generateStatus: 'processing' })

      const finalStatus = await pollVideoStatus(
        task.id,
        (progress) => {
          chatStore.updateMessage(assistantId, { progress })
        },
        3000,
        100,
        task.provider
      )

      const videoUrl = finalStatus.video_url || finalStatus.data?.[0]?.url || ''
      if (!videoUrl) {
        throw new Error('视频生成完成但未返回有效视频地址，请稍后重试或切换模型。')
      }
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
