import type { ArchVitaApi } from '@shared/api'

declare global {
  interface Window {
    archvita: ArchVitaApi
  }
}

export {}
