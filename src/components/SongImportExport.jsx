import { useRef, useState } from 'react'
import Modal from './Modal'
import { parseSongsCSV, songsToCSV } from '../lib/csv'

export default function SongImportExport({ data, onReplace }) {
  const fileRef = useRef(null)
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function triggerExport() {
    const csv = songsToCSV(data)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `songs-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function triggerImport() {
    fileRef.current?.click()
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const rows = parseSongsCSV(text)
      if (rows.length === 0) {
        setError('CSV has no data rows')
        return
      }
      setPending({ rows, fileName: file.name })
    } catch (err) {
      setError(err.message || 'Failed to read CSV')
    }
  }

  async function confirmImport() {
    if (!pending) return
    setBusy(true)
    try {
      await onReplace(pending.rows)
      setPending(null)
    } catch (err) {
      setPending(null)
      setError(err.message || 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="song-io">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={triggerExport}
        disabled={data.length === 0}
      >
        Export CSV
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={triggerImport}
      >
        Import CSV
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <Modal
        open={pending !== null}
        title="Replace all songs?"
        message={
          pending
            ? `Import "${pending.fileName}" with ${pending.rows.length} row${pending.rows.length === 1 ? '' : 's'}? This will delete all ${data.length} current song${data.length === 1 ? '' : 's'} and cannot be undone.`
            : ''
        }
        confirmLabel="Replace all"
        cancelLabel="Cancel"
        variant="danger"
        busy={busy}
        onConfirm={confirmImport}
        onCancel={() => setPending(null)}
      />

      <Modal
        open={Boolean(error)}
        title="Import error"
        message={error}
        confirmLabel="OK"
        onConfirm={() => setError('')}
      />
    </div>
  )
}
