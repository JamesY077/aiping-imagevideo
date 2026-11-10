import type { ImageModelModule } from '../types'
import { doubaoSeedream50LiteModel } from './doubaoSeedream50Lite'
import { qwenImage20ProModel } from './qwenImage20Pro'
import { mossImageSftModel } from './mossImage'

export { doubaoSeedream50LiteModel } from './doubaoSeedream50Lite'
export { qwenImage20ProModel } from './qwenImage20Pro'
export { mossImageSftModel } from './mossImage'

export const imageModelModules: ImageModelModule[] = [
  doubaoSeedream50LiteModel,
  qwenImage20ProModel,
  mossImageSftModel,
]
