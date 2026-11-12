/** gifenc 没有随包发布类型声明，这里只声明项目里用到的 API。 */
declare module 'gifenc' {
  export type GifPaletteFormat = 'rgb565' | 'rgb444' | 'rgba4444'

  export interface GifEncoderFrameOptions {
    palette?: number[][]
    delay?: number
    repeat?: number
    transparent?: boolean
    transparentIndex?: number
    dispose?: number
    colorDepth?: number
  }

  export interface GifEncoder {
    writeFrame(index: Uint8Array, width: number, height: number, options?: GifEncoderFrameOptions): void
    finish(): void
    bytes(): Uint8Array
    bytesView(): Uint8Array
    reset(): void
  }

  export function GIFEncoder(options?: { initialCapacity?: number; auto?: boolean }): GifEncoder
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: { format?: GifPaletteFormat; oneBitAlpha?: boolean; clearAlpha?: boolean },
  ): number[][]
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: GifPaletteFormat,
  ): Uint8Array
}
