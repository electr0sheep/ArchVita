import type { ArchVitaApi } from '@shared/api'

export const api: ArchVitaApi = window.archvita

export function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  return raw.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')
}

export function artUrl(relativePath: string | undefined): string | undefined {
  return relativePath ? `art://local/${encodeURIComponent(relativePath)}` : undefined
}

export const HOME_SCREEN_CAP = 500
