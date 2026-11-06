import { contextBridge, ipcRenderer } from 'electron'
import type { ArchVitaApi } from '@shared/api'
import type { Progress } from '@shared/types'

const invoke = <T>(channel: string, ...args: unknown[]): Promise<T> => ipcRenderer.invoke(`archvita:${channel}`, ...args)

const api: ArchVitaApi = {
  getSettings: () => invoke('getSettings'),
  saveSettings: (patch) => invoke('saveSettings', patch),
  pickFolder: (title, defaultPath) => invoke('pickFolder', title, defaultPath),
  pickImage: (title) => invoke('pickImage', title),
  openPath: (path) => invoke('openPath', path),
  getGames: () => invoke('getGames'),
  scanLibrary: () => invoke('scanLibrary'),
  createSystemFolders: () => invoke('createSystemFolders'),
  patchGames: (patches) => invoke('patchGames', patches),
  fetchArtwork: (options) => invoke('fetchArtwork', options),
  setCustomArt: (gameId, kind, filePath) => invoke('setCustomArt', gameId, kind, filePath),
  previewUri: (gameId) => invoke('previewUri', gameId),
  build: (options) => invoke('build', options),
  sync: (options) => invoke('sync', options),
  testVita: () => invoke('testVita'),
  launcherStatus: () => invoke('launcherStatus'),
  resolveEmulators: (force) => invoke('resolveEmulators', force),
  checkEmulators: () => invoke('checkEmulators'),
  installEmulator: (options) => invoke('installEmulator', options),
  pickVpk: () => invoke('pickVpk'),
  cancelJob: () => invoke('cancelJob'),
  onProgress: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: Progress): void => callback(progress)
    ipcRenderer.on('archvita:progress', listener)
    return () => {
      ipcRenderer.removeListener('archvita:progress', listener)
    }
  }
}

contextBridge.exposeInMainWorld('archvita', api)
