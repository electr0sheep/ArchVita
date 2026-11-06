import { readFile, stat } from 'node:fs/promises'
import type { LauncherStatus, Settings } from '@shared/types'
import { defaultLauncherPath } from './paths'

export async function launcherStatus(settings: Settings): Promise<LauncherStatus> {
  const path = settings.launcherPath.trim() || defaultLauncherPath()
  try {
    const info = await stat(path)
    return { path, exists: info.isFile(), size: info.size }
  } catch {
    return { path, exists: false, size: 0 }
  }
}

export async function loadLauncher(settings: Settings): Promise<Buffer> {
  const status = await launcherStatus(settings)
  if (!status.exists) {
    throw new Error(
      `Launcher eboot.bin not found at ${status.path}. Build it with VitaSDK (see launcher/README.md) or point Settings at a built copy.`
    )
  }
  return readFile(status.path)
}
