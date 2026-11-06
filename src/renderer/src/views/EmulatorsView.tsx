import { useEffect, useMemo, useState } from 'react'
import { EMULATORS } from '@shared/emulators'
import { EMULATOR_PACKAGES, SHADER_COMPILER_PATH, TOOL_PACKAGES } from '@shared/packages'
import { systemById } from '@shared/systems'
import type {
  EmulatorId,
  EmulatorPackage,
  EmulatorStatus,
  Game,
  InstallMode,
  InstallOptions,
  InstallResult,
  ReleaseChannel,
  ResolvedPackage,
  Settings,
  VitaCheck
} from '@shared/types'
import { resolveCore } from '@shared/uri'
import { api } from '../lib/api'

interface Props {
  games: Game[]
  settings: Settings
  busy: string | null
  check: VitaCheck | null
  onCheckVita: () => Promise<void>
  onClearLog: () => void
  onRun: <T>(name: string, fn: () => Promise<T>) => Promise<T | undefined>
  onSaveSettings: (patch: Partial<Settings>) => Promise<void>
}

interface CoreChoice {
  all: boolean
  cores: string[]
}

const mb = (bytes: number | undefined): string => (bytes ? `${(bytes / (1 << 20)).toFixed(0)} MB` : '')

function neededCores(games: Game[], emulator: EmulatorId): string[] {
  const cores = new Set<string>()
  for (const game of games) {
    if (game.emulator !== emulator) continue
    const system = systemById(game.systemId)
    const core = system && resolveCore(game, system)
    if (core) cores.add(core)
  }
  return [...cores].sort()
}

interface CardProps {
  pkg: EmulatorPackage
  info: ResolvedPackage | undefined
  status: EmulatorStatus | undefined
  needed: string[]
  choice: CoreChoice
  mode: InstallMode
  includeData: boolean
  busy: boolean
  result: InstallResult | undefined
  shaderCompiler: boolean | undefined
  channel: ReleaseChannel
  onChannel: (channel: ReleaseChannel) => void
  onChoice: (choice: CoreChoice) => void
  onIncludeData: (value: boolean) => void
  onInstall: (options: Omit<InstallOptions, 'mode' | 'packageId'>) => void
}

function PackageCard({ pkg, info, status, needed, choice, mode, includeData, busy, result, shaderCompiler, channel, onChannel, onChoice, onIncludeData, onInstall }: CardProps) {
  const [newCore, setNewCore] = useState('')
  const profile = EMULATORS[pkg.id as EmulatorId]
  const missingOnVita = status?.installed ? choice.cores.filter((c) => !status.cores.includes(c)) : []
  const damaged = status?.damagedCores ?? []
  const toRepair = [...new Set([...missingOnVita, ...damaged])]
  const knownCores = profile?.cores ?? []

  const addCore = () => {
    const core = newCore.trim()
    if (core && !choice.cores.includes(core)) onChoice({ ...choice, cores: [...choice.cores, core].sort() })
    setNewCore('')
  }

  return (
    <section className="panel emu-card">
      <header className="panel-header">
        <div className="row gap">
          <h3>{pkg.name}</h3>
          <span className="pill mono">{pkg.titleId}</span>
          {status && <span className={`pill ${status.installed ? 'art-fetched' : 'art-missing'}`}>{status.installed ? 'on the Vita' : 'not on the Vita'}</span>}
        </div>
        <span className="muted">
          {info?.error ? <span className="bad">{info.error}</span> : info ? `${info.version}${info.size ? ` · ${mb(info.size)}` : ''}` : 'version not checked'}
        </span>
      </header>

      {pkg.notes.map((note) => (
        <div key={note} className="muted small-text">
          {note}
        </div>
      ))}
      {pkg.app.kind === 'libretro' && (
        <div className="row gap wrap">
          <label className="check">
            <input type="radio" checked={channel === 'stable'} disabled={busy} onChange={() => onChannel('stable')} /> Stable release
          </label>
          <label className="check">
            <input type="radio" checked={channel === 'nightly'} disabled={busy} onChange={() => onChannel('nightly')} /> Nightly build
          </label>
          <span className="muted small-text">
            Cloud Sync for saves, HTTPS, and loading games from SMB or NFS shares are nightly-only until the next stable release.
          </span>
        </div>
      )}
      {profile?.needsShaderCompiler && (
        <div className={`small-text ${shaderCompiler === false ? 'bad' : 'muted'}`}>
          Needs the runtime shader compiler
          {shaderCompiler === false ? ', which is not on the Vita yet. Install it with ShaRKBR33D below.' : shaderCompiler ? ', which is on the Vita.' : ' (see the card below).'}
        </div>
      )}

      {pkg.coreFiles && (
        <div className="cores">
          <div className="row gap wrap">
            <label className="check">
              <input type="radio" checked={!choice.all} onChange={() => onChoice({ ...choice, all: false })} /> Only these cores
            </label>
            <label className="check">
              <input type="radio" checked={choice.all} onChange={() => onChoice({ ...choice, all: true })} /> All cores{info?.size ? ` (${mb(info.size)})` : ''}
            </label>
            <span className="spacer" />
            <button className="ghost small" onClick={() => onChoice({ all: false, cores: needed })} disabled={!needed.length}>
              Reset to what the library needs
            </button>
          </div>
          {!choice.all && (
            <div className="chips">
              {choice.cores.map((core) => (
                <span key={core} className={`chip ${status?.installed && (!status.cores.includes(core) || damaged.includes(core)) ? 'chip-missing' : ''}`}>
                  {core}
                  <button className="chip-x" onClick={() => onChoice({ ...choice, cores: choice.cores.filter((c) => c !== core) })} aria-label={`Remove ${core}`}>
                    ×
                  </button>
                </span>
              ))}
              {!choice.cores.length && <span className="muted">No cores selected. Scan the library or add cores by name.</span>}
              <span className="chip-add">
                <input
                  className="inline mono"
                  list={`install-cores-${pkg.id}`}
                  placeholder="add core…"
                  value={newCore}
                  onChange={(e) => setNewCore(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCore()}
                  onBlur={addCore}
                />
                <datalist id={`install-cores-${pkg.id}`}>
                  {knownCores.map((core) => (
                    <option key={core} value={core} />
                  ))}
                </datalist>
              </span>
            </div>
          )}
          {status?.installed && (
            <div className="muted small-text">
              {status.cores.length} core(s) installed
              {status.verified ? ', sizes checked against the downloaded package' : ''}.{' '}
              {missingOnVita.length ? `Missing from the Vita: ${missingOnVita.join(', ')}. ` : 'All selected cores are present. '}
              {damaged.length > 0 && <span className="bad">Damaged (size differs from the package): {damaged.join(', ')}.</span>}
            </div>
          )}
        </div>
      )}

      {pkg.data && (
        <label className="check">
          <input type="checkbox" checked={includeData} onChange={(e) => onIncludeData(e.target.checked)} />
          Also install the data files{info?.dataSize ? ` (${mb(info.dataSize)})` : ''} to ux0:data/{pkg.data.vitaDir}
        </label>
      )}

      <div className="row gap wrap">
        <button
          className="primary"
          disabled={busy || !!info?.error || (!!pkg.coreFiles && !choice.all && !choice.cores.length)}
          onClick={() => onInstall({ cores: choice.cores, allCores: choice.all, includeData })}
        >
          {mode === 'ftp' ? `Install ${pkg.name} to Vita` : `Export ${pkg.name} folder`}
        </button>
        {pkg.coreFiles && mode === 'ftp' && status?.installed && toRepair.length > 0 && (
          <button disabled={busy} onClick={() => onInstall({ cores: toRepair, coresOnly: true })}>
            Re-send the {toRepair.length} missing or damaged core(s) only
          </button>
        )}
        {result && (
          <span className="muted">
            Done: {result.files} files, {mb(result.bytes)} to {result.destination}
          </span>
        )}
      </div>
      {result?.notes.map((note) => (
        <div key={note} className="banner info">
          {note}
        </div>
      ))}
    </section>
  )
}

export function EmulatorsView({ games, settings, busy, check, onCheckVita, onClearLog, onRun, onSaveSettings }: Props) {
  const statuses = check?.emulators ?? null
  const [mode, setMode] = useState<InstallMode>('ftp')
  const [resolved, setResolved] = useState<ResolvedPackage[] | null>(null)
  const [choices, setChoices] = useState<Partial<Record<string, CoreChoice>>>({})
  const [includeData, setIncludeData] = useState<Partial<Record<string, boolean>>>({})
  const [results, setResults] = useState<Partial<Record<string, InstallResult>>>({})

  const needed = useMemo(
    () => ({ retroarch: neededCores(games, 'retroarch'), emu4vita: neededCores(games, 'emu4vita') }) as Partial<Record<string, string[]>>,
    [games]
  )

  useEffect(() => {
    setChoices((prev) => {
      const next = { ...prev }
      for (const pkg of EMULATOR_PACKAGES) {
        if (pkg.coreFiles && !next[pkg.id]) next[pkg.id] = { all: false, cores: needed[pkg.id] ?? [] }
      }
      return next
    })
  }, [needed])

  useEffect(() => {
    void api.resolveEmulators(false).then(setResolved).catch(() => setResolved([]))
  }, [])

  const refreshVersions = async () => {
    const outcome = await onRun('Checking versions', () => api.resolveEmulators(true))
    if (outcome) setResolved(outcome)
  }

  const changeChannel = async (channel: ReleaseChannel) => {
    await onSaveSettings({ retroarchChannel: channel })
    await refreshVersions()
  }

  const install = async (options: InstallOptions, key: string) => {
    onClearLog()
    const outcome = await onRun('Installing emulator', () => api.installEmulator(options))
    if (outcome) {
      setResults((prev) => ({ ...prev, [key]: outcome }))
      if (mode === 'ftp' && statuses) void onCheckVita()
    }
  }

  const installVpk = async () => {
    const file = await api.pickVpk()
    if (file) await install({ localVpk: file, mode }, 'custom')
  }

  return (
    <div className="view">
      <header className="view-header">
        <div>
          <h2>Emulators</h2>
          <p className="muted">
            Download the emulators your bubbles launch and put them on the Vita the same way bubbles go on: into ux0:app, registered with one
            Refresh LiveArea.
          </p>
        </div>
        <div className="row gap">
          <button onClick={() => void refreshVersions()} disabled={!!busy}>
            Check versions
          </button>
          <button onClick={() => void onCheckVita()} disabled={!!busy || !settings.vita.host}>
            {statuses ? 'Check the Vita again' : 'Check the Vita'}
          </button>
        </div>
      </header>

      <div className="toolbar">
        <label className="check">
          <input type="radio" checked={mode === 'ftp'} onChange={() => setMode('ftp')} /> Install over FTP
          {settings.vita.host ? ` (${settings.vita.host})` : ' (set the Vita IP in Settings)'}
        </label>
        <label className="check">
          <input type="radio" checked={mode === 'folder'} onChange={() => setMode('folder')} /> Export folders to {settings.outputDir}
        </label>
      </div>

      {EMULATOR_PACKAGES.map((pkg) => (
        <PackageCard
          key={pkg.id}
          pkg={pkg}
          info={resolved?.find((r) => r.id === pkg.id)}
          status={statuses?.find((s) => s.id === pkg.id)}
          needed={needed[pkg.id] ?? []}
          choice={choices[pkg.id] ?? { all: false, cores: [] }}
          mode={mode}
          includeData={includeData[pkg.id] ?? true}
          busy={!!busy}
          result={results[pkg.id]}
          shaderCompiler={check?.shaderCompiler}
          channel={settings.retroarchChannel}
          onChannel={(channel) => void changeChannel(channel)}
          onChoice={(choice) => setChoices((prev) => ({ ...prev, [pkg.id]: choice }))}
          onIncludeData={(value) => setIncludeData((prev) => ({ ...prev, [pkg.id]: value }))}
          onInstall={(options) => void install({ ...options, mode, packageId: pkg.id }, pkg.id)}
        />
      ))}

      {TOOL_PACKAGES.map((tool) => {
        const info = resolved?.find((r) => r.id === tool.id)
        const result = results[tool.id]
        return (
          <section key={tool.id} className="panel emu-card">
            <header className="panel-header">
              <div className="row gap">
                <h3>Runtime shader compiler</h3>
                <span className="pill mono">{SHADER_COMPILER_PATH}</span>
                {check && (
                  <span className={`pill ${check.shaderCompiler ? 'art-fetched' : 'art-missing'}`}>
                    {check.shaderCompiler ? 'on the Vita' : 'not on the Vita'}
                  </span>
                )}
              </div>
              <span className="muted">
                {info?.error ? <span className="bad">{info.error}</span> : info ? `${tool.name} ${info.version}` : 'version not checked'}
              </span>
            </header>
            <div className="muted small-text">
              DaedalusX64 and Flycast compile their shaders on the console with a Sony module the firmware does not ship. RetroArch and
              Emu4Vita++ do not need it.
            </div>
            {tool.notes.map((note) => (
              <div key={note} className="muted small-text">
                {note}
              </div>
            ))}
            <div className="muted small-text">
              After it is installed: run Refresh LiveArea, open {tool.name} on the Vita with Wi-Fi connected and let it finish, then press
              Check the Vita here.
            </div>
            <div className="row gap wrap">
              <button
                className="primary"
                disabled={!!busy || !!info?.error}
                onClick={() => void install({ mode, packageId: tool.id }, tool.id)}
              >
                {mode === 'ftp' ? `Install ${tool.name} to Vita` : `Export ${tool.name} folder`}
              </button>
              {result && (
                <span className="muted">
                  Done: {result.files} files, {mb(result.bytes)} to {result.destination}
                </span>
              )}
            </div>
            {result?.notes.map((note) => (
              <div key={note} className="banner info">
                {note}
              </div>
            ))}
          </section>
        )
      })}

      <section className="panel emu-card">
        <header className="panel-header">
          <h3>Any other VPK</h3>
          <span className="muted">For homebrew that is not listed above, or a build you downloaded yourself.</span>
        </header>
        <div className="row gap">
          <button onClick={() => void installVpk()} disabled={!!busy}>
            Choose a VPK…
          </button>
          {results.custom && (
            <span className="muted">
              Done: {results.custom.titleId}, {results.custom.files} files, {mb(results.custom.bytes)}
            </span>
          )}
        </div>
        {results.custom?.notes.map((note) => (
          <div key={note} className="banner info">
            {note}
          </div>
        ))}
      </section>
    </div>
  )
}
