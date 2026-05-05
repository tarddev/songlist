import { useEffect, useMemo, useState } from 'react'

const VOTED_PREFIX = 'poll_voted:'
const NOMINATED_PREFIX = 'poll_nominated:'

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

function writeNominatedCookie(pollId) {
  if (typeof document === 'undefined') return
  const days = 7
  const expires = new Date(Date.now() + days * 86400_000).toUTCString()
  document.cookie = `${NOMINATED_PREFIX}${pollId}=1; expires=${expires}; path=/; SameSite=Lax`
}

function optionLabel(o) {
  const parts = [o.song, o.artist].filter(Boolean)
  if (parts.length) return parts.join(' — ')
  return o.genre || o.mood || o.language || `Option ${o.optionIndex}`
}

function emptyForm() {
  return { song: '', artist: '', genre: '', mood: '', language: '' }
}

export default function PollVoteView({ id }) {
  const [poll, setPoll] = useState(null)
  const [tallies, setTallies] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState(false)
  const [voteError, setVoteError] = useState('')
  const [votedFor, setVotedFor] = useState(() => readVotedCookie(id))
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Nominate form state
  const [nominateOpen, setNominateOpen] = useState(false)
  const [nominateForm, setNominateForm] = useState(emptyForm)
  const [nominating, setNominating] = useState(false)
  const [nominateError, setNominateError] = useState('')
  const [nominateSuccess, setNominateSuccess] = useState('')

  // Remove state
  const [removing, setRemoving] = useState(null) // optionIndex being removed

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((b) => setIsAuthenticated(Boolean(b.authenticated)))
      .catch(() => {})
  }, [])

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

  const nominationCount = useMemo(() => {
    if (!poll) return 0
    return poll.options.filter((o) => o.nominatedAt != null).length
  }, [poll])

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

  async function submitNomination(e) {
    e.preventDefault()
    setNominating(true)
    setNominateError('')
    setNominateSuccess('')
    try {
      const res = await fetch(`/api/polls/${encodeURIComponent(id)}/nominate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nominateForm),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 410) setPoll((p) => p ? { ...p, isActive: false } : p)
        setNominateError(body.error || 'Failed to nominate')
        return
      }
      const { optionIndex, nominatedAt } = body
      const newOption = { ...nominateForm, optionIndex, nominatedAt }
      setPoll((p) => p ? { ...p, options: [...p.options, newOption] } : p)
      writeNominatedCookie(id)
      setNominateForm(emptyForm())
      setNominateOpen(false)
      setNominateSuccess('Nomination added!')
      setTimeout(() => setNominateSuccess(''), 3000)
    } catch {
      setNominateError('Network error')
    } finally {
      setNominating(false)
    }
  }

  async function removeOption(optionIndex) {
    setRemoving(optionIndex)
    try {
      const res = await fetch(
        `/api/polls/${encodeURIComponent(id)}/options/${optionIndex}`,
        { method: 'DELETE' },
      )
      if (!res.ok) return
      setPoll((p) => {
        if (!p) return p
        return { ...p, options: p.options.filter((o) => o.optionIndex !== optionIndex) }
      })
      if (votedFor === optionIndex) {
        setVotedFor(null)
        if (typeof document !== 'undefined') {
          document.cookie = `${VOTED_PREFIX}${id}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
        }
      }
    } catch { /* ignore */ } finally {
      setRemoving(null)
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

  const canNominate = poll.isActive && nominationCount < 10

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
                    <div className="poll-vote-card-title">
                      {optionLabel(o)}
                      {o.nominatedAt && <span className="nomination-badge">nominated</span>}
                    </div>
                    {(o.genre || o.mood || o.language) && (
                      <div className="poll-vote-card-sub">
                        {o.genre && <span className="genre-tag">{o.genre}</span>}
                        {o.mood && <span className="poll-tally-meta">{o.mood}</span>}
                        {o.language && <span className="poll-tally-meta">{o.language}</span>}
                      </div>
                    )}
                  </div>
                  <div className="poll-vote-card-actions">
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
                    {isAuthenticated && (
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => removeOption(o.optionIndex)}
                        disabled={removing === o.optionIndex}
                      >
                        {removing === o.optionIndex ? '…' : 'Remove'}
                      </button>
                    )}
                  </div>
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
        {nominateSuccess && <p className="success-msg">{nominateSuccess}</p>}

        {showResults && (
          <p className="poll-vote-footer">
            {totalVotes} total {totalVotes === 1 ? 'vote' : 'votes'}
          </p>
        )}

        {poll.isActive && nominationCount >= 10 && (
          <p className="nominations-full">Nominations full (10/10)</p>
        )}

        {canNominate && (
          <div className="nominate-section">
            <button
              type="button"
              className="btn btn-secondary nominate-toggle"
              onClick={() => { setNominateOpen((v) => !v); setNominateError('') }}
            >
              {nominateOpen ? 'Cancel' : 'Nominate a choice'}
            </button>

            {nominateOpen && (
              <form className="nominate-form" onSubmit={submitNomination}>
                <div className="creator-grid">
                  {['song', 'artist', 'genre', 'mood', 'language'].map((field) => (
                    <input
                      key={field}
                      type="text"
                      className="search-input"
                      placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                      value={nominateForm[field]}
                      onChange={(e) => setNominateForm((f) => ({ ...f, [field]: e.target.value }))}
                    />
                  ))}
                </div>
                {nominateError && <p className="error">{nominateError}</p>}
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={nominating}
                >
                  {nominating ? 'Nominating…' : 'Submit nomination'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
