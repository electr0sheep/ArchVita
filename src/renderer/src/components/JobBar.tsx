import { useEffect, useRef, useState } from 'react'
import type { Progress } from '@shared/types'
import { api } from '../lib/api'

interface Props {
  busy: string | null
  log: Progress[]
}

const HIDE_AFTER_SUCCESS_MS = 6000

export function JobBar({ busy, log }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [dismissedAt, setDismissedAt] = useState(0)
  const logRef = useRef<HTMLDivElement>(null)

  const latest = log.length ? log[log.length - 1] : null
  const determinate = [...log].reverse().find((entry) => entry.total > 0) ?? null
  const percent = determinate ? Math.min(100, Math.round((determinate.current / determinate.total) * 100)) : null
  const failed = !busy && latest?.level === 'error'
  const finished = !busy && latest?.level === 'done'

  useEffect(() => {
    if (!finished) return
    const timer = setTimeout(() => setDismissedAt(log.length), HIDE_AFTER_SUCCESS_MS)
    return () => clearTimeout(timer)
  }, [finished, log.length])

  useEffect(() => {
    if (busy) setDismissedAt(0)
  }, [busy])

  useEffect(() => {
    if (expanded) logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [expanded, log.length])

  const visible = !!busy || ((failed || finished) && dismissedAt < log.length)
  if (!visible || !latest) return null

  const title = busy ? `${busy}…` : failed ? 'Failed' : 'Finished'
  const count = busy && determinate ? ` (${Math.min(determinate.current, determinate.total)}/${determinate.total})` : ''

  return (
    <div className={`job-bar ${busy ? 'active' : failed ? 'failed' : 'finished'}`}>
      <div className="job-bar-main">
        <span className="job-bar-title">{title}</span>
        <span className="job-bar-message" title={latest.message}>
          {latest.message}
          {count}
        </span>
        <div className="row gap-s">
          <button className="ghost small" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Hide log' : 'Show log'}
          </button>
          {busy ? (
            <button className="ghost small" onClick={() => void api.cancelJob()}>
              Cancel
            </button>
          ) : (
            <button className="ghost small" onClick={() => setDismissedAt(log.length)}>
              Dismiss
            </button>
          )}
        </div>
      </div>
      <div className="progress-bar">
        <div
          className={`progress-fill ${busy ? 'active' : ''}`}
          style={{ width: busy ? (percent === null ? '100%' : `${percent}%`) : '100%' }}
        />
      </div>
      {expanded && (
        <div className="log job-bar-log" ref={logRef}>
          {log.slice(-300).map((entry, i) => (
            <div key={i} className={`log-line ${entry.level}`}>
              {entry.message}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
