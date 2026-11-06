export type EmulatorId = 'retroarch' | 'emu4vita' | 'daedalus' | 'flycast'
export type ToolId = 'sharkbr33d'
export type PackageId = EmulatorId | ToolId

export interface EmulatorProfile {
  id: EmulatorId
  name: string
  titleId: string
  uriTemplate: string
  needsCore: boolean
  needsShaderCompiler?: boolean
  percentEncode: boolean
  cores: string[]
}

export interface SystemDef {
  id: string
  name: string
  shortName: string
  folders: string[]
  libretroName: string
  extensions: string[]
  emulator: EmulatorId
  core?: string
  emu4vitaCore?: string
  unsupportedReason?: string
}

export type ArtStatus = 'none' | 'fetched' | 'partial' | 'missing' | 'custom'

export interface GameArt {
  boxart?: string
  snap?: string
  status: ArtStatus
}

export interface Game {
  id: string
  systemId: string
  fileName: string
  localPath: string
  size: number
  name: string
  titleId: string
  selected: boolean
  emulator: EmulatorId
  core?: string
  customName?: string
  art: GameArt
}

export type GamePatch = Partial<Pick<Game, 'selected' | 'emulator' | 'core' | 'customName'>>

export interface VitaSettings {
  host: string
  port: number
  romRoot: string
  uploadRoms: boolean
  updateAppMeta: boolean
  debugFtp: boolean
}

export interface Settings {
  libraryRoot: string
  outputDir: string
  launcherPath: string
  cleanNames: boolean
  corePathTemplate: string
  retroarchChannel: ReleaseChannel
  vita: VitaSettings
}

export type ProgressLevel = 'info' | 'warn' | 'error' | 'done'

export interface Progress {
  job: string
  current: number
  total: number
  message: string
  level: ProgressLevel
}

export interface BuiltBubble {
  gameId: string
  titleId: string
  name: string
  path: string
}

export interface BuildFailure {
  gameId: string
  name: string
  error: string
}

export interface BuildResult {
  outputDir: string
  built: BuiltBubble[]
  failed: BuildFailure[]
}

export interface SyncResult extends BuildResult {
  romsUploaded: number
  romsSkipped: number
  appMetaUpdated: number
  notes: string[]
}

export interface FolderSetupResult {
  root: string
  created: string[]
  existing: string[]
  readme: string
}

export interface LauncherStatus {
  path: string
  exists: boolean
  size: number
}

export interface VitaTestResult {
  ok: boolean
  message: string
  devices: string[]
}

export type BuildMode = 'folders' | 'vpk'

export interface BuildOptions {
  gameIds: string[]
  mode: BuildMode
}

export interface SyncOptions {
  gameIds: string[]
}

export interface ArtFetchOptions {
  gameIds: string[]
  force: boolean
}

export type ReleaseChannel = 'stable' | 'nightly'

export type PackageSource =
  | { kind: 'libretro'; file: string }
  | { kind: 'github'; repo: string; assetPattern: string }

export interface EmulatorPackage {
  id: PackageId
  name: string
  titleId: string
  app: PackageSource
  data?: { source: PackageSource; stripPrefix: string; vitaDir: string }
  coreFiles?: { prefix: string; suffix: string }
  coreInfoFiles?: { prefix: string; suffix: string }
  notes: string[]
}

export interface ResolvedPackage {
  id: PackageId
  channel?: ReleaseChannel
  version: string
  url: string
  size?: number
  dataUrl?: string
  dataSize?: number
  error?: string
}

export interface EmulatorStatus {
  id: EmulatorId
  installed: boolean
  cores: string[]
  damagedCores: string[]
  verified: boolean
}

export interface VitaCheck {
  emulators: EmulatorStatus[]
  shaderCompiler: boolean
}

export type InstallMode = 'ftp' | 'folder'

export interface InstallOptions {
  packageId?: PackageId
  localVpk?: string
  mode: InstallMode
  cores?: string[]
  allCores?: boolean
  coresOnly?: boolean
  includeData?: boolean
}

export interface InstallResult {
  titleId: string
  files: number
  bytes: number
  destination: string
  notes: string[]
}
