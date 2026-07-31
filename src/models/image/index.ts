import type { ImageModelModule } from '../types'
import { doubaoSeedream50LiteModel } from './doubaoSeedream50Lite'
import { qwenImage20ProModel } from './qwenImage20Pro'

export { doubaoSeedream50LiteModel } from './doubaoSeedream50Lite'
export { qwenImage20ProModel } from './qwenImage20Pro'

export const imageModelModules: ImageModelModule[] = [
  doubaoSeedream50LiteModel,
  qwenImage20ProModel,
]
