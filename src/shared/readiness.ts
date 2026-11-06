import { EMULATORS } from './emulators'
import { systemById } from './systems'
import type { EmulatorId, Game, VitaCheck } from './types'
import { resolveCore } from './uri'

export type ReadinessProblem = 'emulator-missing' | 'shader-compiler-missing' | 'core-missing' | 'core-damaged'

export interface GameReadiness {
  game: Game
  emulator: EmulatorId
  core?: string
  problem?: ReadinessProblem
}

export interface ReadinessIssue {
  kind: ReadinessProblem
  label: string
  count: number
}

export interface ReadinessSummary {
  issues: ReadinessIssue[]
  affected: GameReadiness[]
}

export function assessGames(games: Game[], check: VitaCheck): GameReadiness[] {
  const byEmulator = new Map(check.emulators.map((status) => [status.id, status]))
  return games.map((game) => {
    const system = systemById(game.systemId)
    const core = system ? resolveCore(game, system) : undefined
    const status = byEmulator.get(game.emulator)
    const profile = EMULATORS[game.emulator]
    let problem: ReadinessProblem | undefined
    if (!status?.installed) problem = 'emulator-missing'
    else if (profile.needsShaderCompiler && !check.shaderCompiler) problem = 'shader-compiler-missing'
    else if (core && profile.needsCore && !status.cores.includes(core)) problem = 'core-missing'
    else if (core && status.damagedCores.includes(core)) problem = 'core-damaged'
    return { game, emulator: game.emulator, core, problem }
  })
}

export function describeProblem(item: GameReadiness): string {
  const emulator = EMULATORS[item.emulator].name
  switch (item.problem) {
    case 'emulator-missing':
      return `${emulator} is not installed on the Vita`
    case 'shader-compiler-missing':
      return `${emulator} needs the runtime shader compiler (libshacccg.suprx), which is not on the Vita`
    case 'core-missing':
      return `${emulator} core "${item.core}" is not installed on the Vita`
    case 'core-damaged':
      return `${emulator} core "${item.core}" is damaged on the Vita`
    default:
      return ''
  }
}

export function summarizeReadiness(items: GameReadiness[]): ReadinessSummary {
  const issues = new Map<string, ReadinessIssue>()
  const affected = items.filter((item) => item.problem)
  for (const item of affected) {
    const label = describeProblem(item)
    const issue = issues.get(label) ?? { kind: item.problem!, label, count: 0 }
    issue.count++
    issues.set(label, issue)
  }
  return { issues: [...issues.values()], affected }
}
