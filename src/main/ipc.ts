import { app, dialog, ipcMain, shell } from 'electron'
import { SYSTEMS, systemById } from '@shared/systems'
import type { ArtFetchOptions, BuildOptions, Game, GamePatch, InstallOptions, Settings, SyncOptions, VitaTestResult } from '@shared/types'
import { buildLaunchUri } from '@shared/uri'
import { fetchArtwork, setCustomArt, type ArtKind } from './artwork'
import type { BubbleContext } from './bubble'
import { checkEmulators, installEmulator, resolvePackages } from './emulators'
import { createSystemFolders } from './folders'
import { cancelJob, runJob } from './jobs'
import { launcherStatus, loadLauncher } from './launcher'
import { loadGames, patchGames, saveGames, scanLibrary } from './library'
import { getSettings, updateSettings } from './settings'
import { buildBubbles, syncToVita } from './sync'
import { VitaFtp } from './vita'

const systemsById = new Map(SYSTEMS.map((s) => [s.id, s]))

const handle = (channel: string, fn: (...args: never[]) => unknown): void => {
  ipcMain.handle(`archvita:${channel}`, (_event, ...args) => fn(...(args as never[])))
}

async function selectedGames(ids: string[]): Promise<Game[]> {
  const wanted = new Set(ids)
  const games = (await loadGames()).filter((g) => wanted.has(g.id))
  if (!games.length) throw new Error('No games selected.')
  return games
}

async function bubbleContext(): Promise<BubbleContext> {
  const settings = await getSettings()
  return { settings, launcher: await loadLauncher(settings), version: app.getVersion() }
}

export function registerIpc(): void {
  handle('getSettings', () => getSettings())
  handle('saveSettings', (patch: Partial<Settings>) => updateSettings(patch))

  handle('pickFolder', async (title: string, defaultPath?: string) => {
    const result = await dialog.showOpenDialog({ title, defaultPath, properties: ['openDirectory', 'createDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })

  handle('pickImage', async (title: string) => {
    const result = await dialog.showOpenDialog({
      title,
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  handle('openPath', async (path: string) => {
    const error = await shell.openPath(path)
    if (error) throw new Error(error)
  })

  handle('getGames', () => loadGames())
  handle('scanLibrary', () => runJob('scan', async (ctx) => scanLibrary(await getSettings(), ctx)))
  handle('createSystemFolders', async () => createSystemFolders(await getSettings()))
  handle('patchGames', (patches: { id: string; patch: GamePatch }[]) => patchGames(patches))

  handle('fetchArtwork', (options: ArtFetchOptions) =>
    runJob('artwork', async (ctx) => {
      const games = await loadGames()
      const wanted = new Set(options.gameIds)
      await fetchArtwork(
        games.filter((g) => wanted.has(g.id)),
        systemsById,
        options.force,
        ctx
      )
      await saveGames(games)
      return games
    })
  )

  handle('setCustomArt', async (gameId: string, kind: ArtKind, filePath: string) => {
    const games = await loadGames()
    const game = games.find((g) => g.id === gameId)
    if (!game) throw new Error('Game not found')
    await setCustomArt(game, kind, filePath)
    await saveGames(games)
    return games
  })

  handle('previewUri', async (gameId: string) => {
    const game = (await loadGames()).find((g) => g.id === gameId)
    const system = game && systemById(game.systemId)
    if (!game || !system) throw new Error('Game not found')
    return buildLaunchUri(game, system, await getSettings())
  })

  handle('build', (options: BuildOptions) =>
    runJob('build', async (ctx) => buildBubbles(await selectedGames(options.gameIds), options.mode, await bubbleContext(), ctx))
  )

  handle('sync', (options: SyncOptions) =>
    runJob('sync', async (ctx) => syncToVita(await selectedGames(options.gameIds), await bubbleContext(), ctx))
  )

  handle('testVita', async (): Promise<VitaTestResult> => {
    const { vita } = await getSettings()
    if (!vita.host.trim()) return { ok: false, message: 'No Vita IP address configured.', devices: [] }
    const ftp = new VitaFtp()
    try {
      await ftp.connect(vita.host.trim(), vita.port)
      const devices = await ftp.listRoot()
      return { ok: true, message: `Connected to ${vita.host}:${vita.port}`, devices }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error), devices: [] }
    } finally {
      ftp.close()
    }
  })

  handle('launcherStatus', async () => launcherStatus(await getSettings()))

  handle('resolveEmulators', async (force: boolean) => resolvePackages(force, (await getSettings()).retroarchChannel))
  handle('checkEmulators', () => runJob('check emulators', async () => checkEmulators(await getSettings())))
  handle('installEmulator', (options: InstallOptions) =>
    runJob('install emulator', async (ctx) => installEmulator(options, await getSettings(), ctx))
  )
  handle('pickVpk', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose a VPK to install',
      properties: ['openFile'],
      filters: [{ name: 'Vita packages', extensions: ['vpk', 'zip'] }]
    })
    return result.canceled ? null : result.filePaths[0]
  })
  handle('cancelJob', () => cancelJob())
}
