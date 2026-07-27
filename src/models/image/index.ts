import type { ImageModelModule } from '../types'
import { doubaoSeedream50LiteModel } from './doubaoSeedream50Lite'
import { glmImageModel } from './glmImage'
import { qwenImage20ProModel } from './qwenImage20Pro'
import { qwenImageEditPlusModel } from './qwenImageEditPlus'

export { doubaoSeedream50LiteModel } from './doubaoSeedream50Lite'
export { glmImageModel } from './glmImage'
export { qwenImage20ProModel } from './qwenImage20Pro'
export { qwenImageEditPlusModel } from './qwenImageEditPlus'

export const imageModelModules: ImageModelModule[] = [
  doubaoSeedream50LiteModel,
  qwenImage20ProModel,
  qwenImageEditPlusModel,
  glmImageModel,
]