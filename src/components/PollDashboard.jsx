import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'

const POLL_INTERVAL_MS = 5000

function formatRemaining(closesAt) {
  if (!closesAt) return null
  const ms = new Date(closesAt).getTime() - Date.now()
  if (ms <= 0) return 'closing…'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h left`
  if (h > 0) return `${h}h ${m}m left`
  if (m > 0) return `${m}m left`
  return `${s}s left`
}

function optionLabel(o) {
  const parts = [o.song, o.artist].filter(Boolean)
  if (parts.length) return parts.join(' — ')
  return o.genre || o.notes || `Option ${o.optionIndex}`
}

export default function PollDashboard({ poll: initialPoll, onClosed }) {
  const [poll, setPoll] = useState(initialPoll)
  const [closing, setClosing] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirmingClose, setConfirmingClose] = useState(false)
  const [, setTick] = useState(0)

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return `/poll/${poll.id}`
    return `${window.location.origin}/poll/${poll.id}`
  }, [poll.id])

  const totalVotes = useMemo(() => {
    return Object.values(poll.tallies || {}).reduce((a, b) => a + Number(b || 0), 0)
  }, [poll.tallies])

  useEffect(() => {
    let cancelled = false
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/polls/active')
        if (!res.ok) return
        const body = await res.json()
        if (cancelled) return
        if (!body.active) {
          onClosed?.()
          return
        }
        setPoll(body.active)
      } catch { /* ignore transient errors */ }
    }, POLL_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [onClosed])

  useEffect(() => {
    if (!poll.closesAt) return
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [poll.closesAt])

  async function copyShare() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard unavailable */ }
  }

  async function handleClose() {
    setConfirmingClose(false)
    setClosing(true)
    setError('')
    try {
      const res = await fetch('/api/polls/close', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error || 'Failed to close poll')
        return
      }
      onClosed?.()
    } catch {
      setError('Network error')
    } finally {
      setClosing(false)
    }
  }

  const remaining = formatRemaining(poll.closesAt)

  return (
    <div className="poll-dashboard">
      <div className="poll-dashboard-header">
        <h2>{poll.question}</h2>
        <div className="poll-meta">
          <span>{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</span>
          {remaining && <span>· {remaining}</span>}
        </div>
      </div>

      <div className="poll-share">
        <input
          type="text"
          readOnly
          className="search-input"
          value={shareUrl}
          onFocus={(e) => e.target.select()}
        />
        <button type="button" className="btn btn-secondary" onClick={copyShare}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <ul className="poll-tally-list">
        {poll.options.map((o) => {
          const count = Number(poll.tallies?.[o.optionIndex] || 0)
          const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0
          return (
            <li key={o.optionIndex} className="poll-tally-row">
              <div className="poll-tally-top">
                <span className="poll-tally-label">{optionLabel(o)}</span>
                <span className="poll-tally-count">{count} · {pct}%</span>
              </div>
              <div className="poll-tally-bar">
                <div className="poll-tally-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              {(o.genre || o.notes) && (
                <div className="poll-tally-sub">
                  {o.genre && <span className="genre-tag">{o.genre}</span>}
                  {o.notes && <span className="poll-tally-notes">{o.notes}</span>}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {error && <p className="error">{error}</p>}

      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => setConfirmingClose(true)}
        disabled={closing}
      >
        {closing ? 'Closing…' : 'Close poll now'}
      </button>

      <Modal
        open={confirmingClose}
        title="Close poll?"
        message="Close this poll now? This cannot be undone."
        confirmLabel="Close poll"
        cancelLabel="Keep open"
        variant="danger"
        busy={closing}
        onConfirm={handleClose}
        onCancel={() => setConfirmingClose(false)}
      />
    </div>
  )
}
