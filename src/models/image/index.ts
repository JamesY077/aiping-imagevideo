import type { ImageModelModule } from '../types'
import { doubaoSeedream50LiteModel } from './doubaoSeedream50Lite'
import { minimaxH3ImageModel, minimaxH3ImageHighspeedModel } from './minimaxH3Image'
import { mossImageSftModel } from './mossImage'

export { doubaoSeedream50LiteModel } from './doubaoSeedream50Lite'
export { minimaxH3ImageModel, minimaxH3ImageHighspeedModel } from './minimaxH3Image'
export { mossImageSftModel } from './mossImage'

export const imageModelModules: ImageModelModule[] = [
  doubaoSeedream50LiteModel,
  minimaxH3ImageModel,
  minimaxH3ImageHighspeedModel,
  mossImageSftModel,
]
