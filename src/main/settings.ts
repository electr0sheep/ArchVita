import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { DEFAULT_CORE_PATH_TEMPLATE } from '@shared/emulators'
import type { Settings } from '@shared/types'
import { defaultOutputDir, settingsFile } from './paths'

let cache: Settings | null = null

function defaults(): Settings {
  return {
    libraryRoot: '',
    outputDir: defaultOutputDir(),
    launcherPath: '',
    cleanNames: true,
    corePathTemplate: DEFAULT_CORE_PATH_TEMPLATE,
    retroarchChannel: 'stable',
    vita: {
      host: '',
      port: 1337,
      romRoot: 'ux0:data/roms',
      uploadRoms: true,
      updateAppMeta: true,
      debugFtp: false
    }
  }
}

function merge(base: Settings, patch: Partial<Settings>): Settings {
  return { ...base, ...patch, vita: { ...base.vita, ...(patch.vita ?? {}) } }
}

export async function getSettings(): Promise<Settings> {
  if (cache) return cache
  try {
    const raw = JSON.parse(await readFile(settingsFile(), 'utf8')) as Partial<Settings>
    cache = merge(defaults(), raw)
  } catch {
    cache = defaults()
  }
  return cache
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = merge(await getSettings(), patch)
  if (!next.corePathTemplate.includes('{core}')) next.corePathTemplate = DEFAULT_CORE_PATH_TEMPLATE
  cache = next
  await mkdir(dirname(settingsFile()), { recursive: true })
  await writeFile(settingsFile(), JSON.stringify(next, null, 2))
  return next
}
