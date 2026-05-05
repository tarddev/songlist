import { useState } from 'react'

const EMPTY = { song: '', artist: '', genre: '', mood: '', language: '' }

export default function SongCreator({ onCreate }) {
  const [open, setOpen] = useState(false)
  const [fields, setFields] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function update(field, value) {
    setFields((prev) => ({ ...prev, [field]: value }))
  }

  function reset() {
    setFields(EMPTY)
    setError('')
  }

  function close() {
    setOpen(false)
    reset()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = {
      song: fields.song.trim(),
      artist: fields.artist.trim(),
      genre: fields.genre.trim(),
      mood: fields.mood.trim(),
      language: fields.language.trim(),
    }
    if (!trimmed.song && !trimmed.artist && !trimmed.genre && !trimmed.mood && !trimmed.language) {
      setError('At least one field must be non-empty')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await onCreate(trimmed)
      close()
    } catch (err) {
      setError(err.message || 'Failed to create song')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-primary btn-sm song-add-toggle"
        onClick={() => setOpen(true)}
      >
        + Add song
      </button>
    )
  }

  return (
    <form className="song-creator" onSubmit={handleSubmit}>
      <div className="song-creator-grid">
        <input
          type="text"
          className="search-input"
          placeholder="Song"
          value={fields.song}
          onChange={(e) => update('song', e.target.value)}
          disabled={submitting}
          autoFocus
        />
        <input
          type="text"
          className="search-input"
          placeholder="Artist"
          value={fields.artist}
          onChange={(e) => update('artist', e.target.value)}
          disabled={submitting}
        />
        <input
          type="text"
          className="search-input"
          placeholder="Genre"
          value={fields.genre}
          onChange={(e) => update('genre', e.target.value)}
          disabled={submitting}
        />
        <input
          type="text"
          className="search-input"
          placeholder="Mood"
          value={fields.mood}
          onChange={(e) => update('mood', e.target.value)}
          disabled={submitting}
        />
        <input
          type="text"
          className="search-input"
          placeholder="Language"
          value={fields.language}
          onChange={(e) => update('language', e.target.value)}
          disabled={submitting}
        />
      </div>
      {error && <p className="error song-creator-error">{error}</p>}
      <div className="song-creator-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={close}
          disabled={submitting}
        >
          Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
          {submitting ? 'Adding…' : 'Add song'}
        </button>
      </div>
    </form>
  )
}
