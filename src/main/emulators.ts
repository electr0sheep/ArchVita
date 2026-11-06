import { access, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ALL_PACKAGES, EMULATOR_PACKAGES, SHADER_COMPILER_PATH, coreNameFromFile, coreNameFromInfoFile, packageById } from '@shared/packages'
import type {
  EmulatorPackage,
  EmulatorStatus,
  InstallOptions,
  InstallResult,
  PackageId,
  PackageSource,
  ReleaseChannel,
  ResolvedPackage,
  Settings,
  VitaCheck
} from '@shared/types'
import { downloadFile, formatMb, remoteSize } from './download'
import { buildHeadBin } from './headbin'
import type { JobContext } from './jobs'
import { downloadsDir, stagingDir } from './paths'
import { readSfoString } from './sfo'
import { LONG_CONNECT_ATTEMPTS, VitaFtp } from './vita'
import { toFtpPath } from '@shared/uri'
import { extractEntry, readZipEntries, safeZipPath, type ZipEntry } from './zip'

const LIBRETRO_STABLE = 'https://buildbot.libretro.com/stable/'
const LIBRETRO_NIGHTLY = 'https://buildbot.libretro.com/nightly/playstation/vita/'
const FALLBACK_RETROARCH_VERSION = '1.22.2'
const GITHUB_API = 'https://api.github.com/repos/'

interface ResolvedSource {
  version: string
  url: string
  size?: number
}

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error))

const compareVersions = (a: string, b: string): number => {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff) return diff
  }
  return 0
}

const safeName = (value: string): string => value.replace(/[^A-Za-z0-9._-]/g, '_')

async function countFiles(dir: string): Promise<number> {
  let count = 0
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) count += await countFiles(join(dir, entry.name))
    else if (entry.isFile()) count++
  }
  return count
}

async function resolveSource(source: PackageSource, channel: ReleaseChannel): Promise<ResolvedSource> {
  if (source.kind === 'libretro' && channel === 'nightly') {
    let date = ''
    try {
      const html = await (await fetch(LIBRETRO_NIGHTLY, { signal: AbortSignal.timeout(20000) })).text()
      const dates = [...html.matchAll(/(\d{4}-\d{2}-\d{2})_RetroArch\.vpk"/g)].map((m) => m[1]).sort()
      if (dates.length) date = dates[dates.length - 1]
    } catch {
      // fall back to the undated latest build
    }
    const url = `${LIBRETRO_NIGHTLY}${date ? `${date}_` : ''}${source.file}`
    return { version: date ? `nightly ${date}` : 'nightly', url, size: await remoteSize(url) }
  }

  if (source.kind === 'libretro') {
    let version = FALLBACK_RETROARCH_VERSION
    try {
      const html = await (await fetch(LIBRETRO_STABLE, { signal: AbortSignal.timeout(20000) })).text()
      const versions = [...html.matchAll(/href="\/stable\/(\d+\.\d+\.\d+)\/"/g)].map((m) => m[1]).sort(compareVersions)
      if (versions.length) version = versions[versions.length - 1]
    } catch {
      // keep the fallback version
    }
    const url = `${LIBRETRO_STABLE}${version}/playstation/vita/${source.file}`
    return { version, url, size: await remoteSize(url) }
  }

  const res = await fetch(`${GITHUB_API}${source.repo}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ArchVita' },
    signal: AbortSignal.timeout(20000)
  })
  if (!res.ok) throw new Error(`GitHub returned HTTP ${res.status} for ${source.repo}`)
  const release = (await res.json()) as { tag_name: string; assets: { name: string; size: number; browser_download_url: string }[] }
  const pattern = new RegExp(source.assetPattern, 'i')
  const asset = release.assets.find((a) => pattern.test(a.name))
  if (!asset) throw new Error(`No file matching ${source.assetPattern} in ${source.repo} release ${release.tag_name}`)
  return { version: release.tag_name, url: asset.browser_download_url, size: asset.size }
}

const resolved = new Map<PackageId, ResolvedPackage>()

export async function resolvePackages(force: boolean, channel: ReleaseChannel): Promise<ResolvedPackage[]> {
  return Promise.all(
    ALL_PACKAGES.map(async (pkg) => {
      const cached = resolved.get(pkg.id)
      const sameChannel = pkg.app.kind !== 'libretro' || cached?.channel === channel
      if (cached && !cached.error && !force && sameChannel) return cached
      try {
        const app = await resolveSource(pkg.app, channel)
        const data = pkg.data ? await resolveSource(pkg.data.source, channel) : undefined
        const entry: ResolvedPackage = {
          id: pkg.id,
          channel,
          version: app.version,
          url: app.url,
          size: app.size,
          dataUrl: data?.url,
          dataSize: data?.size
        }
        resolved.set(pkg.id, entry)
        return entry
      } catch (error) {
        const entry: ResolvedPackage = { id: pkg.id, version: '', url: '', error: errorMessage(error) }
        resolved.set(pkg.id, entry)
        return entry
      }
    })
  )
}

async function cachedArchive(pkg: EmulatorPackage): Promise<string | undefined> {
  const info = resolved.get(pkg.id)
  if (!info || info.error) return undefined
  const path = join(downloadsDir(), `${pkg.id}-${safeName(info.version)}.vpk`)
  try {
    await access(path)
    return path
  } catch {
    return undefined
  }
}

async function expectedCoreSizes(pkg: EmulatorPackage): Promise<Map<string, number> | undefined> {
  const archive = await cachedArchive(pkg)
  if (!archive) return undefined
  const sizes = new Map<string, number>()
  for (const entry of await readZipEntries(archive)) {
    const core = coreNameFromFile(pkg, entry.name)
    if (core !== undefined) sizes.set(core, entry.size)
  }
  return sizes
}

export async function checkEmulators(settings: Settings): Promise<VitaCheck> {
  const { vita } = settings
  if (!vita.host.trim()) throw new Error('Set the Vita IP address in Settings first.')
  const ftp = new VitaFtp()
  await ftp.connect(vita.host.trim(), vita.port)
  try {
    const statuses: EmulatorStatus[] = []
    for (const pkg of EMULATOR_PACKAGES) {
      const dir = `/ux0:/app/${pkg.titleId}`
      const installed = await ftp.dirExists(dir)
      const cores: string[] = []
      const damagedCores: string[] = []
      let verified = false
      if (installed && pkg.coreFiles) {
        const expected = await expectedCoreSizes(pkg)
        verified = expected !== undefined
        for (const entry of await ftp.listDir(dir)) {
          const core = coreNameFromFile(pkg, entry.name)
          if (core === undefined) continue
          cores.push(core)
          const size = expected?.get(core)
          if (size !== undefined && size !== entry.size) damagedCores.push(core)
        }
        cores.sort()
        damagedCores.sort()
      }
      statuses.push({ id: pkg.id as EmulatorStatus['id'], installed, cores, damagedCores, verified })
    }
    const shaderCompiler = await ftp.fileExists(toFtpPath(SHADER_COMPILER_PATH))
    return { emulators: statuses, shaderCompiler }
  } finally {
    ftp.close()
  }
}

async function extractAll(
  archive: string,
  entries: ZipEntry[],
  destinationFor: (entry: ZipEntry) => string,
  label: string,
  ctx: JobContext
): Promise<number> {
  let bytes = 0
  for (const [i, entry] of entries.entries()) {
    ctx.checkCancelled()
    await extractEntry(archive, entry, destinationFor(entry))
    bytes += entry.size
    if (i % 10 === 0 || i === entries.length - 1) ctx.report(i + 1, entries.length, `${label}: extracting ${entry.name}`)
  }
  return bytes
}

async function readTitleId(archive: string, entries: ZipEntry[]): Promise<string | undefined> {
  const sfo = entries.find((e) => e.name === 'sce_sys/param.sfo')
  if (!sfo) return undefined
  const temp = join(stagingDir(), 'param.sfo')
  await extractEntry(archive, sfo, temp)
  return readSfoString(await readFile(temp), 'TITLE_ID')
}

async function fetchPackage(
  pkg: EmulatorPackage,
  channel: ReleaseChannel,
  ctx: JobContext
): Promise<{ app: string; data?: string; version: string; dataSize?: number }> {
  const info = (await resolvePackages(false, channel)).find((r) => r.id === pkg.id)
  if (!info || info.error) throw new Error(info?.error ?? `Cannot resolve ${pkg.name}`)
  const app = join(downloadsDir(), `${pkg.id}-${safeName(info.version)}.vpk`)
  await downloadFile(info.url, app, `${pkg.name} ${info.version}`, ctx)
  let data: string | undefined
  if (pkg.data && info.dataUrl) {
    data = join(downloadsDir(), `${pkg.id}-${safeName(info.version)}-data.zip`)
    await downloadFile(info.dataUrl, data, `${pkg.name} data files`, ctx)
  }
  return { app, data, version: info.version, dataSize: info.dataSize }
}

export async function installEmulator(options: InstallOptions, settings: Settings, ctx: JobContext): Promise<InstallResult> {
  const pkg = options.packageId ? packageById(options.packageId) : undefined
  if (!pkg && !options.localVpk) throw new Error('Nothing to install.')
  if (options.mode === 'ftp' && !settings.vita.host.trim()) throw new Error('Set the Vita IP address in Settings first.')

  const notes: string[] = []
  const label = pkg?.name ?? 'VPK'
  const { vita } = settings

  if (options.mode === 'ftp') {
    ctx.report(0, 1, `Checking that the Vita answers at ${vita.host}:${vita.port}`)
    const probe = new VitaFtp()
    probe.onRetry = (message) => ctx.report(0, 0, message, 'warn')
    probe.checkCancelled = () => ctx.checkCancelled()
    await probe.connect(vita.host.trim(), vita.port, 2)
    probe.close()
  }

  let archive: string
  let dataArchive: string | undefined

  if (options.localVpk) {
    archive = options.localVpk
  } else {
    const fetched = await fetchPackage(pkg!, settings.retroarchChannel, ctx)
    archive = fetched.app
    if (options.includeData !== false) dataArchive = fetched.data
  }

  const entries = await readZipEntries(archive)
  const titleId = (await readTitleId(archive, entries)) ?? pkg?.titleId
  if (!titleId || !/^[A-Z0-9]{9}$/.test(titleId)) throw new Error(`${label}: the package has no usable TITLE_ID`)
  if (pkg && titleId !== pkg.titleId) notes.push(`The package's title ID is ${titleId}, but bubbles launch ${pkg.titleId}.`)

  const selectedCores = new Set(options.cores ?? [])
  const keep = (entry: ZipEntry): boolean => {
    if (!pkg?.coreFiles) return true
    const core = coreNameFromFile(pkg, entry.name) ?? coreNameFromInfoFile(pkg, entry.name)
    if (core === undefined) return !options.coresOnly
    return !!options.allCores || selectedCores.has(core)
  }
  const wanted = entries.filter((e) => !e.isDirectory && keep(e))
  if (pkg?.coreFiles && !options.allCores) {
    const available = new Set(entries.map((e) => coreNameFromFile(pkg, e.name)))
    const missing = [...selectedCores].filter((core) => !available.has(core))
    if (missing.length) notes.push(`Not included in this package: ${missing.join(', ')}.`)
  }
  if (!wanted.length) throw new Error(`${label}: nothing selected to install`)

  const root = options.mode === 'folder' ? join(settings.outputDir, 'emulators') : join(stagingDir(), 'emulators')
  const appDir = join(root, titleId)
  await rm(appDir, { recursive: true, force: true })
  let bytes = await extractAll(archive, wanted, (entry) => safeZipPath(appDir, entry.name), label, ctx)

  if (!options.coresOnly) {
    await mkdir(join(appDir, 'sce_sys', 'package'), { recursive: true })
    await writeFile(join(appDir, 'sce_sys', 'package', 'head.bin'), buildHeadBin(titleId))
  }

  let dataDir: string | undefined
  if (dataArchive && pkg?.data && !options.coresOnly) {
    const prefix = pkg.data.stripPrefix
    const dataEntries = (await readZipEntries(dataArchive)).filter((e) => !e.isDirectory && e.name.startsWith(prefix) && e.name.length > prefix.length)
    dataDir = join(root, 'data', pkg.data.vitaDir)
    await rm(dataDir, { recursive: true, force: true })
    bytes += await extractAll(dataArchive, dataEntries, (entry) => safeZipPath(dataDir!, entry.name.slice(prefix.length)), `${label} data`, ctx)
  }

  if (options.mode === 'folder') {
    notes.push(`Copy ${appDir} into ux0:app on the memory card, then run Refresh LiveArea in VitaShell.`)
    if (dataDir) notes.push(`Copy ${dataDir} to ux0:data/${pkg!.data!.vitaDir}.`)
    return { titleId, files: wanted.length, bytes, destination: appDir, notes }
  }

  const ftp = new VitaFtp()
  ftp.onRetry = (message) => ctx.report(0, 0, message, 'warn')
  ftp.checkCancelled = () => ctx.checkCancelled()
  ftp.verbose = vita.debugFtp
  ftp.onLog = (message) => ctx.report(0, 0, `ftp: ${message}`)
  ctx.report(0, 1, `Connecting to ${vita.host}:${vita.port}`)
  await ftp.connect(vita.host.trim(), vita.port, LONG_CONNECT_ATTEMPTS)
  try {
    let uploaded = 0
    const appFiles = await countFiles(appDir)
    const onFile = (name: string, skipped: boolean): void =>
      ctx.report(++uploaded, appFiles, skipped ? `Already on the Vita: ${name}` : `Uploading ${name}`)
    await ftp.uploadTree(appDir, `/ux0:/app/${titleId}`, onFile, { skipExisting: true })
    if (dataDir) {
      uploaded = 0
      const dataFiles = await countFiles(dataDir)
      await ftp.uploadTree(
        dataDir,
        `/ux0:/data/${pkg!.data!.vitaDir}`,
        (name, skipped) => ctx.report(++uploaded, dataFiles, skipped ? `Data already on the Vita: ${name}` : `Uploading data: ${name}`),
        { skipExisting: true }
      )
    }
  } finally {
    ftp.close()
  }

  notes.push(
    options.coresOnly
      ? `Cores copied into ux0:app/${titleId}. No LiveArea refresh needed.`
      : `In VitaShell, back out to the device list, press Triangle and choose "Refresh LiveArea" to register ${titleId}.`
  )
  ctx.report(1, 1, `${label}: ${formatMb(bytes)} installed`)
  return { titleId, files: wanted.length, bytes, destination: `ux0:app/${titleId}`, notes }
}
