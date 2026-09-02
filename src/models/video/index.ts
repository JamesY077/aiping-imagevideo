import type { VideoModelModule } from '../types'
import { klingVideoO1Model } from './klingVideoO1'
import { klingV26Model } from './klingV26'
import { klingV3Model } from './klingV3'
import { klingV3OmniModel } from './klingV3Omni'
import { minimaxHailuo23Model } from './minimaxHailuo23'
import { minimaxH3Model } from './minimaxH3'
import { viduQ3ProModel } from './viduQ3Pro'
import { viduQ3ProFastModel } from './viduQ3ProFast'
import { doubaoSeedance20Model } from './doubaoSeedance20'
import { doubaoSeedance20FastModel } from './doubaoSeedance20Fast'
import { doubaoSeedance20MiniModel } from './doubaoSeedance20Mini'

export { klingVideoO1Model } from './klingVideoO1'
export { klingV26Model } from './klingV26'
export { klingV3Model } from './klingV3'
export { klingV3OmniModel } from './klingV3Omni'
export { minimaxHailuo23Aliases, minimaxHailuoStartEndAliases, minimaxHailuo23Model } from './minimaxHailuo23'
export { minimaxH3Model } from './minimaxH3'
export { viduQ3ProAliases, viduQ3ProModel } from './viduQ3Pro'
export { viduQ3ProFastAliases, viduQ3ProFastModel } from './viduQ3ProFast'
export { doubaoSeedance20Model } from './doubaoSeedance20'
export { doubaoSeedance20FastModel } from './doubaoSeedance20Fast'
export { doubaoSeedance20MiniModel } from './doubaoSeedance20Mini'

export const videoModelModules: VideoModelModule[] = [
  doubaoSeedance20Model,
  doubaoSeedance20FastModel,
  doubaoSeedance20MiniModel,
  viduQ3ProFastModel,
  viduQ3ProModel,
  minimaxHailuo23Model,
  minimaxH3Model,
  klingVideoO1Model,
  klingV3OmniModel,
  klingV3Model,
  klingV26Model,
]
