import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Game, GamePatch, LauncherStatus, Progress, Settings, VitaCheck } from '@shared/types'
import { JobBar } from './components/JobBar'
import { Sidebar, type View } from './components/Sidebar'
import { api, errorMessage } from './lib/api'
import { EmulatorsView } from './views/EmulatorsView'
import { LibraryView } from './views/LibraryView'
import { SettingsView } from './views/SettingsView'

export default function App() {
  const [view, setView] = useState<View>('library')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [launcher, setLauncher] = useState<LauncherStatus | null>(null)
  const [log, setLog] = useState<Progress[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [vitaStatus, setVitaStatus] = useState<VitaCheck | null>(null)

  const refreshLauncher = useCallback(async () => {
    setLauncher(await api.launcherStatus())
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        setSettings(await api.getSettings())
        setGames(await api.getGames())
        await refreshLauncher()
      } catch (e) {
        setError(errorMessage(e))
      }
    })()
    return api.onProgress((progress) => setLog((prev) => [...prev.slice(-499), progress]))
  }, [refreshLauncher])

  const run = useCallback(async <T,>(name: string, fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(name)
    setError(null)
    try {
      return await fn()
    } catch (e) {
      setError(errorMessage(e))
      return undefined
    } finally {
      setBusy(null)
    }
  }, [])

  const saveSettings = useCallback(
    async (patch: Partial<Settings>) => {
      try {
        setSettings(await api.saveSettings(patch))
        await refreshLauncher()
      } catch (e) {
        setError(errorMessage(e))
      }
    },
    [refreshLauncher]
  )

  const patchGames = useCallback(async (patches: { id: string; patch: GamePatch }[]) => {
    try {
      setGames(await api.patchGames(patches))
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [])

  const scan = useCallback(async () => {
    setLog([])
    const result = await run('Scanning library', () => api.scanLibrary())
    if (result) setGames(result)
  }, [run])

  const fetchArt = useCallback(
    async (gameIds: string[], force: boolean) => {
      if (!gameIds.length) return
      setLog([])
      const result = await run('Fetching artwork', () => api.fetchArtwork({ gameIds, force }))
      if (result) setGames(result)
    },
    [run]
  )

  const setCustomArt = useCallback(
    async (gameId: string, kind: 'boxart' | 'snap') => {
      const file = await api.pickImage(kind === 'boxart' ? 'Choose box art' : 'Choose a screenshot for the background')
      if (!file) return
      const result = await run('Importing image', () => api.setCustomArt(gameId, kind, file))
      if (result) setGames(result)
    },
    [run]
  )

  const checkVita = useCallback(async () => {
    const result = await run('Checking the Vita', () => api.checkEmulators())
    if (result) setVitaStatus(result)
  }, [run])

  const selectedIds = useMemo(() => games.filter((g) => g.selected).map((g) => g.id), [games])

  return (
    <div className="app">
      <Sidebar
        view={view}
        onChange={setView}
        launcher={launcher}
        settings={settings}
        busy={busy}
        gameCount={games.length}
        selectedCount={selectedIds.length}
      />
      <div className="main-column">
        <main className="content">
          {error && (
            <div className="banner error">
              <span>{error}</span>
              <button className="ghost" onClick={() => setError(null)} aria-label="Dismiss">
                ×
              </button>
            </div>
          )}
          {settings && view === 'library' && (
            <LibraryView
              games={games}
              settings={settings}
              launcher={launcher}
              busy={busy}
              check={vitaStatus}
              onScan={scan}
              onFetchArt={fetchArt}
              onPatch={patchGames}
              onSetCustomArt={setCustomArt}
              onPreviewUri={(id) => api.previewUri(id)}
              onCheckVita={checkVita}
              onOpenEmulators={() => setView('emulators')}
              onClearLog={() => setLog([])}
              onRun={run}
              onSaveSettings={saveSettings}
            />
          )}
          {settings && view === 'emulators' && (
            <EmulatorsView
              games={games}
              settings={settings}
              busy={busy}
              check={vitaStatus}
              onCheckVita={checkVita}
              onClearLog={() => setLog([])}
              onRun={run}
              onSaveSettings={saveSettings}
            />
          )}
          {settings && view === 'settings' && (
            <SettingsView settings={settings} launcher={launcher} busy={busy} onSave={saveSettings} onRun={run} />
          )}
        </main>
        <JobBar busy={busy} log={log} />
      </div>
    </div>
  )
}
