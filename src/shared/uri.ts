import { EMULATORS } from './emulators'
import { sanitizeVitaFileName } from './names'
import type { Game, Settings, SystemDef } from './types'

export function emu4vitaEncode(value: string): string {
  return value.replace(/[^A-Za-z0-9\-_.~:/]/g, (c) => {
    const bytes = new TextEncoder().encode(c)
    let out = ''
    for (const b of bytes) out += '%' + b.toString(16).toUpperCase().padStart(2, '0')
    return out
  })
}

export function normalizeVitaPath(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/\/+$/, '')
}

export function vitaRomDir(romRoot: string, system: SystemDef): string {
  return `${normalizeVitaPath(romRoot)}/${system.id}`
}

export function vitaRomPath(romRoot: string, system: SystemDef, fileName: string): string {
  return `${vitaRomDir(romRoot, system)}/${sanitizeVitaFileName(fileName)}`
}

export function resolveCore(game: Game, system: SystemDef): string | undefined {
  if (game.core) return game.core
  if (game.emulator === 'emu4vita') return system.emu4vitaCore ?? system.core
  if (game.emulator === 'retroarch') return system.core
  return undefined
}

export function buildLaunchUri(game: Game, system: SystemDef, settings: Settings): string {
  const profile = EMULATORS[game.emulator]
  const rom = vitaRomPath(settings.vita.romRoot, system, game.fileName)
  let core = ''
  if (profile.needsCore) {
    const coreName = resolveCore(game, system)
    if (!coreName) throw new Error(`${game.name}: no core set for ${profile.name}`)
    core = game.emulator === 'retroarch' ? settings.corePathTemplate.replace('{core}', coreName) : coreName
  }
  const encode = profile.percentEncode ? emu4vitaEncode : (v: string) => v
  return profile.uriTemplate.replace('{core}', encode(core)).replace('{rom}', encode(rom))
}

export function toFtpPath(vitaPath: string): string {
  const normalized = normalizeVitaPath(vitaPath)
  const match = /^([a-z0-9]+:)\/?(.*)$/i.exec(normalized)
  if (!match) throw new Error(`Not a Vita path: ${vitaPath}`)
  return match[2] ? `/${match[1]}/${match[2]}` : `/${match[1]}`
}
