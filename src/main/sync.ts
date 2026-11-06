import { mkdir, readFile, rm, stat } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import { EMULATORS } from '@shared/emulators'
import { sanitizeVitaFileName } from '@shared/names'
import { SHADER_COMPILER_PATH, coreNameFromFile, packageById } from '@shared/packages'
import { systemById } from '@shared/systems'
import type { BuildFailure, BuildMode, BuildResult, BuiltBubble, EmulatorId, Game, SyncResult, SystemDef } from '@shared/types'
import { resolveCore, toFtpPath, vitaRomDir } from '@shared/uri'
import { bubbleTitle, buildBubbleFolder, type BubbleContext } from './bubble'
import type { JobContext } from './jobs'
import { stagingDir } from './paths'
import { LONG_CONNECT_ATTEMPTS, VitaFtp, type PromoteOutcome } from './vita'
import { folderToVpk } from './vpk'

interface BuiltFolder extends BuiltBubble {
  game: Game
  system: SystemDef
}

interface BuildOutcome {
  built: BuiltFolder[]
  failed: BuildFailure[]
}

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error))

const PROMOTE_DIR = 'ux0:data/ArchVita'

const safeFileName = (name: string): string => name.replace(/[<>:"/\\|?*]/g, '_').trim()

const formatBytes = (bytes: number): string =>
  bytes >= 1 << 20 ? `${(bytes / (1 << 20)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

const publicBubbles = (built: BuiltFolder[]): BuiltBubble[] =>
  built.map(({ gameId, titleId, name, path }) => ({ gameId, titleId, name, path }))

async function buildAll(games: Game[], ctx: BubbleContext, parentDir: string, job: JobContext): Promise<BuildOutcome> {
  await mkdir(parentDir, { recursive: true })
  const built: BuiltFolder[] = []
  const failed: BuildFailure[] = []

  for (const [i, game] of games.entries()) {
    job.checkCancelled()
    const name = bubbleTitle(game)
    const system = systemById(game.systemId)
    try {
      if (!system) throw new Error(`Unknown system "${game.systemId}"`)
      if (system.unsupportedReason) throw new Error(system.unsupportedReason)
      const path = await buildBubbleFolder(game, system, ctx, parentDir)
      built.push({ gameId: game.id, titleId: game.titleId, name, path, game, system })
      job.report(i + 1, games.length, `Built ${name} (${game.titleId})`)
    } catch (error) {
      failed.push({ gameId: game.id, name, error: errorMessage(error) })
      job.report(i + 1, games.length, `${name}: ${errorMessage(error)}`, 'error')
    }
  }
  return { built, failed }
}

export async function buildBubbles(games: Game[], mode: BuildMode, ctx: BubbleContext, job: JobContext): Promise<BuildResult> {
  if (mode === 'folders') {
    const outputDir = join(ctx.settings.outputDir, 'bubbles')
    const { built, failed } = await buildAll(games, ctx, outputDir, job)
    return { outputDir, built: publicBubbles(built), failed }
  }

  const outputDir = join(ctx.settings.outputDir, 'vpk')
  const staging = join(stagingDir(), 'vpk')
  await rm(staging, { recursive: true, force: true })
  const { built, failed } = await buildAll(games, ctx, staging, job)
  await mkdir(outputDir, { recursive: true })

  const packed: BuiltBubble[] = []
  for (const [i, bubble] of built.entries()) {
    job.checkCancelled()
    const vpkPath = join(outputDir, `${safeFileName(bubble.name)} [${bubble.titleId}].vpk`)
    try {
      await folderToVpk(bubble.path, vpkPath)
      packed.push({ gameId: bubble.gameId, titleId: bubble.titleId, name: bubble.name, path: vpkPath })
      job.report(i + 1, built.length, `Packed ${basename(vpkPath)}`)
    } catch (error) {
      failed.push({ gameId: bubble.gameId, name: bubble.name, error: errorMessage(error) })
      job.report(i + 1, built.length, `${bubble.name}: ${errorMessage(error)}`, 'error')
    }
  }
  return { outputDir, built: packed, failed }
}

async function companionFiles(localPath: string): Promise<string[]> {
  const ext = extname(localPath).toLowerCase()
  if (!['.cue', '.gdi', '.m3u'].includes(ext)) return []
  const dir = dirname(localPath)
  const text = await readFile(localPath, 'latin1')
  const refs: string[] = []

  if (ext === '.cue') {
    for (const match of text.matchAll(/^\s*FILE\s+(?:"([^"]+)"|(\S+))/gim)) refs.push(match[1] || match[2])
  } else if (ext === '.gdi') {
    for (const line of text.split(/\r?\n/).slice(1)) {
      const match = /^\s*\d+\s+\d+\s+\d+\s+\d+\s+"?([^"]+?)"?\s+\d+\s*$/.exec(line)
      if (match) refs.push(match[1])
    }
  } else {
    for (const line of text.split(/\r?\n/)) {
      const entry = line.trim()
      if (entry && !entry.startsWith('#')) refs.push(entry)
    }
  }

  const files: string[] = []
  for (const ref of refs) {
    const path = join(dir, ref)
    files.push(path)
    if (ext === '.m3u') files.push(...(await companionFiles(path)))
  }
  return files
}

async function checkTargets(ftp: VitaFtp, built: BuiltFolder[], job: JobContext): Promise<string[]> {
  const warnings: string[] = []
  const byEmulator = new Map<EmulatorId, BuiltFolder[]>()
  for (const bubble of built) byEmulator.set(bubble.game.emulator, [...(byEmulator.get(bubble.game.emulator) ?? []), bubble])

  let shaderCompiler: boolean | undefined
  for (const [emulator, list] of byEmulator) {
    const profile = EMULATORS[emulator]
    const appDir = `/ux0:/app/${profile.titleId}`
    if (!(await ftp.dirExists(appDir))) {
      warnings.push(`${profile.name} is not installed on the Vita, so ${list.length} bubble(s) will fail to launch until it is (Emulators tab).`)
      continue
    }
    if (profile.needsShaderCompiler) {
      shaderCompiler ??= await ftp.fileExists(toFtpPath(SHADER_COMPILER_PATH))
      if (!shaderCompiler) {
        warnings.push(
          `${profile.name} needs the runtime shader compiler (${SHADER_COMPILER_PATH}), which is not on the Vita; ${list.length} bubble(s) will fail until ShaRKBR33D has installed it (Emulators tab).`
        )
      }
    }
    const pkg = packageById(emulator)
    if (!pkg?.coreFiles) continue
    const installed = new Set(
      (await ftp.listDir(appDir)).map((entry) => coreNameFromFile(pkg, entry.name)).filter((core): core is string => core !== undefined)
    )
    const missing = new Map<string, number>()
    for (const bubble of list) {
      const core = resolveCore(bubble.game, bubble.system)
      if (core && !installed.has(core)) missing.set(core, (missing.get(core) ?? 0) + 1)
    }
    for (const [core, count] of missing) {
      warnings.push(`${profile.name} core "${core}" is not installed on the Vita; ${count} bubble(s) use it and will fail to launch.`)
    }
  }
  for (const warning of warnings) job.report(0, 0, warning, 'warn')
  return warnings
}

async function installBubble(ftp: VitaFtp, bubble: BuiltFolder, vpkDir: string, index: number, total: number, job: JobContext): Promise<PromoteOutcome> {
  const vpk = join(vpkDir, `${bubble.titleId}.vpk`)
  await folderToVpk(bubble.path, vpk)
  const { size } = await stat(vpk)
  const remote = `${PROMOTE_DIR}/${bubble.titleId}.vpk`
  job.report(index, total, `Uploading ${bubble.name} (${formatBytes(size)})`)
  await ftp.uploadFile(vpk, toFtpPath(remote), size)

  job.report(index, total, `VitaShell is installing ${bubble.name} (${bubble.titleId})`)
  let outcome: PromoteOutcome
  try {
    outcome = await ftp.promote(remote)
  } catch (error) {
    throw new Error(`${bubble.name}: ${errorMessage(error)} while VitaShell was installing it. Check the Vita before syncing again.`)
  }
  await ftp.deleteFile(toFtpPath(remote))
  if (outcome.status === 'ok') job.report(index + 1, total, `Installed ${bubble.name} (${bubble.titleId})`)
  return outcome
}

export async function syncToVita(games: Game[], ctx: BubbleContext, job: JobContext): Promise<SyncResult> {
  const { vita } = ctx.settings
  if (!vita.host.trim()) throw new Error('Set the Vita IP address in Settings first.')

  const staging = join(stagingDir(), 'sync')
  const vpkDir = join(stagingDir(), 'sync-vpk')
  await rm(staging, { recursive: true, force: true })
  await rm(vpkDir, { recursive: true, force: true })
  await mkdir(vpkDir, { recursive: true })
  const { built, failed } = await buildAll(games, ctx, staging, job)

  const notes: string[] = []
  let romsUploaded = 0
  let romsSkipped = 0
  let appMetaUpdated = 0
  let installed = 0
  let uploadedFolders = 0
  let promoteSupported = true

  const ftp = new VitaFtp()
  ftp.onRetry = (message) => job.report(0, 0, message, 'warn')
  ftp.checkCancelled = () => job.checkCancelled()
  ftp.verbose = vita.debugFtp
  ftp.onLog = (message) => job.report(0, 0, `ftp: ${message}`)
  job.report(0, built.length, `Connecting to ${vita.host}:${vita.port}`)
  await ftp.connect(vita.host.trim(), vita.port, LONG_CONNECT_ATTEMPTS)
  try {
    notes.push(...(await checkTargets(ftp, built, job)))
    if (built.length) await ftp.mkdirp(toFtpPath(PROMOTE_DIR))

    for (const [i, bubble] of built.entries()) {
      job.checkCancelled()
      if (promoteSupported) {
        const outcome = await installBubble(ftp, bubble, vpkDir, i, built.length, job)
        if (outcome.status === 'ok') {
          installed++
          continue
        }
        if (outcome.status === 'failed') {
          const error = `VitaShell could not install it (${outcome.message})`
          failed.push({ gameId: bubble.gameId, name: bubble.name, error })
          job.report(i + 1, built.length, `${bubble.name}: ${error}`, 'error')
          continue
        }
        promoteSupported = false
        job.report(
          i,
          built.length,
          'This FTP server has no PROM command (vitacompanion, or a VitaShell older than 0.95), so bubbles are uploaded as folders and need Refresh LiveArea.',
          'warn'
        )
      }

      const remote = `/ux0:/app/${bubble.titleId}`
      job.report(i, built.length, `Uploading bubble ${bubble.name} to ${remote}`)
      await ftp.uploadTree(bubble.path, remote)
      uploadedFolders++

      const appMeta = `/ur0:/appmeta/${bubble.titleId}`
      if (vita.updateAppMeta && (await ftp.dirExists(appMeta))) {
        await ftp.uploadFile(join(bubble.path, 'sce_sys', 'icon0.png'), `${appMeta}/icon0.png`)
        await ftp.uploadTree(join(bubble.path, 'sce_sys', 'livearea', 'contents'), `${appMeta}/livearea/contents`)
        appMetaUpdated++
      }
    }

    if (vita.uploadRoms) {
      const bySystem = new Map<string, BuiltFolder[]>()
      for (const bubble of built) bySystem.set(bubble.system.id, [...(bySystem.get(bubble.system.id) ?? []), bubble])

      let index = 0
      for (const list of bySystem.values()) {
        const system = list[0].system
        const remoteDir = toFtpPath(vitaRomDir(vita.romRoot, system))
        await ftp.mkdirp(remoteDir)
        const existing = new Map((await ftp.listDir(remoteDir)).map((entry) => [entry.name, entry.size]))

        for (const bubble of list) {
          job.checkCancelled()
          index++
          const files = [{ local: bubble.game.localPath, remoteName: sanitizeVitaFileName(bubble.game.fileName) }]
          for (const extra of await companionFiles(bubble.game.localPath)) files.push({ local: extra, remoteName: basename(extra) })

          for (const file of files) {
            let size: number
            try {
              size = (await stat(file.local)).size
            } catch {
              job.report(index, built.length, `${bubble.name}: referenced file missing: ${file.local}`, 'warn')
              continue
            }
            if (existing.get(file.remoteName) === size) {
              romsSkipped++
              continue
            }
            job.report(index, built.length, `Uploading ${file.remoteName} (${formatBytes(size)})`)
            await ftp.uploadFile(file.local, `${remoteDir}/${file.remoteName}`, size)
            existing.set(file.remoteName, size)
            romsUploaded++
          }
        }
      }
    }
  } finally {
    ftp.close()
  }

  if (installed) notes.push(`${installed} bubble(s) were installed by VitaShell and are already on the home screen.`)
  if (uploadedFolders) {
    notes.push(
      `In VitaShell, back out to the device list (ux0:, ur0:, ...), press Triangle and choose "Refresh LiveArea" so the ${uploadedFolders} uploaded bubble(s) show up on the home screen.`
    )
  }
  if (appMetaUpdated) notes.push(`${appMetaUpdated} already-registered bubble(s) had their home screen art refreshed in place.`)
  if (!vita.uploadRoms) notes.push('ROM upload is off: the ROMs must already exist at the configured path on the Vita.')

  const failedIds = new Set(failed.map((f) => f.gameId))
  return {
    outputDir: staging,
    built: publicBubbles(built.filter((b) => !failedIds.has(b.gameId))),
    failed,
    romsUploaded,
    romsSkipped,
    appMetaUpdated,
    notes
  }
}
