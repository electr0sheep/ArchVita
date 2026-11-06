import type {
  ArtFetchOptions,
  BuildOptions,
  BuildResult,
  FolderSetupResult,
  Game,
  GamePatch,
  InstallOptions,
  InstallResult,
  LauncherStatus,
  Progress,
  ResolvedPackage,
  Settings,
  SyncOptions,
  SyncResult,
  VitaCheck,
  VitaTestResult
} from './types'

export interface ArchVitaApi {
  getSettings(): Promise<Settings>
  saveSettings(patch: Partial<Settings>): Promise<Settings>
  pickFolder(title: string, defaultPath?: string): Promise<string | null>
  pickImage(title: string): Promise<string | null>
  openPath(path: string): Promise<void>
  getGames(): Promise<Game[]>
  scanLibrary(): Promise<Game[]>
  createSystemFolders(): Promise<FolderSetupResult>
  patchGames(patches: { id: string; patch: GamePatch }[]): Promise<Game[]>
  fetchArtwork(options: ArtFetchOptions): Promise<Game[]>
  setCustomArt(gameId: string, kind: 'boxart' | 'snap', filePath: string): Promise<Game[]>
  previewUri(gameId: string): Promise<string>
  build(options: BuildOptions): Promise<BuildResult>
  sync(options: SyncOptions): Promise<SyncResult>
  testVita(): Promise<VitaTestResult>
  launcherStatus(): Promise<LauncherStatus>
  resolveEmulators(force: boolean): Promise<ResolvedPackage[]>
  checkEmulators(): Promise<VitaCheck>
  installEmulator(options: InstallOptions): Promise<InstallResult>
  pickVpk(): Promise<string | null>
  cancelJob(): Promise<void>
  onProgress(callback: (progress: Progress) => void): () => void
}
