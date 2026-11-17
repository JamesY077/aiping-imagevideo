import type { ImageModelModule } from '../types'
import { doubaoSeedream50LiteModel } from './doubaoSeedream50Lite'
import { mossImageSftModel } from './mossImage'

export { doubaoSeedream50LiteModel } from './doubaoSeedream50Lite'
export { mossImageSftModel } from './mossImage'

export const imageModelModules: ImageModelModule[] = [
  doubaoSeedream50LiteModel,
  mossImageSftModel,
]
