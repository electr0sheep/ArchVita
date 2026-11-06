import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { cleanGameName, stripExtension } from '@shared/names'
import { systemForFolder } from '@shared/systems'
import type { Game, GamePatch, Settings } from '@shared/types'
import type { JobContext } from './jobs'
import { libraryFile } from './paths'
import { makeTitleId } from './titleId'

let cache: Game[] | null = null

const byName = (a: { name: string }, b: { name: string }): number =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })

export async function loadGames(): Promise<Game[]> {
  if (cache) return cache
  try {
    cache = JSON.parse(await readFile(libraryFile(), 'utf8')) as Game[]
  } catch {
    cache = []
  }
  return cache
}

export async function saveGames(games: Game[]): Promise<void> {
  cache = games
  await mkdir(dirname(libraryFile()), { recursive: true })
  await writeFile(libraryFile(), JSON.stringify(games, null, 2))
}

export async function scanLibrary(settings: Settings, ctx: JobContext): Promise<Game[]> {
  if (!settings.libraryRoot) throw new Error('Set the ROM library folder in Settings first.')

  const previous = new Map((await loadGames()).map((g) => [g.id, g]))
  const usedIds = new Set<string>()
  const games: Game[] = []

  const folders = (await readdir(settings.libraryRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort(byName)

  for (const folder of folders) {
    ctx.checkCancelled()
    const system = systemForFolder(folder.name)
    if (!system) {
      ctx.report(games.length, 0, `Skipping ${folder.name}: not a known system folder`, 'warn')
      continue
    }
    const dir = join(settings.libraryRoot, folder.name)
    const files = (await readdir(dir, { withFileTypes: true }))
      .filter((f) => f.isFile() && !f.name.startsWith('.') && system.extensions.includes(extname(f.name).toLowerCase()))
      .sort(byName)

    for (const file of files) {
      const id = `${system.id}/${file.name}`
      const localPath = join(dir, file.name)
      const size = (await stat(localPath)).size
      const prev = previous.get(id)

      let salt = 0
      let titleId = prev?.titleId ?? makeTitleId(id)
      while (usedIds.has(titleId)) titleId = makeTitleId(id, ++salt)
      usedIds.add(titleId)

      games.push({
        id,
        systemId: system.id,
        fileName: file.name,
        localPath,
        size,
        name: settings.cleanNames ? cleanGameName(file.name) : stripExtension(file.name),
        titleId,
        selected: prev?.selected ?? false,
        emulator: prev?.emulator ?? system.emulator,
        core: prev?.core,
        customName: prev?.customName,
        art: prev?.art ?? { status: 'none' }
      })
    }
    ctx.report(games.length, 0, `${system.name}: ${files.length} games`)
  }

  await saveGames(games)
  return games
}

export async function patchGames(patches: { id: string; patch: GamePatch }[]): Promise<Game[]> {
  const games = await loadGames()
  const byId = new Map(patches.map((p) => [p.id, p.patch]))
  const next = games.map((game) => {
    const patch = byId.get(game.id)
    return patch ? { ...game, ...patch } : game
  })
  await saveGames(next)
  return next
}
