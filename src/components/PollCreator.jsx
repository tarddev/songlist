import { useState } from 'react'

const EMPTY_OPTION = { song: '', artist: '', genre: '', notes: '' }

const CLOSES_PRESETS = [
  { label: '+1h',  ms: 60 * 60 * 1000 },
  { label: '+6h',  ms: 6 * 60 * 60 * 1000 },
  { label: '+24h', ms: 24 * 60 * 60 * 1000 },
  { label: '+7d',  ms: 7 * 24 * 60 * 60 * 1000 },
  { label: '+30d',  ms: 30 * 24 * 60 * 60 * 1000 },
]

function toLocalInputValue(date) {
  const tzOffset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16)
}

export default function PollCreator({ onCreated }) {
  const [question, setQuestion] = useState('What should Lumi sing next?')
  const [options, setOptions] = useState([{ ...EMPTY_OPTION }, { ...EMPTY_OPTION }])
  const [closesAt, setClosesAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function updateOption(i, field, value) {
    setOptions((prev) => {
      const next = prev.slice()
      next[i] = { ...next[i], [field]: value }
      return next
    })
  }

  function addOption() {
    setOptions((prev) => (prev.length >= 20 ? prev : [...prev, { ...EMPTY_OPTION }]))
  }

  function removeOption(i) {
    setOptions((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)))
  }

  function applyPreset(ms) {
    setClosesAt(toLocalInputValue(new Date(Date.now() + ms)))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!question.trim()) {
      setError('Question is required')
      return
    }

    const cleaned = options.map((o) => ({
      song: o.song.trim(),
      artist: o.artist.trim(),
      genre: o.genre.trim(),
      notes: o.notes.trim(),
    }))
    const empty = cleaned.findIndex((o) => !o.song && !o.artist && !o.genre && !o.notes)
    if (empty !== -1) {
      setError(`Option ${empty + 1} needs at least one field`)
      return
    }

    let closesAtIso = null
    if (closesAt) {
      const t = new Date(closesAt)
      if (Number.isNaN(t.getTime())) {
        setError('Invalid close time')
        return
      }
      if (t.getTime() <= Date.now()) {
        setError('Close time must be in the future')
        return
      }
      closesAtIso = t.toISOString()
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/polls/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim(), options: cleaned, closesAt: closesAtIso }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error || 'Failed to create poll')
        return
      }
      onCreated?.(body.id)
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="poll-creator" onSubmit={handleSubmit}>
      <h2>Create a poll</h2>

      <label className="poll-field">
        <span>Question</span>
        <input
          type="text"
          className="search-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What should Lumi sing next?"
          maxLength={500}
          disabled={submitting}
        />
      </label>

      <div className="poll-options">
        {options.map((opt, i) => (
          <div key={i} className="poll-option-card">
            <div className="poll-option-header">
              <span>Option {i + 1}</span>
              {options.length > 2 && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => removeOption(i)}
                  disabled={submitting}
                >
                  Remove
                </button>
              )}
            </div>
            <div className="poll-option-grid">
              <input
                type="text"
                className="search-input"
                placeholder="Song"
                value={opt.song}
                onChange={(e) => updateOption(i, 'song', e.target.value)}
                disabled={submitting}
              />
              <input
                type="text"
                className="search-input"
                placeholder="Artist"
                value={opt.artist}
                onChange={(e) => updateOption(i, 'artist', e.target.value)}
                disabled={submitting}
              />
              <input
                type="text"
                className="search-input"
                placeholder="Genre"
                value={opt.genre}
                onChange={(e) => updateOption(i, 'genre', e.target.value)}
                disabled={submitting}
              />
              <input
                type="text"
                className="search-input"
                placeholder="Notes"
                value={opt.notes}
                onChange={(e) => updateOption(i, 'notes', e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={addOption}
          disabled={submitting || options.length >= 20}
        >
          + Add option
        </button>
      </div>

      <label className="poll-field">
        <span>Closes at <small>(optional)</small></span>
        <div className="poll-closes-row">
          <input
            type="datetime-local"
            className="search-input"
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
            disabled={submitting}
          />
          <div className="poll-presets">
            {CLOSES_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => applyPreset(p.ms)}
                disabled={submitting}
              >
                {p.label}
              </button>
            ))}
            {closesAt && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setClosesAt('')}
                disabled={submitting}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </label>

      {error && <p className="error">{error}</p>}

      <button type="submit" className="btn btn-primary" disabled={submitting}>
        {submitting ? 'Creating…' : 'Create poll'}
      </button>
    </form>
  )
}
