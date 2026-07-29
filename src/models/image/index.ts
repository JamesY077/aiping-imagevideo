import type { ImageModelModule } from '../types'
import { doubaoSeedream45Model } from './doubaoSeedream45'
import { doubaoSeedream50LiteModel } from './doubaoSeedream50Lite'
import { qwenImage20ProModel } from './qwenImage20Pro'

export { doubaoSeedream45Model } from './doubaoSeedream45'
export { doubaoSeedream50LiteModel } from './doubaoSeedream50Lite'
export { qwenImage20ProModel } from './qwenImage20Pro'

export const imageModelModules: ImageModelModule[] = [
  doubaoSeedream45Model,
  doubaoSeedream50LiteModel,
  qwenImage20ProModel,
]