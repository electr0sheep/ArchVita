export function stripExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot > 0 ? fileName.slice(0, dot) : fileName
}

export function cleanGameName(fileName: string): string {
  let name = stripExtension(fileName)
  name = name.replace(/\s*[([][^)\]]*[)\]]/g, '')
  name = name.replace(/\s+/g, ' ').trim()
  name = name.replace(/^(.+?), (The|A|An)(?= - |$)/i, '$2 $1')
  return name || stripExtension(fileName)
}

export function thumbnailName(fileName: string): string {
  return stripExtension(fileName).replace(/[&*/:`<>?\\|"]/g, '_')
}

export function sanitizeVitaFileName(fileName: string): string {
  return fileName.replace(/&/g, '_')
}

export function truncateUtf8(value: string, maxBytes: number): string {
  const encoder = new TextEncoder()
  if (encoder.encode(value).length <= maxBytes) return value
  let out = ''
  for (const ch of value) {
    if (encoder.encode(out + ch).length > maxBytes) break
    out += ch
  }
  return out
}
