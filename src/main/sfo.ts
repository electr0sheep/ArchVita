import { truncateUtf8 } from '@shared/names'

const FMT_UTF8 = 0x0204
const FMT_INT32 = 0x0404

interface Entry {
  key: string
  fmt: number
  value: string | number
  maxLen: number
}

const str = (key: string, value: string, maxLen: number): Entry => ({ key, fmt: FMT_UTF8, value, maxLen })
const int = (key: string, value: number): Entry => ({ key, fmt: FMT_INT32, value, maxLen: 4 })

export interface SfoOptions {
  title: string
  titleId: string
  appVer?: string
}

export function buildParamSfo(options: SfoOptions): Buffer {
  const title = truncateUtf8(options.title, 127)
  const shortTitle = truncateUtf8(options.title, 51)
  const entries: Entry[] = [
    str('APP_VER', options.appVer ?? '01.00', 8),
    int('ATTRIBUTE', 0x8000),
    int('ATTRIBUTE2', 0),
    int('ATTRIBUTE_MINOR', 0x10),
    str('BOOT_FILE', '', 32),
    str('CATEGORY', 'gd', 4),
    str('CONTENT_ID', '', 48),
    int('EBOOT_APP_MEMSIZE', 0),
    int('EBOOT_ATTRIBUTE', 0),
    int('EBOOT_PHY_MEMSIZE', 0),
    int('LAREA_TYPE', 0),
    str('NP_COMMUNICATION_ID', '', 16),
    int('PARENTAL_LEVEL', 0),
    str('PSP2_DISP_VER', '00.000', 8),
    int('PSP2_SYSTEM_VER', 0),
    str('STITLE', shortTitle, 52),
    str('TITLE', title, 128),
    str('TITLE_ID', options.titleId, 12),
    str('VERSION', '00.00', 8)
  ].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))

  const keyTable = Buffer.concat(entries.map((e) => Buffer.from(e.key + '\0', 'latin1')))
  const keyTablePadded = Buffer.concat([keyTable, Buffer.alloc((4 - (keyTable.length % 4)) % 4)])
  const dataTable = Buffer.alloc(entries.reduce((sum, e) => sum + e.maxLen, 0))

  const headerSize = 20
  const indexSize = entries.length * 16
  const keyTableStart = headerSize + indexSize
  const dataTableStart = keyTableStart + keyTablePadded.length

  const index = Buffer.alloc(indexSize)
  let keyOffset = 0
  let dataOffset = 0
  entries.forEach((entry, i) => {
    let dataLen: number
    if (entry.fmt === FMT_INT32) {
      dataTable.writeUInt32LE(Number(entry.value) >>> 0, dataOffset)
      dataLen = 4
    } else {
      const bytes = Buffer.from(String(entry.value), 'utf8')
      bytes.copy(dataTable, dataOffset)
      dataLen = bytes.length + 1
    }
    const at = i * 16
    index.writeUInt16LE(keyOffset, at)
    index.writeUInt16LE(entry.fmt, at + 2)
    index.writeUInt32LE(dataLen, at + 4)
    index.writeUInt32LE(entry.maxLen, at + 8)
    index.writeUInt32LE(dataOffset, at + 12)
    keyOffset += entry.key.length + 1
    dataOffset += entry.maxLen
  })

  const header = Buffer.alloc(headerSize)
  header.write('\0PSF', 0, 'latin1')
  header.writeUInt32LE(0x00000101, 4)
  header.writeUInt32LE(keyTableStart, 8)
  header.writeUInt32LE(dataTableStart, 12)
  header.writeUInt32LE(entries.length, 16)

  return Buffer.concat([header, index, keyTablePadded, dataTable])
}

export function readSfoString(sfo: Buffer, wantedKey: string): string | undefined {
  if (sfo.length < 20 || sfo.readUInt32LE(0) !== 0x46535000) return undefined
  const keyTableStart = sfo.readUInt32LE(8)
  const dataTableStart = sfo.readUInt32LE(12)
  const count = sfo.readUInt32LE(16)
  for (let i = 0; i < count; i++) {
    const at = 20 + i * 16
    if (at + 16 > sfo.length) break
    const keyOffset = sfo.readUInt16LE(at)
    const format = sfo.readUInt16LE(at + 2)
    const dataLen = sfo.readUInt32LE(at + 4)
    const dataOffset = sfo.readUInt32LE(at + 12)
    const keyEnd = sfo.indexOf(0, keyTableStart + keyOffset)
    const key = sfo.toString('latin1', keyTableStart + keyOffset, keyEnd < 0 ? undefined : keyEnd)
    if (key !== wantedKey) continue
    if (format !== FMT_UTF8 && format !== 0x0004) return undefined
    const start = dataTableStart + dataOffset
    return sfo.toString('utf8', start, start + dataLen).replace(/\0+$/, '')
  }
  return undefined
}
