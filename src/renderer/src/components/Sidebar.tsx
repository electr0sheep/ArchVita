import type { LauncherStatus, Settings } from '@shared/types'
import { HOME_SCREEN_CAP } from '../lib/api'

export type View = 'library' | 'emulators' | 'settings'

interface Props {
  view: View
  onChange: (view: View) => void
  launcher: LauncherStatus | null
  settings: Settings | null
  busy: string | null
  gameCount: number
  selectedCount: number
}

const NAV: { id: View; label: string; hint: string }[] = [
  { id: 'library', label: 'Library', hint: 'Scan ROMs, pick games, push bubbles to the Vita' },
  { id: 'emulators', label: 'Emulators', hint: 'Put RetroArch and friends on the Vita' },
  { id: 'settings', label: 'Settings', hint: 'Paths, Vita connection, launcher' }
]

export function Sidebar({ view, onChange, launcher, settings, busy, gameCount, selectedCount }: Props) {
  const overCap = selectedCount > HOME_SCREEN_CAP
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">AV</div>
        <div>
          <div className="brand-name">ArchVita</div>
          <div className="brand-sub">bubbles for the Vita</div>
        </div>
      </div>

      <nav>
        {NAV.map((item) => (
          <button key={item.id} className={`nav-item ${view === item.id ? 'active' : ''}`} onClick={() => onChange(item.id)}>
            <span className="nav-label">{item.label}</span>
            <span className="nav-hint">{item.hint}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-status">
        <div className="status-row">
          <span className="status-key">Games</span>
          <span>{gameCount}</span>
        </div>
        <div className="status-row">
          <span className="status-key">Selected</span>
          <span className={overCap ? 'bad' : ''}>
            {selectedCount} / {HOME_SCREEN_CAP}
          </span>
        </div>
        <div className="status-row">
          <span className="status-key">Launcher</span>
          <span className={launcher?.exists ? 'good' : 'bad'}>{launcher?.exists ? 'ready' : 'missing'}</span>
        </div>
        <div className="status-row">
          <span className="status-key">Vita</span>
          <span>{settings?.vita.host || 'not set'}</span>
        </div>
        {busy && <div className="busy-pill">{busy}…</div>}
      </div>
    </aside>
  )
}
