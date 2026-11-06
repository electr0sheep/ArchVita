import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, open, writeFile, type FileHandle } from 'node:fs/promises'
import { dirname, join, normalize } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createInflateRaw } from 'node:zlib'

export interface ZipEntry {
  name: string
  method: number
  compressedSize: number
  size: number
  localHeaderOffset: number
  isDirectory: boolean
}

const EOCD_SIG = 0x06054b50
const EOCD64_LOCATOR_SIG = 0x07064b50
const EOCD64_SIG = 0x06064b50
const CENTRAL_SIG = 0x02014b50
const LOCAL_SIG = 0x04034b50

async function readAt(handle: FileHandle, position: number, length: number): Promise<Buffer> {
  const buffer = Buffer.alloc(length)
  let done = 0
  while (done < length) {
    const { bytesRead } = await handle.read(buffer, done, length - done, position + done)
    if (bytesRead === 0) break
    done += bytesRead
  }
  return buffer.subarray(0, done)
}

export async function readZipEntries(path: string): Promise<ZipEntry[]> {
  const handle = await open(path, 'r')
  try {
    const { size } = await handle.stat()
    const tailLength = Math.min(size, 22 + 65535 + 20)
    const tail = await readAt(handle, size - tailLength, tailLength)

    let eocd = -1
    for (let i = tail.length - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === EOCD_SIG) {
        eocd = i
        break
      }
    }
    if (eocd < 0) throw new Error('Not a zip file: no end-of-central-directory record')

    let count = tail.readUInt16LE(eocd + 10)
    let cdSize = tail.readUInt32LE(eocd + 12)
    let cdOffset = tail.readUInt32LE(eocd + 16)

    if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
      const locator = eocd - 20
      if (locator < 0 || tail.readUInt32LE(locator) !== EOCD64_LOCATOR_SIG) throw new Error('ZIP64 locator missing')
      const record = await readAt(handle, Number(tail.readBigUInt64LE(locator + 8)), 56)
      if (record.readUInt32LE(0) !== EOCD64_SIG) throw new Error('ZIP64 end record missing')
      count = Number(record.readBigUInt64LE(32))
      cdSize = Number(record.readBigUInt64LE(40))
      cdOffset = Number(record.readBigUInt64LE(48))
    }

    const cd = await readAt(handle, cdOffset, cdSize)
    const entries: ZipEntry[] = []
    let pos = 0
    for (let i = 0; i < count && pos + 46 <= cd.length; i++) {
      if (cd.readUInt32LE(pos) !== CENTRAL_SIG) throw new Error('Corrupt central directory')
      const method = cd.readUInt16LE(pos + 10)
      let compressedSize = cd.readUInt32LE(pos + 20)
      let entrySize = cd.readUInt32LE(pos + 24)
      const nameLength = cd.readUInt16LE(pos + 28)
      const extraLength = cd.readUInt16LE(pos + 30)
      const commentLength = cd.readUInt16LE(pos + 32)
      let localHeaderOffset = cd.readUInt32LE(pos + 42)
      const name = cd.toString('utf8', pos + 46, pos + 46 + nameLength)

      if (entrySize === 0xffffffff || compressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) {
        let ep = pos + 46 + nameLength
        const end = ep + extraLength
        while (ep + 4 <= end) {
          const id = cd.readUInt16LE(ep)
          const len = cd.readUInt16LE(ep + 2)
          if (id === 0x0001) {
            let fp = ep + 4
            if (entrySize === 0xffffffff) {
              entrySize = Number(cd.readBigUInt64LE(fp))
              fp += 8
            }
            if (compressedSize === 0xffffffff) {
              compressedSize = Number(cd.readBigUInt64LE(fp))
              fp += 8
            }
            if (localHeaderOffset === 0xffffffff) localHeaderOffset = Number(cd.readBigUInt64LE(fp))
            break
          }
          ep += 4 + len
        }
      }

      entries.push({ name, method, compressedSize, size: entrySize, localHeaderOffset, isDirectory: name.endsWith('/') })
      pos += 46 + nameLength + extraLength + commentLength
    }
    return entries
  } finally {
    await handle.close()
  }
}

export function safeZipPath(root: string, name: string): string {
  const relative = normalize(name).replace(/^[/\\]+/, '')
  if (relative.split(/[/\\]/).includes('..')) throw new Error(`Unsafe path in archive: ${name}`)
  return join(root, relative)
}

export async function extractEntry(path: string, entry: ZipEntry, destination: string): Promise<void> {
  const handle = await open(path, 'r')
  let dataStart: number
  try {
    const header = await readAt(handle, entry.localHeaderOffset, 30)
    if (header.readUInt32LE(0) !== LOCAL_SIG) throw new Error(`Corrupt local header for ${entry.name}`)
    dataStart = entry.localHeaderOffset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28)
  } finally {
    await handle.close()
  }

  await mkdir(dirname(destination), { recursive: true })
  if (entry.compressedSize === 0) {
    await writeFile(destination, Buffer.alloc(0))
    return
  }

  const source = createReadStream(path, { start: dataStart, end: dataStart + entry.compressedSize - 1 })
  const sink = createWriteStream(destination)
  if (entry.method === 8) await pipeline(source, createInflateRaw(), sink)
  else if (entry.method === 0) await pipeline(source, sink)
  else throw new Error(`Unsupported compression method ${entry.method} for ${entry.name}`)
}
