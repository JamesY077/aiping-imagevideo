import type { VideoModelModule } from '../types'
import { klingVideoO1Model } from './klingVideoO1'
import { klingV26Model } from './klingV26'
import { klingV3Model } from './klingV3'
import { klingV3OmniModel } from './klingV3Omni'
import { minimaxHailuo23Model } from './minimaxHailuo23'
import { viduQ3ProModel } from './viduQ3Pro'
import { viduQ3ProFastModel } from './viduQ3ProFast'

export { klingVideoO1Model } from './klingVideoO1'
export { klingV26Model } from './klingV26'
export { klingV3Model } from './klingV3'
export { klingV3OmniModel } from './klingV3Omni'
export { minimaxHailuo23Model } from './minimaxHailuo23'
export { viduQ3ProAliases, viduQ3ProModel } from './viduQ3Pro'
export { viduQ3ProFastAliases, viduQ3ProFastModel } from './viduQ3ProFast'

export const videoModelModules: VideoModelModule[] = [
  viduQ3ProFastModel,
  viduQ3ProModel,
  minimaxHailuo23Model,
  klingVideoO1Model,
  klingV3OmniModel,
  klingV3Model,
  klingV26Model,
]