import { access, copyFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { thumbnailName } from '@shared/names'
import type { ArtStatus, Game, GameArt, SystemDef } from '@shared/types'
import type { JobContext } from './jobs'
import { artDir } from './paths'

export type ArtKind = 'boxart' | 'snap'

const REMOTE_DIRS: Record<ArtKind, string[]> = {
  boxart: ['Named_Boxarts'],
  snap: ['Named_Snaps', 'Named_Titles']
}

const CONCURRENCY = 4

export function artRelPath(game: Game, kind: ArtKind, custom = false): string {
  return join(game.systemId, `${thumbnailName(game.fileName)}.${custom ? 'custom.' : ''}${kind}.png`)
}

export function artAbsPath(rel: string): string {
  return join(artDir(), rel)
}

function candidateUrls(system: SystemDef, remoteDir: string, name: string): string[] {
  const file = `${encodeURIComponent(name)}.png`
  return [
    `https://thumbnails.libretro.com/${encodeURIComponent(system.libretroName)}/${remoteDir}/${file}`,
    `https://raw.githubusercontent.com/libretro-thumbnails/${system.libretroName.replace(/ /g, '_')}/master/${remoteDir}/${file}`
  ]
}

async function download(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
    if (!res.ok) return null
    if (!(res.headers.get('content-type') ?? '').includes('image')) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function fetchKind(game: Game, system: SystemDef, kind: ArtKind): Promise<string | undefined> {
  const name = thumbnailName(game.fileName)
  for (const remoteDir of REMOTE_DIRS[kind]) {
    for (const url of candidateUrls(system, remoteDir, name)) {
      const data = await download(url)
      if (!data) continue
      const rel = artRelPath(game, kind)
      const abs = artAbsPath(rel)
      await mkdir(dirname(abs), { recursive: true })
      await writeFile(abs, data)
      return rel
    }
  }
  return undefined
}

export function artStatus(art: GameArt): ArtStatus {
  const custom = [art.boxart, art.snap].some((p) => p?.includes('.custom.'))
  if (art.boxart && art.snap) return custom ? 'custom' : 'fetched'
  if (art.boxart || art.snap) return custom ? 'custom' : 'partial'
  return 'missing'
}

async function needsFetch(rel: string | undefined, force: boolean): Promise<boolean> {
  if (!rel) return true
  if (rel.includes('.custom.')) return false
  if (force) return true
  return !(await exists(artAbsPath(rel)))
}

export async function fetchArtwork(
  games: Game[],
  systems: Map<string, SystemDef>,
  force: boolean,
  ctx: JobContext
): Promise<void> {
  const queue = [...games]
  let done = 0

  const worker = async (): Promise<void> => {
    for (let game = queue.shift(); game; game = queue.shift()) {
      ctx.checkCancelled()
      const system = systems.get(game.systemId)
      if (system) {
        if (await needsFetch(game.art.boxart, force)) game.art.boxart = await fetchKind(game, system, 'boxart')
        if (await needsFetch(game.art.snap, force)) game.art.snap = await fetchKind(game, system, 'snap')
        game.art.status = artStatus(game.art)
      }
      done++
      ctx.report(done, games.length, `${game.name}: ${game.art.status}`, game.art.status === 'missing' ? 'warn' : 'info')
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, games.length) }, worker))
}

export async function setCustomArt(game: Game, kind: ArtKind, sourcePath: string): Promise<void> {
  const rel = artRelPath(game, kind, true)
  const abs = artAbsPath(rel)
  await mkdir(dirname(abs), { recursive: true })
  await copyFile(sourcePath, abs)
  game.art[kind] = rel
  game.art.status = artStatus(game.art)
}
