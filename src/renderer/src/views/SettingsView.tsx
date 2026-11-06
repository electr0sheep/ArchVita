import { useEffect, useState } from 'react'
import { DEFAULT_CORE_PATH_TEMPLATE } from '@shared/emulators'
import type { FolderSetupResult, LauncherStatus, Settings, VitaTestResult } from '@shared/types'
import { api } from '../lib/api'

interface Props {
  settings: Settings
  launcher: LauncherStatus | null
  busy: string | null
  onSave: (patch: Partial<Settings>) => Promise<void>
  onRun: <T>(name: string, fn: () => Promise<T>) => Promise<T | undefined>
}

export function SettingsView({ settings, launcher, busy, onSave, onRun }: Props) {
  const [form, setForm] = useState<Settings>(settings)
  const [test, setTest] = useState<VitaTestResult | null>(null)
  const [folders, setFolders] = useState<FolderSetupResult | null>(null)

  useEffect(() => setForm(settings), [settings])

  const commit = () => {
    if (JSON.stringify(form) !== JSON.stringify(settings)) void onSave(form)
  }

  const setVita = (patch: Partial<Settings['vita']>) => setForm((f) => ({ ...f, vita: { ...f.vita, ...patch } }))

  const browse = async (key: 'libraryRoot' | 'outputDir') => {
    const picked = await api.pickFolder(key === 'libraryRoot' ? 'Choose your ROM library folder' : 'Choose the output folder', form[key] || undefined)
    if (picked) void onSave(key === 'libraryRoot' ? { libraryRoot: picked } : { outputDir: picked })
  }

  const createFolders = async () => {
    setFolders(null)
    if (JSON.stringify(form) !== JSON.stringify(settings)) await onSave(form)
    const outcome = await onRun('Creating system folders', () => api.createSystemFolders())
    if (outcome) setFolders(outcome)
  }

  const runTest = async () => {
    setTest(null)
    const outcome = await onRun('Testing Vita connection', () => api.testVita())
    if (outcome) setTest(outcome)
  }

  return (
    <div className="view">
      <header className="view-header">
        <div>
          <h2>Settings</h2>
          <p className="muted">Changes are saved when you leave a field.</p>
        </div>
      </header>

      <section className="panel form">
        <h3>Library</h3>
        <label className="field">
          <span>ROM library folder</span>
          <div className="row gap">
            <input value={form.libraryRoot} onChange={(e) => setForm({ ...form, libraryRoot: e.target.value })} onBlur={commit} />
            <button onClick={() => void browse('libraryRoot')}>Browse…</button>
          </div>
          <small>
            One sub-folder per system, EmuDeck style: <span className="mono">snes</span>, <span className="mono">gba</span>,{' '}
            <span className="mono">genesis</span>, <span className="mono">psx</span>…
          </small>
        </label>
        <div className="row gap wrap">
          <button onClick={() => void createFolders()} disabled={!!busy || !form.libraryRoot.trim()}>
            Create system folders
          </button>
          {folders && (
            <>
              <span className="muted">
                {folders.created.length} folder(s) created, {folders.existing.length} already there. A guide to the layout is in{' '}
                <span className="mono">README-ArchVita.txt</span>.
              </span>
              <button className="ghost" onClick={() => void api.openPath(folders.root)}>
                Open folder
              </button>
            </>
          )}
        </div>
        <small>Makes one empty folder per supported system inside the library folder, skipping any that already exist.</small>
        <label className="check">
          <input
            type="checkbox"
            checked={form.cleanNames}
            onChange={(e) => void onSave({ cleanNames: e.target.checked })}
          />
          Clean up names (drop region tags, move "The" to the front). Takes effect on the next scan.
        </label>
      </section>

      <section className="panel form">
        <h3>Vita</h3>
        <div className="row gap wrap">
          <label className="field">
            <span>IP address</span>
            <input value={form.vita.host} placeholder="192.168.1.50" onChange={(e) => setVita({ host: e.target.value })} onBlur={commit} />
          </label>
          <label className="field narrow">
            <span>FTP port</span>
            <input
              type="number"
              value={form.vita.port}
              onChange={(e) => setVita({ port: Number(e.target.value) || 1337 })}
              onBlur={commit}
            />
          </label>
          <label className="field">
            <span>ROM folder on the Vita</span>
            <input value={form.vita.romRoot} onChange={(e) => setVita({ romRoot: e.target.value })} onBlur={commit} />
          </label>
        </div>
        <div className="row gap">
          <button onClick={() => void runTest()} disabled={!!busy || !form.vita.host}>
            Test connection
          </button>
          {test && (
            <span className={test.ok ? 'good' : 'bad'}>
              {test.message}
              {test.ok && test.devices.length > 0 && ` · devices: ${test.devices.join(', ')}`}
            </span>
          )}
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={form.vita.debugFtp}
            onChange={(e) => void onSave({ vita: { ...form.vita, debugFtp: e.target.checked } })}
          />
          Log every FTP command and reply in the progress log (for diagnosing dropped connections)
        </label>
        <small>Start the FTP server in VitaShell (Select button) or run the vitacompanion plugin. Both listen on port 1337.</small>
      </section>

      <section className="panel form">
        <h3>Bubbles</h3>
        <label className="field">
          <span>Output folder for exported bubbles and VPKs</span>
          <div className="row gap">
            <input value={form.outputDir} onChange={(e) => setForm({ ...form, outputDir: e.target.value })} onBlur={commit} />
            <button onClick={() => void browse('outputDir')}>Browse…</button>
          </div>
        </label>
        <label className="field">
          <span>Launcher eboot.bin (leave empty for the bundled path)</span>
          <input
            value={form.launcherPath}
            placeholder={launcher?.path}
            onChange={(e) => setForm({ ...form, launcherPath: e.target.value })}
            onBlur={commit}
          />
          <small className={launcher?.exists ? 'good' : 'bad'}>
            {launcher?.exists ? `Found (${launcher.size} bytes) at ${launcher.path}` : `Not found at ${launcher?.path ?? '…'}`}
          </small>
        </label>
        <label className="field">
          <span>RetroArch core path template</span>
          <input
            className="mono"
            value={form.corePathTemplate}
            placeholder={DEFAULT_CORE_PATH_TEMPLATE}
            onChange={(e) => setForm({ ...form, corePathTemplate: e.target.value })}
            onBlur={commit}
          />
          <small>
            Where RetroArch keeps its cores, as seen from RetroArch itself. The default matches the standard RetroArch VPK, where
            cores live in <span className="mono">ux0:app/RETROVITA/</span>.
          </small>
        </label>
      </section>
    </div>
  )
}
