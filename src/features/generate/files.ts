export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (error) => reject(error)
  })
}

export function toRawBase64(value: string): string {
  const match = value.match(/^data:[^;]+;base64,(.*)$/)
  return match ? match[1] : value
}
