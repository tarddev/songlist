import { useEffect, useMemo, useState } from 'react'

const VOTED_PREFIX = 'poll_voted:'

function readVotedCookie(pollId) {
  if (typeof document === 'undefined') return null
  const key = VOTED_PREFIX + pollId
  for (const c of document.cookie.split(';')) {
    const [k, v] = c.trim().split('=')
    if (k === key) return Number(decodeURIComponent(v || '')) || null
  }
  return null
}

function writeVotedCookie(pollId, optionIndex) {
  if (typeof document === 'undefined') return
  const days = 90
  const expires = new Date(Date.now() + days * 86400_000).toUTCString()
  document.cookie = `${VOTED_PREFIX}${pollId}=${optionIndex}; expires=${expires}; path=/; SameSite=Lax`
}

function optionLabel(o) {
  const parts = [o.song, o.artist].filter(Boolean)
  if (parts.length) return parts.join(' — ')
  return o.genre || o.notes || `Option ${o.optionIndex}`
}

export default function PollVoteView({ id }) {
  const [poll, setPoll] = useState(null)
  const [tallies, setTallies] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState(false)
  const [voteError, setVoteError] = useState('')
  const [votedFor, setVotedFor] = useState(() => readVotedCookie(id))

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    fetch(`/api/polls/${encodeURIComponent(id)}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(body.error || 'Failed to load poll')
        return body
      })
      .then((p) => { if (!cancelled) setPoll(p) })
      .catch((e) => { if (!cancelled) setLoadError(e.message || 'Failed to load poll') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  const showResults = useMemo(() => {
    if (!poll) return false
    return votedFor !== null || !poll.isActive
  }, [poll, votedFor])

  useEffect(() => {
    if (!showResults || !poll) return
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/polls/${encodeURIComponent(poll.id)}/results`)
        if (!res.ok) return
        const body = await res.json()
        if (!cancelled) setTallies(body.tallies || {})
      } catch { /* ignore */ }
    }
    load()
    if (poll.isActive) {
      const t = setInterval(load, 5000)
      return () => { cancelled = true; clearInterval(t) }
    }
    return () => { cancelled = true }
  }, [showResults, poll])

  async function castVote(optionIndex) {
    setVoting(true)
    setVoteError('')
    try {
      const res = await fetch(`/api/polls/${encodeURIComponent(id)}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionIndex }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setVoteError(body.error || 'Failed to record vote')
        if (res.status === 410) {
          setPoll((p) => p ? { ...p, isActive: false } : p)
        }
        return
      }
      writeVotedCookie(id, optionIndex)
      setVotedFor(optionIndex)
    } catch {
      setVoteError('Network error')
    } finally {
      setVoting(false)
    }
  }

  if (loading) {
    return (
      <div className="app">
        <div className="poll-vote-view">
          <p className="poll-loading">Loading poll…</p>
        </div>
      </div>
    )
  }

  if (loadError || !poll) {
    return (
      <div className="app">
        <div className="poll-vote-view">
          <p className="error">{loadError || 'Poll not found'}</p>
        </div>
      </div>
    )
  }

  const totalVotes = tallies
    ? Object.values(tallies).reduce((a, b) => a + Number(b || 0), 0)
    : 0

  return (
    <div className="app">
      <div className="poll-vote-view">
        <header className="poll-vote-header">
          <h1>{poll.question}</h1>
          {!poll.isActive && <p className="poll-status-pill closed">Poll closed</p>}
          {poll.isActive && votedFor !== null && (
            <p className="poll-status-pill voted">Thanks for voting!</p>
          )}
        </header>

        <ul className="poll-vote-list">
          {poll.options.map((o) => {
            const isMyChoice = votedFor === o.optionIndex
            const count = tallies ? Number(tallies[o.optionIndex] || 0) : 0
            const pct = showResults && totalVotes ? Math.round((count / totalVotes) * 100) : 0
            return (
              <li
                key={o.optionIndex}
                className={`poll-vote-card${isMyChoice ? ' is-choice' : ''}`}
              >
                <div className="poll-vote-card-main">
                  <div className="poll-vote-card-text">
                    <div className="poll-vote-card-title">{optionLabel(o)}</div>
                    {(o.genre || o.notes) && (
                      <div className="poll-vote-card-sub">
                        {o.genre && <span className="genre-tag">{o.genre}</span>}
                        {o.notes && <span className="poll-tally-notes">{o.notes}</span>}
                      </div>
                    )}
                  </div>
                  {!showResults && poll.isActive && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => castVote(o.optionIndex)}
                      disabled={voting}
                    >
                      Vote
                    </button>
                  )}
                </div>
                {showResults && (
                  <>
                    <div className="poll-tally-bar">
                      <div className="poll-tally-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="poll-vote-card-count">
                      {count} {count === 1 ? 'vote' : 'votes'} · {pct}%
                      {isMyChoice && <span className="poll-your-vote"> · your vote</span>}
                    </div>
                  </>
                )}
              </li>
            )
          })}
        </ul>

        {voteError && <p className="error">{voteError}</p>}

        {showResults && (
          <p className="poll-vote-footer">
            {totalVotes} total {totalVotes === 1 ? 'vote' : 'votes'}
          </p>
        )}
      </div>
    </div>
  )
}
