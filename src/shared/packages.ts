import type { EmulatorPackage, PackageId } from './types'

export const EMULATOR_PACKAGES: EmulatorPackage[] = [
  {
    id: 'retroarch',
    name: 'RetroArch',
    titleId: 'RETROVITA',
    app: { kind: 'libretro', file: 'RetroArch.vpk' },
    coreFiles: { prefix: '', suffix: '_libretro.self' },
    coreInfoFiles: { prefix: 'info/', suffix: '_libretro.info' },
    notes: [
      'Every core ships inside the package, so installing only the cores your library needs saves hundreds of megabytes.',
      'Launch RetroArch once after installing. Menu assets are optional; RetroArch can fetch them through its Online Updater.'
    ]
  },
  {
    id: 'emu4vita',
    name: 'Emu4Vita++',
    titleId: 'EMU4VPLUS',
    app: { kind: 'github', repo: 'noword/Emu4VitaPlus', assetPattern: '^Emu4VitaPlus.*\\.vpk$' },
    coreFiles: { prefix: 'eboot_', suffix: '.self' },
    notes: ['BIOS files for cores that need them go in ux0:data/EMU4VITAPLUS/system.']
  },
  {
    id: 'daedalus',
    name: 'DaedalusX64',
    titleId: 'DEDALOX64',
    app: { kind: 'github', repo: 'Rinnegatamante/DaedalusX64-vitaGL', assetPattern: '^DaedalusX64\\.vpk$' },
    data: {
      source: { kind: 'github', repo: 'Rinnegatamante/DaedalusX64-vitaGL', assetPattern: '^DaedalusX64\\.zip$' },
      stripPrefix: 'DaedalusX64/',
      vitaDir: 'DaedalusX64'
    },
    notes: ['Configs, shaders and overlays are installed to ux0:data/DaedalusX64.']
  },
  {
    id: 'flycast',
    name: 'Flycast',
    titleId: 'FLYCASTDC',
    app: { kind: 'github', repo: 'Rinnegatamante/flycast-vita', assetPattern: '^Flycast\\.vpk$' },
    notes: ['BIOS files, when a game needs them, go in ux0:data/flycast.']
  }
]

export const SHADER_COMPILER_PATH = 'ur0:data/libshacccg.suprx'

export const TOOL_PACKAGES: EmulatorPackage[] = [
  {
    id: 'sharkbr33d',
    name: 'ShaRKBR33D',
    titleId: 'SHRKBR33D',
    app: { kind: 'github', repo: 'Rinnegatamante/ShaRKBR33D', assetPattern: '^ShaRKBR33D\\.vpk$' },
    notes: [
      'One-click installer for the runtime shader compiler. Run it once on the Vita with Wi-Fi connected; it downloads the module from Sony and installs it to ur0:data/libshacccg.suprx.'
    ]
  }
]

export const ALL_PACKAGES: EmulatorPackage[] = [...EMULATOR_PACKAGES, ...TOOL_PACKAGES]

export function packageById(id: PackageId): EmulatorPackage | undefined {
  return ALL_PACKAGES.find((p) => p.id === id)
}

function between(fileName: string, prefix: string, suffix: string): string | undefined {
  if (!fileName.startsWith(prefix) || !fileName.endsWith(suffix) || fileName.length <= prefix.length + suffix.length) return undefined
  return fileName.slice(prefix.length, fileName.length - suffix.length)
}

export function coreNameFromFile(pkg: EmulatorPackage, fileName: string): string | undefined {
  if (!pkg.coreFiles || fileName.includes('/')) return undefined
  return between(fileName, pkg.coreFiles.prefix, pkg.coreFiles.suffix)
}

export function coreNameFromInfoFile(pkg: EmulatorPackage, fileName: string): string | undefined {
  if (!pkg.coreInfoFiles) return undefined
  const name = between(fileName, pkg.coreInfoFiles.prefix, pkg.coreInfoFiles.suffix)
  return name !== undefined && !name.includes('/') ? name : undefined
}
