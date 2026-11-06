import { app } from 'electron'
import { join } from 'node:path'

export const userDataDir = (): string => app.getPath('userData')
export const artDir = (): string => join(userDataDir(), 'art')
export const stagingDir = (): string => join(userDataDir(), 'staging')
export const downloadsDir = (): string => join(userDataDir(), 'downloads')
export const settingsFile = (): string => join(userDataDir(), 'settings.json')
export const libraryFile = (): string => join(userDataDir(), 'library.json')
export const defaultOutputDir = (): string => join(app.getPath('documents'), 'ArchVita')

export const defaultLauncherPath = (): string =>
  app.isPackaged
    ? join(process.resourcesPath, 'launcher', 'eboot.bin')
    : join(app.getAppPath(), 'resources', 'launcher', 'eboot.bin')
