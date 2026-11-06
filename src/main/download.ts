import { createWriteStream } from 'node:fs'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { dirname } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as WebReadableStream } from 'node:stream/web'
import type { JobContext } from './jobs'

const USER_AGENT = 'ArchVita'

export const formatMb = (bytes: number): string => `${(bytes / (1 << 20)).toFixed(1)} MB`

export async function remoteSize(url: string): Promise<number | undefined> {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20000) })
    const length = res.headers.get('content-length')
    return res.ok && length ? Number(length) : undefined
  } catch {
    return undefined
  }
}

export async function downloadFile(url: string, destination: string, label: string, ctx: JobContext): Promise<number> {
  const expected = await remoteSize(url)
  try {
    const existing = await stat(destination)
    if (expected && existing.size === expected) {
      ctx.report(1, 1, `${label}: already downloaded (${formatMb(existing.size)})`)
      return existing.size
    }
  } catch {
    // not downloaded yet
  }

  await mkdir(dirname(destination), { recursive: true })
  const controller = new AbortController()
  const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': USER_AGENT }, signal: controller.signal })
  if (!res.ok || !res.body) throw new Error(`${label}: download failed with HTTP ${res.status}`)

  const total = Number(res.headers.get('content-length') ?? expected ?? 0)
  let received = 0
  let lastReport = 0
  const progress = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      try {
        ctx.checkCancelled()
      } catch (error) {
        controller.abort()
        callback(error as Error)
        return
      }
      received += chunk.length
      if (received - lastReport > 2 * 1024 * 1024 || received === total) {
        lastReport = received
        ctx.report(received, total, `${label}: ${formatMb(received)} of ${total ? formatMb(total) : '?'}`)
      }
      callback(null, chunk)
    }
  })

  const partial = `${destination}.part`
  try {
    await pipeline(Readable.fromWeb(res.body as unknown as WebReadableStream), progress, createWriteStream(partial))
  } catch (error) {
    await rm(partial, { force: true })
    throw error
  }
  await rename(partial, destination)
  return received
}
