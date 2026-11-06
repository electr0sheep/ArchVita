import { memo, useMemo, useState } from 'react'
import { EMULATORS, EMULATOR_LIST } from '@shared/emulators'
import { assessGames, summarizeReadiness } from '@shared/readiness'
import { SYSTEMS, systemById } from '@shared/systems'
import type { BuildMode, BuildResult, EmulatorId, Game, GamePatch, LauncherStatus, Settings, SyncResult, SystemDef, VitaCheck } from '@shared/types'
import { api, artUrl, errorMessage, HOME_SCREEN_CAP } from '../lib/api'

type Mode = BuildMode | 'ftp'

interface Props {
  games: Game[]
  settings: Settings
  launcher: LauncherStatus | null
  busy: string | null
  check: VitaCheck | null
  onScan: () => void
  onFetchArt: (gameIds: string[], force: boolean) => void
  onPatch: (patches: { id: string; patch: GamePatch }[]) => void
  onSetCustomArt: (gameId: string, kind: 'boxart' | 'snap') => void
  onPreviewUri: (gameId: string) => Promise<string>
  onCheckVita: () => Promise<void>
  onOpenEmulators: () => void
  onClearLog: () => void
  onRun: <T>(name: string, fn: () => Promise<T>) => Promise<T | undefined>
  onSaveSettings: (patch: Partial<Settings>) => Promise<void>
}

const ART_LABEL: Record<Game['art']['status'], string> = {
  none: 'not fetched',
  fetched: 'art ok',
  partial: 'partial',
  missing: 'no art found',
  custom: 'custom'
}

const MODES: Record<Mode, { title: string; body: string }> = {
  ftp: {
    title: 'Push to the Vita over FTP',
    body: 'Each bubble is uploaded as a VPK and installed on the spot by VitaShell, whose FTP server must be running (Select button). Over vitacompanion the folders are uploaded instead and you finish with Refresh LiveArea.'
  },
  folders: {
    title: 'Export bubble folders',
    body: 'One app folder per game. Copy them into ux0:app over USB along with the ROMs, then run Refresh LiveArea in VitaShell.'
  },
  vpk: {
    title: 'Export VPKs',
    body: 'One installable VPK per game, to install from VitaShell by hand. Slower one by one, but needs no FTP.'
  }
}

function defaultCore(game: Game, system: SystemDef | undefined): string {
  if (!system) return ''
  return (game.emulator === 'emu4vita' ? system.emu4vitaCore : system.core) ?? ''
}

interface RowProps {
  game: Game
  system: SystemDef | undefined
  onPatch: Props['onPatch']
  onSetCustomArt: Props['onSetCustomArt']
  onPreview: (game: Game) => void
}

const GameRow = memo(function GameRow({ game, system, onPatch, onSetCustomArt, onPreview }: RowProps) {
  const [name, setName] = useState(game.customName ?? '')
  const [core, setCore] = useState(game.core ?? '')
  const profile = EMULATORS[game.emulator]
  const unsupported = system?.unsupportedReason

  const commitName = () => {
    if ((game.customName ?? '') !== name) onPatch([{ id: game.id, patch: { customName: name } }])
  }
  const commitCore = () => {
    const next = core.trim()
    if ((game.core ?? '') !== next) onPatch([{ id: game.id, patch: { core: next || undefined } }])
  }
  const changeEmulator = (emulator: EmulatorId) => {
    setCore('')
    onPatch([{ id: game.id, patch: { emulator, core: undefined } }])
  }

  return (
    <tr className={`${game.selected ? 'selected' : ''} ${unsupported ? 'unsupported' : ''}`}>
      <td className="cell-check">
        <input
          type="checkbox"
          checked={game.selected}
          disabled={!!unsupported}
          onChange={(e) => onPatch([{ id: game.id, patch: { selected: e.target.checked } }])}
        />
      </td>
      <td className="cell-art">
        {game.art.boxart ? <img src={artUrl(game.art.boxart)} alt="" /> : <div className="art-empty">{system?.shortName ?? '?'}</div>}
      </td>
      <td className="cell-name">
        <input
          className="inline"
          value={name}
          placeholder={game.name}
          title={game.fileName}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        <div className="file-name">{game.fileName}</div>
        {unsupported && <div className="hint warn">{unsupported}</div>}
      </td>
      <td>
        <span className="pill">{system?.shortName ?? game.systemId}</span>
      </td>
      <td className="cell-emulator">
        <div className="stack">
          <select value={game.emulator} disabled={!!unsupported} onChange={(e) => changeEmulator(e.target.value as EmulatorId)}>
            {EMULATOR_LIST.map((emu) => (
              <option key={emu.id} value={emu.id}>
                {emu.name}
              </option>
            ))}
          </select>
          {profile.needsCore && (
            <input
              className="inline mono"
              list={`cores-${game.emulator}`}
              value={core}
              placeholder={defaultCore(game, system) || 'core'}
              onChange={(e) => setCore(e.target.value)}
              onBlur={commitCore}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
          )}
        </div>
      </td>
      <td className="cell-artstatus">
        <span className={`pill art-${game.art.status}`}>{ART_LABEL[game.art.status]}</span>
        <div className="row gap-s">
          <button className="ghost small" onClick={() => onSetCustomArt(game.id, 'boxart')} title="Use your own box art">
            Box
          </button>
          <button className="ghost small" onClick={() => onSetCustomArt(game.id, 'snap')} title="Use your own background screenshot">
            BG
          </button>
        </div>
      </td>
      <td className="mono cell-id">
        <button className="ghost small mono" onClick={() => onPreview(game)} title="Show the launch URI this bubble will use">
          {game.titleId}
        </button>
      </td>
    </tr>
  )
})

export function LibraryView({
  games,
  settings,
  launcher,
  busy,
  check,
  onScan,
  onFetchArt,
  onPatch,
  onSetCustomArt,
  onPreviewUri,
  onCheckVita,
  onOpenEmulators,
  onClearLog,
  onRun,
  onSaveSettings
}: Props) {
  const [search, setSearch] = useState('')
  const [systemFilter, setSystemFilter] = useState('all')
  const [onlySelected, setOnlySelected] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('ftp')
  const [result, setResult] = useState<BuildResult | SyncResult | null>(null)

  const presentSystems = useMemo(() => {
    const ids = new Set(games.map((g) => g.systemId))
    return SYSTEMS.filter((s) => ids.has(s.id))
  }, [games])

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return games.filter(
      (g) =>
        (systemFilter === 'all' || g.systemId === systemFilter) &&
        (!onlySelected || g.selected) &&
        (!needle || g.name.toLowerCase().includes(needle) || g.fileName.toLowerCase().includes(needle))
    )
  }, [games, search, systemFilter, onlySelected])

  const selected = useMemo(() => games.filter((g) => g.selected), [games])
  const missingArt = shown.filter((g) => g.art.status === 'none' || g.art.status === 'missing').map((g) => g.id)
  const readiness = useMemo(() => (check ? summarizeReadiness(assessGames(selected, check)) : null), [selected, check])

  const { vita } = settings
  const count = selected.length
  const canRun = !busy && count > 0 && !!launcher?.exists && (mode !== 'ftp' || !!vita.host)
  const plural = (word: string) => `${count} ${word}${count === 1 ? '' : 's'}`
  const actionLabel = mode === 'ftp' ? `Sync ${plural('game')} to Vita` : mode === 'folders' ? `Export ${plural('folder')}` : `Export ${plural('VPK')}`
  const target =
    mode === 'ftp'
      ? `${vita.host ? `Target ${vita.host}:${vita.port}` : 'No Vita IP set (see Settings)'} · ROMs go to ${vita.romRoot}/<system>/.`
      : `Output: ${settings.outputDir}.`
  const sync = result && 'notes' in result ? result : null

  const setShownSelected = (value: boolean) =>
    onPatch(
      shown
        .filter((g) => g.selected !== value && !systemById(g.systemId)?.unsupportedReason)
        .map((g) => ({ id: g.id, patch: { selected: value } }))
    )

  const showPreview = async (game: Game) => {
    try {
      setPreview(`${game.name}\n${await onPreviewUri(game.id)}`)
    } catch (e) {
      setPreview(errorMessage(e))
    }
  }

  const start = async () => {
    setResult(null)
    onClearLog()
    const gameIds = selected.map((g) => g.id)
    const outcome =
      mode === 'ftp'
        ? await onRun('Syncing to Vita', () => api.sync({ gameIds }))
        : await onRun('Building bubbles', () => api.build({ gameIds, mode }))
    if (outcome) setResult(outcome)
  }

  return (
    <div className="view">
      <header className="view-header">
        <div>
          <h2>Library</h2>
          <p className="muted">
            {settings.libraryRoot ? settings.libraryRoot : 'No ROM folder set yet. Pick one in Settings, then scan.'}
          </p>
        </div>
        <div className="row gap">
          <button className="primary" onClick={onScan} disabled={!!busy || !settings.libraryRoot}>
            Scan library
          </button>
          <button onClick={() => onFetchArt(missingArt, false)} disabled={!!busy || !missingArt.length}>
            Fetch missing art ({missingArt.length})
          </button>
          <button onClick={() => onFetchArt(shown.map((g) => g.id), true)} disabled={!!busy || !shown.length}>
            Refetch shown
          </button>
        </div>
      </header>

      <div className="toolbar">
        <input className="search" placeholder="Search games…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={systemFilter} onChange={(e) => setSystemFilter(e.target.value)}>
          <option value="all">All systems</option>
          {presentSystems.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={onlySelected} onChange={(e) => setOnlySelected(e.target.checked)} /> Selected only
        </label>
        <span className="spacer" />
        <button className="ghost" onClick={() => setShownSelected(true)} disabled={!shown.length}>
          Select shown
        </button>
        <button className="ghost" onClick={() => setShownSelected(false)} disabled={!shown.length}>
          Deselect shown
        </button>
        <span className={`count ${count > HOME_SCREEN_CAP ? 'bad' : ''}`}>
          {count} selected · {shown.length} shown
        </span>
      </div>

      {count > HOME_SCREEN_CAP - 50 && (
        <div className="banner warn">
          The Vita home screen holds at most {HOME_SCREEN_CAP} icons including everything already installed. Keep bubbles for
          favourites and use a frontend such as RetroFlow for the rest.
        </div>
      )}

      {preview && (
        <div className="banner info">
          <pre>{preview}</pre>
          <button className="ghost" onClick={() => setPreview(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      {EMULATOR_LIST.filter((emu) => emu.cores.length).map((emu) => (
        <datalist key={emu.id} id={`cores-${emu.id}`}>
          {emu.cores.map((core) => (
            <option key={core} value={core} />
          ))}
        </datalist>
      ))}

      <div className="table-wrap">
        <table className="games">
          <thead>
            <tr>
              <th />
              <th />
              <th>Game</th>
              <th>System</th>
              <th>Emulator / core</th>
              <th>Artwork</th>
              <th>Bubble ID</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((game) => (
              <GameRow
                key={game.id}
                game={game}
                system={systemById(game.systemId)}
                onPatch={onPatch}
                onSetCustomArt={onSetCustomArt}
                onPreview={showPreview}
              />
            ))}
            {!shown.length && (
              <tr>
                <td colSpan={7} className="empty">
                  {games.length
                    ? 'Nothing matches the current filter.'
                    : 'Scan your library to get started. Settings can create the system folders for you if the library is empty.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="build-bar">
        {!launcher?.exists && (
          <div className="banner warn">
            The launcher binary is missing ({launcher?.path}). Build it with VitaSDK or the GitHub workflow and drop it there, or set
            its path in Settings. Nothing can be generated without it.
          </div>
        )}

        {readiness && readiness.issues.length > 0 && (
          <div className="banner warn">
            <div>
              <div>
                {readiness.affected.length} of {count} selected game(s) would fail with a C1-2738-0 error:
              </div>
              <ul className="plain">
                {readiness.issues.map((issue) => (
                  <li key={issue.label}>
                    {issue.label} ({issue.count} game{issue.count === 1 ? '' : 's'})
                  </li>
                ))}
              </ul>
            </div>
            <div className="row gap">
              <button onClick={onOpenEmulators}>Fix in Emulators</button>
              <button className="ghost" onClick={() => onPatch(readiness.affected.map((item) => ({ id: item.game.id, patch: { selected: false } })))}>
                Deselect them
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="banner info">
            <div className="build-result">
              <strong>
                {result.built.length} built · {result.failed.length} failed
                {sync && ` · ${sync.romsUploaded} ROM files uploaded, ${sync.romsSkipped} already there`}
              </strong>
              {sync ? sync.notes.map((note) => <div key={note} className="muted">{note}</div>) : <div className="muted">Written to {result.outputDir}</div>}
              {result.failed.length > 0 && (
                <ul className="failures">
                  {result.failed.map((f) => (
                    <li key={f.gameId}>
                      <strong>{f.name}</strong>: {f.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button className="ghost" onClick={() => setResult(null)} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}

        <div className="build-controls">
          <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            {Object.entries(MODES).map(([id, m]) => (
              <option key={id} value={id}>
                {m.title}
              </option>
            ))}
          </select>
          {mode === 'ftp' && (
            <>
              <label className="check">
                <input
                  type="checkbox"
                  checked={vita.uploadRoms}
                  onChange={(e) => void onSaveSettings({ vita: { ...vita, uploadRoms: e.target.checked } })}
                />
                Upload missing ROMs
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={vita.updateAppMeta}
                  onChange={(e) => void onSaveSettings({ vita: { ...vita, updateAppMeta: e.target.checked } })}
                />
                Refresh art of installed bubbles
              </label>
            </>
          )}
          <span className="spacer" />
          <button onClick={() => void onCheckVita()} disabled={!!busy || !vita.host}>
            {check ? 'Check again' : 'Check the Vita'}
          </button>
          {mode !== 'ftp' && (
            <button className="ghost" onClick={() => void api.openPath(settings.outputDir)}>
              Open output folder
            </button>
          )}
          <button className="primary" onClick={() => void start()} disabled={!canRun}>
            {actionLabel}
          </button>
        </div>

        <div className="build-hint">
          <span className="muted">
            {target} {MODES[mode].body}
          </span>
          {readiness && count > 0 && readiness.issues.length === 0 && (
            <span className="good"> Every selected game has its emulator and core installed.</span>
          )}
          {!check && vita.host && <span className="muted"> Press "Check the Vita" to see which selected games would fail to launch.</span>}
        </div>
      </section>
    </div>
  )
}
