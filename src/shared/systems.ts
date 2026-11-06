import type { SystemDef } from './types'

export const SYSTEMS: SystemDef[] = [
  {
    id: 'nes',
    name: 'Nintendo Entertainment System',
    shortName: 'NES',
    folders: ['nes', 'famicom', 'fds'],
    libretroName: 'Nintendo - Nintendo Entertainment System',
    extensions: ['.nes', '.fds', '.unf', '.unif', '.zip'],
    emulator: 'retroarch',
    core: 'fceumm',
    emu4vitaCore: 'fceumm'
  },
  {
    id: 'snes',
    name: 'Super Nintendo Entertainment System',
    shortName: 'SNES',
    folders: ['snes', 'sfc', 'superfamicom', 'snesna'],
    libretroName: 'Nintendo - Super Nintendo Entertainment System',
    extensions: ['.sfc', '.smc', '.fig', '.swc', '.bs', '.zip'],
    emulator: 'retroarch',
    core: 'snes9x2005',
    emu4vitaCore: 'snes9x2005_plus'
  },
  {
    id: 'gb',
    name: 'Game Boy',
    shortName: 'GB',
    folders: ['gb', 'gameboy'],
    libretroName: 'Nintendo - Game Boy',
    extensions: ['.gb', '.zip'],
    emulator: 'retroarch',
    core: 'gambatte',
    emu4vitaCore: 'gambatte'
  },
  {
    id: 'gbc',
    name: 'Game Boy Color',
    shortName: 'GBC',
    folders: ['gbc', 'gameboycolor'],
    libretroName: 'Nintendo - Game Boy Color',
    extensions: ['.gbc', '.zip'],
    emulator: 'retroarch',
    core: 'gambatte',
    emu4vitaCore: 'gambatte'
  },
  {
    id: 'gba',
    name: 'Game Boy Advance',
    shortName: 'GBA',
    folders: ['gba', 'gameboyadvance'],
    libretroName: 'Nintendo - Game Boy Advance',
    extensions: ['.gba', '.zip'],
    emulator: 'retroarch',
    core: 'gpsp',
    emu4vitaCore: 'gpsp'
  },
  {
    id: 'vb',
    name: 'Virtual Boy',
    shortName: 'VB',
    folders: ['vb', 'virtualboy'],
    libretroName: 'Nintendo - Virtual Boy',
    extensions: ['.vb', '.vboy', '.zip'],
    emulator: 'retroarch',
    core: 'mednafen_vb'
  },
  {
    id: 'n64',
    name: 'Nintendo 64',
    shortName: 'N64',
    folders: ['n64', 'nintendo64'],
    libretroName: 'Nintendo - Nintendo 64',
    extensions: ['.n64', '.z64', '.v64', '.zip'],
    emulator: 'daedalus'
  },
  {
    id: 'genesis',
    name: 'Sega Genesis / Mega Drive',
    shortName: 'Genesis',
    folders: ['genesis', 'megadrive', 'md'],
    libretroName: 'Sega - Mega Drive - Genesis',
    extensions: ['.md', '.gen', '.bin', '.smd', '.zip'],
    emulator: 'retroarch',
    core: 'genesis_plus_gx',
    emu4vitaCore: 'genesis_plus_gx'
  },
  {
    id: 'sms',
    name: 'Sega Master System',
    shortName: 'SMS',
    folders: ['sms', 'mastersystem'],
    libretroName: 'Sega - Master System - Mark III',
    extensions: ['.sms', '.zip'],
    emulator: 'retroarch',
    core: 'genesis_plus_gx',
    emu4vitaCore: 'genesis_plus_gx'
  },
  {
    id: 'gg',
    name: 'Sega Game Gear',
    shortName: 'GG',
    folders: ['gg', 'gamegear'],
    libretroName: 'Sega - Game Gear',
    extensions: ['.gg', '.zip'],
    emulator: 'retroarch',
    core: 'genesis_plus_gx',
    emu4vitaCore: 'genesis_plus_gx'
  },
  {
    id: 'sega32x',
    name: 'Sega 32X',
    shortName: '32X',
    folders: ['32x', 'sega32x'],
    libretroName: 'Sega - 32X',
    extensions: ['.32x', '.zip'],
    emulator: 'retroarch',
    core: 'picodrive',
    emu4vitaCore: 'picodrive'
  },
  {
    id: 'segacd',
    name: 'Sega CD / Mega-CD',
    shortName: 'Sega CD',
    folders: ['segacd', 'megacd'],
    libretroName: 'Sega - Mega-CD - Sega CD',
    extensions: ['.cue', '.chd', '.m3u'],
    emulator: 'retroarch',
    core: 'genesis_plus_gx',
    emu4vitaCore: 'genesis_plus_gx'
  },
  {
    id: 'dreamcast',
    name: 'Sega Dreamcast',
    shortName: 'DC',
    folders: ['dreamcast', 'dc'],
    libretroName: 'Sega - Dreamcast',
    extensions: ['.cdi', '.gdi', '.chd', '.cue'],
    emulator: 'flycast'
  },
  {
    id: 'pce',
    name: 'PC Engine / TurboGrafx-16',
    shortName: 'PCE',
    folders: ['pce', 'tg16', 'pcengine', 'turbografx16'],
    libretroName: 'NEC - PC Engine - TurboGrafx 16',
    extensions: ['.pce', '.zip'],
    emulator: 'retroarch',
    core: 'mednafen_pce_fast',
    emu4vitaCore: 'mednafen_pce_fast'
  },
  {
    id: 'pcecd',
    name: 'PC Engine CD / TurboGrafx-CD',
    shortName: 'PCE CD',
    folders: ['pcecd', 'tgcd', 'turbografxcd'],
    libretroName: 'NEC - PC Engine CD - TurboGrafx-CD',
    extensions: ['.cue', '.chd', '.m3u'],
    emulator: 'retroarch',
    core: 'mednafen_pce_fast',
    emu4vitaCore: 'mednafen_pce_fast'
  },
  {
    id: 'sgx',
    name: 'PC Engine SuperGrafx',
    shortName: 'SGX',
    folders: ['sgx', 'supergrafx'],
    libretroName: 'NEC - PC Engine SuperGrafx',
    extensions: ['.sgx', '.zip'],
    emulator: 'retroarch',
    core: 'mednafen_supergrafx',
    emu4vitaCore: 'mednafen_supergrafx'
  },
  {
    id: 'psx',
    name: 'Sony PlayStation',
    shortName: 'PS1',
    folders: ['psx', 'ps1', 'playstation'],
    libretroName: 'Sony - PlayStation',
    extensions: ['.cue', '.chd', '.pbp', '.m3u'],
    emulator: 'retroarch',
    core: 'pcsx_rearmed',
    emu4vitaCore: 'pcsx_rearmed'
  },
  {
    id: 'ngp',
    name: 'Neo Geo Pocket',
    shortName: 'NGP',
    folders: ['ngp'],
    libretroName: 'SNK - Neo Geo Pocket',
    extensions: ['.ngp', '.zip'],
    emulator: 'retroarch',
    core: 'mednafen_ngp',
    emu4vitaCore: 'mednafen_ngp'
  },
  {
    id: 'ngpc',
    name: 'Neo Geo Pocket Color',
    shortName: 'NGPC',
    folders: ['ngpc'],
    libretroName: 'SNK - Neo Geo Pocket Color',
    extensions: ['.ngc', '.ngpc', '.zip'],
    emulator: 'retroarch',
    core: 'mednafen_ngp',
    emu4vitaCore: 'mednafen_ngp'
  },
  {
    id: 'neogeo',
    name: 'Neo Geo',
    shortName: 'Neo Geo',
    folders: ['neogeo'],
    libretroName: 'SNK - Neo Geo',
    extensions: ['.zip'],
    emulator: 'retroarch',
    core: 'fbalpha2012_neogeo',
    emu4vitaCore: 'fbalpha2012'
  },
  {
    id: 'ws',
    name: 'WonderSwan',
    shortName: 'WS',
    folders: ['ws', 'wonderswan'],
    libretroName: 'Bandai - WonderSwan',
    extensions: ['.ws', '.zip'],
    emulator: 'retroarch',
    core: 'mednafen_wswan',
    emu4vitaCore: 'mednafen_wswan'
  },
  {
    id: 'wsc',
    name: 'WonderSwan Color',
    shortName: 'WSC',
    folders: ['wsc', 'wonderswancolor'],
    libretroName: 'Bandai - WonderSwan Color',
    extensions: ['.wsc', '.zip'],
    emulator: 'retroarch',
    core: 'mednafen_wswan',
    emu4vitaCore: 'mednafen_wswan'
  },
  {
    id: 'atari2600',
    name: 'Atari 2600',
    shortName: '2600',
    folders: ['atari2600'],
    libretroName: 'Atari - 2600',
    extensions: ['.a26', '.bin', '.zip'],
    emulator: 'retroarch',
    core: 'stella2014',
    emu4vitaCore: 'stella2014'
  },
  {
    id: 'atari7800',
    name: 'Atari 7800',
    shortName: '7800',
    folders: ['atari7800'],
    libretroName: 'Atari - 7800',
    extensions: ['.a78', '.zip'],
    emulator: 'retroarch',
    core: 'prosystem',
    emu4vitaCore: 'prosystem'
  },
  {
    id: 'lynx',
    name: 'Atari Lynx',
    shortName: 'Lynx',
    folders: ['lynx', 'atarilynx'],
    libretroName: 'Atari - Lynx',
    extensions: ['.lnx', '.zip'],
    emulator: 'retroarch',
    core: 'handy',
    emu4vitaCore: 'handy'
  },
  {
    id: 'atari800',
    name: 'Atari 8-bit',
    shortName: 'A800',
    folders: ['atari800', 'atari8bit'],
    libretroName: 'Atari - 8-bit',
    extensions: ['.atr', '.xex', '.zip'],
    emulator: 'retroarch',
    core: 'atari800',
    emu4vitaCore: 'atari800'
  },
  {
    id: 'arcade',
    name: 'Arcade (FB Alpha 2012)',
    shortName: 'Arcade',
    folders: ['arcade', 'fba', 'fbneo'],
    libretroName: 'FBNeo - Arcade Games',
    extensions: ['.zip'],
    emulator: 'retroarch',
    core: 'fbalpha2012',
    emu4vitaCore: 'fbalpha2012'
  },
  {
    id: 'mame',
    name: 'Arcade (MAME 2003-Plus)',
    shortName: 'MAME',
    folders: ['mame', 'mame2003'],
    libretroName: 'MAME',
    extensions: ['.zip'],
    emulator: 'retroarch',
    core: 'mame2003_plus',
    emu4vitaCore: 'mame2003_plus'
  },
  {
    id: 'msx',
    name: 'MSX',
    shortName: 'MSX',
    folders: ['msx', 'msx2'],
    libretroName: 'Microsoft - MSX',
    extensions: ['.rom', '.mx1', '.mx2', '.dsk', '.zip'],
    emulator: 'retroarch',
    core: 'bluemsx',
    emu4vitaCore: 'bluemsx'
  },
  {
    id: 'c64',
    name: 'Commodore 64',
    shortName: 'C64',
    folders: ['c64'],
    libretroName: 'Commodore - 64',
    extensions: ['.d64', '.t64', '.prg', '.zip'],
    emulator: 'retroarch',
    core: 'vice_x64',
    emu4vitaCore: 'vice'
  },
  {
    id: 'amiga',
    name: 'Commodore Amiga',
    shortName: 'Amiga',
    folders: ['amiga'],
    libretroName: 'Commodore - Amiga',
    extensions: ['.adf', '.hdf', '.lha', '.zip'],
    emulator: 'retroarch',
    core: 'uae4arm',
    emu4vitaCore: 'uae4arm'
  },
  {
    id: 'zxspectrum',
    name: 'ZX Spectrum',
    shortName: 'ZX',
    folders: ['zxspectrum', 'spectrum'],
    libretroName: 'Sinclair - ZX Spectrum',
    extensions: ['.tzx', '.tap', '.z80', '.zip'],
    emulator: 'retroarch',
    core: 'fuse',
    emu4vitaCore: 'fuse'
  },
  {
    id: 'vectrex',
    name: 'GCE Vectrex',
    shortName: 'Vectrex',
    folders: ['vectrex'],
    libretroName: 'GCE - Vectrex',
    extensions: ['.vec', '.bin', '.zip'],
    emulator: 'retroarch',
    core: 'vecx',
    emu4vitaCore: 'vecx'
  },
  {
    id: 'dos',
    name: 'MS-DOS (DOSBox Pure)',
    shortName: 'DOS',
    folders: ['dos', 'msdos', 'dosbox'],
    libretroName: 'DOS',
    extensions: ['.zip', '.dosz', '.m3u', '.iso', '.cue'],
    emulator: 'retroarch',
    core: 'dosbox_pure',
    emu4vitaCore: 'dosbox_pure'
  },
  {
    id: 'psp',
    name: 'PlayStation Portable',
    shortName: 'PSP',
    folders: ['psp'],
    libretroName: 'Sony - PlayStation Portable',
    extensions: ['.iso', '.cso'],
    emulator: 'retroarch',
    unsupportedReason: 'PSP games need Adrenaline bubbles, which ArchVita does not generate yet.'
  }
]

const byFolder = new Map<string, SystemDef>()
for (const system of SYSTEMS) {
  for (const folder of system.folders) byFolder.set(folder.toLowerCase(), system)
}

export function systemForFolder(folderName: string): SystemDef | undefined {
  return byFolder.get(folderName.toLowerCase().replace(/[\s_-]/g, ''))
}

export function systemById(id: string): SystemDef | undefined {
  return SYSTEMS.find((s) => s.id === id)
}
