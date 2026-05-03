import { useState, useMemo, useEffect } from 'react'
import Papa from 'papaparse'
import SongTable from './components/SongTable'
import songsCsv from './songs.csv?raw'
import './App.css'

export default function App() {
  const [globalFilter, setGlobalFilter] = useState('')
  const [view, setView] = useState('table')
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const data = useMemo(() => {
    const result = Papa.parse(songsCsv.trim(), {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    })
    return result.data
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
      const res = await fetch('/api/login', {
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
    await fetch('/api/logout', { method: 'POST' })
    setView('table')
  }

  if (view === 'authenticated') {
    return (
      <div className="app">
        <div className="auth-splash">
          <div className="auth-splash-icon">✓</div>
          <h1>I am authenticated</h1>
          <p>Passcode verified server-side and signed session cookie set.</p>
          <button className="btn btn-secondary" onClick={handleLogout}>
            Log out
          </button>
        </div>
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
            <span className="record-count">{data.length} songs</span>
          </div>

          <SongTable data={data} globalFilter={globalFilter} onGlobalFilterChange={setGlobalFilter} />
        </div>
      </main>
    </div>
  )
}
