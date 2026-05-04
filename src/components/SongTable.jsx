import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { useState, useMemo, Fragment } from 'react'
import Modal from './Modal'

const columnHelper = createColumnHelper()

const GENRE_COLORS = [
  ['#2a1f5e', '#a594f9'],
  ['#1f3a2a', '#4ade80'],
  ['#3a1f24', '#f87171'],
  ['#1f2e3a', '#60a5fa'],
  ['#3a2e1f', '#fb923c'],
  ['#2e1f3a', '#e879f9'],
  ['#1f3a37', '#2dd4bf'],
  ['#3a371f', '#facc15'],
]

function getGenreColor(genre) {
  let hash = 0
  for (let i = 0; i < genre.length; i++) hash = genre.charCodeAt(i) + ((hash << 5) - hash)
  return GENRE_COLORS[Math.abs(hash) % GENRE_COLORS.length]
}

const SortIcon = ({ column }) => {
  if (!column.getCanSort()) return null
  const sorted = column.getIsSorted()
  return (
    <span className={`sort-icon ${sorted ? 'sorted' : ''}`}>
      {sorted === 'asc' ? '▲' : sorted === 'desc' ? '▼' : '↕'}
    </span>
  )
}

const EMPTY_DRAFT = { song: '', artist: '', genre: '', notes: '' }

export default function SongTable({
  data,
  globalFilter,
  onGlobalFilterChange,
  editable = false,
  onSave,
  onDelete,
}) {
  const [sorting, setSorting] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [busy, setBusy] = useState(false)
  const [rowError, setRowError] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleteError, setDeleteError] = useState('')

  function startEdit(row) {
    setEditingId(row.id)
    setDraft({
      song: row.song ?? '',
      artist: row.artist ?? '',
      genre: row.genre ?? '',
      notes: row.notes ?? '',
    })
    setRowError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft(EMPTY_DRAFT)
    setRowError('')
  }

  async function saveEdit() {
    if (!onSave || editingId == null) return
    const trimmed = {
      song: draft.song.trim(),
      artist: draft.artist.trim(),
      genre: draft.genre.trim(),
      notes: draft.notes.trim(),
    }
    if (!trimmed.song && !trimmed.artist && !trimmed.genre && !trimmed.notes) {
      setRowError('At least one field must be non-empty')
      return
    }
    setBusy(true)
    setRowError('')
    try {
      await onSave(editingId, trimmed)
      setEditingId(null)
      setDraft(EMPTY_DRAFT)
    } catch (e) {
      setRowError(e.message || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  function requestDelete(row) {
    if (!onDelete) return
    setPendingDelete(row)
  }

  async function confirmDelete() {
    if (!onDelete || !pendingDelete) return
    const row = pendingDelete
    setBusy(true)
    try {
      await onDelete(row.id)
      if (editingId === row.id) cancelEdit()
      setPendingDelete(null)
    } catch (e) {
      setPendingDelete(null)
      setDeleteError(e.message || 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  const columns = useMemo(() => {
    const cols = [
      columnHelper.accessor('song', {
        header: 'Song',
        cell: (info) => <span className="song-name">{info.getValue()}</span>,
      }),
      columnHelper.accessor('artist', {
        header: 'Artist',
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor('genre', {
        header: 'Genre',
        cell: (info) => {
          const genre = info.getValue()
          if (!genre) return null
          const [bg, color] = getGenreColor(genre)
          return (
            <span className="genre-tag" style={{ background: bg, color }}>
              {genre}
            </span>
          )
        },
      }),
      columnHelper.accessor('notes', {
        header: 'Notes',
        cell: (info) => <span className="notes-cell">{info.getValue()}</span>,
        enableSorting: false,
      }),
    ]

    if (editable) {
      cols.push(
        columnHelper.display({
          id: '_actions',
          header: '',
          cell: () => null,
        }),
      )
    }

    return cols
  }, [editable])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => row.id,
  })

  const filteredCount = table.getRowModel().rows.length
  const colSpan = editable ? 5 : 4

  return (
    <>
      {globalFilter && (
        <p className="filter-summary">
          Showing {filteredCount} of {data.length} songs
        </p>
      )}
      <div className="table-wrapper">
        <table>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={header.column.getCanSort() ? 'sortable' : ''}
                    style={{ width: header.column.id === 'notes' ? '40%' : undefined }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    <SortIcon column={header.column} />
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {filteredCount > 0 ? (
              table.getRowModel().rows.map((row) => {
                const original = row.original
                const isEditing = editable && editingId === original.id

                if (isEditing) {
                  return (
                    <Fragment key={row.id}>
                      <tr className="song-row-editing">
                        {['song', 'artist', 'genre', 'notes'].map((field) => (
                          <td key={field}>
                            <input
                              type="text"
                              className="search-input song-edit-input"
                              value={draft[field] ?? ''}
                              onChange={(e) =>
                                setDraft((d) => ({ ...d, [field]: e.target.value }))
                              }
                              disabled={busy}
                              placeholder={field}
                            />
                          </td>
                        ))}
                        <td className="song-actions-cell">
                          <div className="song-actions">
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={saveEdit}
                              disabled={busy}
                            >
                              {busy ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={cancelEdit}
                              disabled={busy}
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                      {rowError && (
                        <tr>
                          <td colSpan={colSpan} className="song-row-error-cell">
                            <div className="song-row-error">{rowError}</div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                }

                return (
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => {
                      if (cell.column.id === '_actions') {
                        return (
                          <td key={cell.id} className="song-actions-cell">
                            <div className="song-actions">
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => startEdit(original)}
                                disabled={busy || editingId !== null}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm song-delete-btn"
                                onClick={() => requestDelete(original)}
                                disabled={busy || editingId !== null}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        )
                      }
                      return (
                        <td key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={colSpan} className="no-results">
                  No songs match &ldquo;{globalFilter}&rdquo;
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={pendingDelete !== null}
        title="Delete song?"
        message={
          pendingDelete
            ? `Delete "${pendingDelete.song || pendingDelete.artist || 'this song'}"? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <Modal
        open={Boolean(deleteError)}
        title="Delete failed"
        message={deleteError}
        confirmLabel="OK"
        onConfirm={() => setDeleteError('')}
      />
    </>
  )
}
