import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Game, Settings, SystemDef } from '@shared/types'
import { buildLaunchUri } from '@shared/uri'
import { artAbsPath } from './artwork'
import { buildHeadBin } from './headbin'
import { renderBackground, renderIcon, renderStartup } from './images'
import { buildParamSfo } from './sfo'

export const TEMPLATE_XML = `<?xml version="1.0" encoding="utf-8"?>
<livearea style="a1" format-ver="01.00" content-rev="1">
  <livearea-background>
    <image>bg.png</image>
  </livearea-background>
  <gate>
    <startup-image>startup.png</startup-image>
  </gate>
</livearea>
`

export interface BubbleContext {
  settings: Settings
  launcher: Buffer
  version: string
}

export function bubbleTitle(game: Game): string {
  return game.customName?.trim() || game.name
}

export async function buildBubbleFolder(game: Game, system: SystemDef, ctx: BubbleContext, parentDir: string): Promise<string> {
  const uri = buildLaunchUri(game, system, ctx.settings)
  const title = bubbleTitle(game)
  const dir = join(parentDir, game.titleId)
  const sceSys = join(dir, 'sce_sys')
  const contents = join(sceSys, 'livearea', 'contents')

  await rm(dir, { recursive: true, force: true })
  await mkdir(contents, { recursive: true })
  await mkdir(join(sceSys, 'package'), { recursive: true })

  const boxart = game.art.boxart ? artAbsPath(game.art.boxart) : null
  const snap = game.art.snap ? artAbsPath(game.art.snap) : null
  const [icon, background, startup] = await Promise.all([
    renderIcon(boxart, title, system.shortName),
    renderBackground(snap, boxart, title, system.shortName),
    renderStartup(boxart, title, system.shortName)
  ])

  const meta = {
    archvita: ctx.version,
    gameId: game.id,
    system: system.id,
    fileName: game.fileName,
    emulator: game.emulator,
    core: game.core ?? null,
    uri,
    builtAt: new Date().toISOString()
  }

  await writeFile(join(dir, 'eboot.bin'), ctx.launcher)
  await writeFile(join(dir, 'launch.txt'), `${uri}\n`)
  await writeFile(join(dir, 'archvita.json'), JSON.stringify(meta, null, 2))
  await writeFile(join(sceSys, 'param.sfo'), buildParamSfo({ title, titleId: game.titleId }))
  await writeFile(join(sceSys, 'icon0.png'), icon)
  await writeFile(join(sceSys, 'package', 'head.bin'), buildHeadBin(game.titleId))
  await writeFile(join(contents, 'bg.png'), background)
  await writeFile(join(contents, 'startup.png'), startup)
  await writeFile(join(contents, 'template.xml'), TEMPLATE_XML)

  return dir
}
