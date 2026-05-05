import { useState, useEffect, useCallback } from 'react'
import SongTable from './components/SongTable'
import SongCreator from './components/SongCreator'
import SongImportExport from './components/SongImportExport'
import PollCreator from './components/PollCreator'
import PollDashboard from './components/PollDashboard'
import PollVoteView from './components/PollVoteView'
import './App.css'

export default function App() {
  const path = typeof window !== 'undefined' ? window.location.pathname : '/'
  if (path.startsWith('/poll/')) {
    const id = decodeURIComponent(path.slice('/poll/'.length).replace(/\/$/, ''))
    if (id) return <PollVoteView id={id} />
  }
  return <AppShell />
}

function AppShell() {
  const [globalFilter, setGlobalFilter] = useState('')
  const [view, setView] = useState('table')
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [data, setData] = useState([])
  const [songsLoading, setSongsLoading] = useState(true)
  const [songsError, setSongsError] = useState('')
  const [activePoll, setActivePoll] = useState(null)
  const [activePollLoading, setActivePollLoading] = useState(false)
  const [activePollError, setActivePollError] = useState('')

  const refreshActivePoll = useCallback(async () => {
    setActivePollLoading(true)
    setActivePollError('')
    try {
      const res = await fetch('/api/polls/active')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to load active poll')
      }
      const body = await res.json()
      setActivePoll(body.active || null)
    } catch (e) {
      setActivePollError(e.message || 'Failed to load active poll')
    } finally {
      setActivePollLoading(false)
    }
  }, [])

  useEffect(() => {
    if (view === 'authenticated') refreshActivePoll()
  }, [view, refreshActivePoll])

  useEffect(() => {
    fetch('/api/songs')
      .then(async (r) => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(body.error || 'Failed to load songs')
        return body
      })
      .then((body) => setData(body.songs || []))
      .catch((e) => setSongsError(e.message || 'Failed to load songs'))
      .finally(() => setSongsLoading(false))
  }, [])

  const handleSongSave = useCallback(async (id, fields) => {
    const res = await fetch(`/api/songs/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || 'Failed to save song')
    setData((prev) => prev.map((s) => (s.id === id ? body.song : s)))
  }, [])

  const handleSongDelete = useCallback(async (id) => {
    const res = await fetch(`/api/songs/${encodeURIComponent(id)}`, { method: 'DELETE' })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || 'Failed to delete song')
    setData((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const handleSongCreate = useCallback(async (fields) => {
    const res = await fetch('/api/songs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || 'Failed to create song')
    setData((prev) => [body.song, ...prev])
  }, [])

  const handleSongsReplace = useCallback(async (rows) => {
    const res = await fetch('/api/songs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songs: rows }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || 'Failed to import songs')
    setData(body.songs || [])
  }, [])

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.authenticated) setView('authenticated') })
      .catch(() => {})
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      })
      const body = await res.json()
      if (res.ok && body.authenticated) {
        setPasscode('')
        setView('authenticated')
      } else {
        setError(body.error || 'Login failed')
      }
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' })
    setView('table')
  }

  if (view === 'authenticated') {
    return (
      <div className="app">
        <header>
          <button className="btn btn-secondary login-btn" onClick={handleLogout}>
            Log out
          </button>
          <h1>Lemon's Song List</h1>
        </header>
        <main>
          {activePollLoading && !activePoll ? (
            <p className="poll-loading">Loading poll state…</p>
          ) : activePollError ? (
            <p className="error">{activePollError}</p>
          ) : activePoll ? (
            <PollDashboard
              poll={activePoll}
              onClosed={() => { setActivePoll(null); refreshActivePoll() }}
            />
          ) : (
            <PollCreator onCreated={() => refreshActivePoll()} />
          )}

          <section className="songs-manage">
            <div className="songs-manage-header">
              <h2>Manage songs</h2>
              <span className="record-count">
                {songsLoading ? 'Loading…' : `${data.length} songs`}
              </span>
            </div>
            <SongCreator onCreate={handleSongCreate} />
            <SongImportExport data={data} onReplace={handleSongsReplace} />
            <div className="table-controls">
              <div className="search-wrapper">
                <span className="search-icon">⌕</span>
                <input
                  type="search"
                  placeholder="Search songs, artists, genres, moods, languages…"
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  className="search-input"
                />
              </div>
            </div>
            {songsError ? (
              <p className="error">{songsError}</p>
            ) : (
              <SongTable
                data={data}
                globalFilter={globalFilter}
                onGlobalFilterChange={setGlobalFilter}
                editable
                onSave={handleSongSave}
                onDelete={handleSongDelete}
              />
            )}
          </section>
        </main>
      </div>
    )
  }

  if (view === 'login') {
    return (
      <div className="app">
        <div className="auth-splash">
          <h1>Enter passcode</h1>
          <form onSubmit={handleLogin} className="login-form">
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Passcode"
              autoFocus
              className="search-input"
              disabled={submitting}
            />
            {error && <p className="error">{error}</p>}
            <div className="login-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setView('table'); setError(''); setPasscode('') }}
                disabled={submitting}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting || !passcode}>
                {submitting ? 'Checking…' : 'Log in'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header>
        <button
          className="btn btn-primary login-btn"
          onClick={() => setView('login')}
        >
          Log in
        </button>
        <h1>Lemon's Song List</h1>
      </header>

      <main>
        <div className="table-area">
          <div className="table-controls">
            <div className="search-wrapper">
              <span className="search-icon">⌕</span>
              <input
                type="search"
                placeholder="Search songs, artists, genres…"
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="search-input"
                autoFocus
              />
            </div>
            <span className="record-count">
              {songsLoading ? 'Loading…' : `${data.length} songs`}
            </span>
          </div>

          {songsError ? (
            <p className="error">{songsError}</p>
          ) : (
            <SongTable data={data} globalFilter={globalFilter} onGlobalFilterChange={setGlobalFilter} />
          )}
        </div>
      </main>
    </div>
  )
}
