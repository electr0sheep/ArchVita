import sharp from 'sharp'

export const ICON_SIZE = 128
export const BG_WIDTH = 840
export const BG_HEIGHT = 500
export const STARTUP_WIDTH = 280
export const STARTUP_HEIGHT = 158

const PNG_OPTIONS = { palette: true, colours: 256, dither: 1.0 }
const FONT = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] ?? c)
}

function hueFor(value: string): number {
  let hash = 0
  for (const ch of value) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return hash % 360
}

function initials(title: string): string {
  const words = title.split(/[^A-Za-z0-9]+/).filter(Boolean)
  const letters = words.slice(0, 2).map((w) => w[0].toUpperCase()).join('')
  return letters || '?'
}

function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    if (line && (line + ' ' + word).length > maxChars) {
      lines.push(line)
      line = word
    } else {
      line = line ? `${line} ${word}` : word
    }
    if (lines.length === maxLines) break
  }
  if (lines.length < maxLines && line) lines.push(line)
  if (lines.length === maxLines && line && lines[maxLines - 1] !== line) {
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, Math.max(0, maxChars - 1)) + '…'
  }
  return lines
}

function gradientSvg(width: number, height: number, hue: number, body: string): Buffer {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue}, 55%, 38%)"/>
      <stop offset="1" stop-color="hsl(${(hue + 40) % 360}, 60%, 18%)"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#g)"/>
  ${body}
</svg>`)
}

function placeholderSvg(width: number, height: number, title: string, subtitle: string): Buffer {
  const hue = hueFor(title)
  const big = Math.round(height * 0.38)
  const small = Math.max(12, Math.round(height * 0.1))
  const body = `<text x="50%" y="${Math.round(height * 0.52)}" text-anchor="middle" font-family="${FONT}" font-size="${big}" font-weight="700" fill="#ffffff">${escapeXml(initials(title))}</text>
  <text x="50%" y="${Math.round(height * 0.8)}" text-anchor="middle" font-family="${FONT}" font-size="${small}" fill="rgba(255,255,255,0.8)">${escapeXml(subtitle)}</text>`
  return gradientSvg(width, height, hue, body)
}

function labelSvg(width: number, height: number, title: string, subtitle: string): Buffer {
  const lines = wrap(title, 22, 2)
  const size = 20
  const startY = height - 16 - (lines.length - 1) * (size + 4) - 26
  const text = lines
    .map((line, i) => `<text x="16" y="${startY + i * (size + 4)}" font-family="${FONT}" font-size="${size}" font-weight="700" fill="#ffffff">${escapeXml(line)}</text>`)
    .join('\n  ')
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect x="0" y="${Math.round(height * 0.45)}" width="${width}" height="${Math.round(height * 0.55)}" fill="rgba(0,0,0,0.35)"/>
  ${text}
  <text x="16" y="${height - 14}" font-family="${FONT}" font-size="13" fill="rgba(255,255,255,0.85)">${escapeXml(subtitle.toUpperCase())}</text>
</svg>`)
}

async function finish(image: sharp.Sharp): Promise<Buffer> {
  return image.png(PNG_OPTIONS).toBuffer()
}

async function coverBlur(input: string, width: number, height: number, sigma: number, brightness: number): Promise<Buffer> {
  return sharp(input).resize(width, height, { fit: 'cover' }).blur(sigma).modulate({ brightness }).png().toBuffer()
}

async function fitInside(input: string, width: number, height: number): Promise<{ data: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(input).resize(width, height, { fit: 'inside' }).png().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

export async function renderIcon(boxart: string | null, title: string, system: string): Promise<Buffer> {
  if (!boxart) return finish(sharp(placeholderSvg(ICON_SIZE, ICON_SIZE, title, system)))
  const background = await coverBlur(boxart, ICON_SIZE, ICON_SIZE, 6, 0.55)
  const art = await fitInside(boxart, ICON_SIZE - 14, ICON_SIZE - 14)
  return finish(sharp(background).composite([{ input: art.data, gravity: 'centre' }]))
}

export async function renderBackground(snap: string | null, boxart: string | null, title: string, system: string): Promise<Buffer> {
  if (snap) return finish(sharp(snap).resize(BG_WIDTH, BG_HEIGHT, { fit: 'cover' }).modulate({ brightness: 0.8 }))
  if (boxart) {
    const background = await coverBlur(boxart, BG_WIDTH, BG_HEIGHT, 30, 0.45)
    const art = await fitInside(boxart, Math.round(BG_WIDTH * 0.45), BG_HEIGHT - 80)
    const left = BG_WIDTH - art.width - 60
    const top = Math.round((BG_HEIGHT - art.height) / 2)
    return finish(sharp(background).composite([{ input: art.data, left, top }]))
  }
  return finish(sharp(placeholderSvg(BG_WIDTH, BG_HEIGHT, title, system)))
}

export async function renderStartup(boxart: string | null, title: string, system: string): Promise<Buffer> {
  const base = boxart
    ? sharp(await coverBlur(boxart, STARTUP_WIDTH, STARTUP_HEIGHT, 4, 0.5))
    : sharp(gradientSvg(STARTUP_WIDTH, STARTUP_HEIGHT, hueFor(title), ''))
  try {
    return await finish(base.composite([{ input: labelSvg(STARTUP_WIDTH, STARTUP_HEIGHT, title, system), left: 0, top: 0 }]))
  } catch {
    return finish(base)
  }
}
