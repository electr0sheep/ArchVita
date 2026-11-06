import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { SYSTEMS } from '@shared/systems'
import type { FolderSetupResult, Settings } from '@shared/types'

export const GUIDE_FILE = 'README-ArchVita.txt'

const normalize = (name: string): string => name.toLowerCase().replace(/[\s_-]/g, '')

function guideText(): string {
  const lines = [
    'ArchVita ROM library layout',
    '',
    'One folder per system. Put the ROM files for a system directly inside its folder;',
    'sub-folders inside a system folder are ignored. Any of the listed folder names works.',
    'Name files like the No-Intro sets, e.g. "Super Mario World (USA).sfc", and artwork',
    'is found automatically. Avoid "&" in file names: RetroArch cannot launch those paths.',
    ''
  ]
  for (const system of SYSTEMS) {
    const note = system.unsupportedReason ? '  [not supported yet]' : ''
    lines.push(`${system.folders[0]}/`)
    lines.push(`    ${system.name}${note}`)
    lines.push(`    files: ${system.extensions.join(' ')}`)
    if (system.folders.length > 1) lines.push(`    also accepted: ${system.folders.slice(1).join(', ')}`)
    lines.push('')
  }
  return lines.join('\r\n')
}

export async function createSystemFolders(settings: Settings): Promise<FolderSetupResult> {
  const root = settings.libraryRoot.trim()
  if (!root) throw new Error('Set the ROM library folder in Settings first.')
  await mkdir(root, { recursive: true })

  const present = new Set(
    (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => normalize(entry.name))
  )
  const created: string[] = []
  const existing: string[] = []
  for (const system of SYSTEMS) {
    if (system.unsupportedReason) continue
    const match = system.folders.find((folder) => present.has(folder))
    if (match) {
      existing.push(match)
      continue
    }
    await mkdir(join(root, system.folders[0]), { recursive: true })
    created.push(system.folders[0])
  }

  const readme = join(root, GUIDE_FILE)
  await writeFile(readme, guideText())
  return { root, created, existing, readme }
}
