import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { useState, useMemo } from 'react'

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

export default function SongTable({ data, globalFilter, onGlobalFilterChange }) {
  const [sorting, setSorting] = useState([])

  const columns = useMemo(
    () => [
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
    ],
    [],
  )

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const filteredCount = table.getRowModel().rows.length

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
              table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="no-results">
                  No songs match &ldquo;{globalFilter}&rdquo;
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
