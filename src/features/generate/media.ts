import type { UploadedFile } from '@/types/chat'
import type { ModelIOType } from '@/types/model'

export function resolveGenerateIoType(mediaType: 'image' | 'video', file?: UploadedFile | null): ModelIOType {
  const hasReference = !!file
  if (mediaType === 'image') {
    return hasReference ? 'image2image' : 'text2image'
  }
  return hasReference ? 'image2video' : 'text2video'
}
