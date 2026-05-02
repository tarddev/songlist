import { useState, useMemo } from 'react'
import Papa from 'papaparse'
import SongTable from './components/SongTable'
import songsCsv from './songs.csv?raw'
import './App.css'

export default function App() {
  const [globalFilter, setGlobalFilter] = useState('')

  const data = useMemo(() => {
    const result = Papa.parse(songsCsv.trim(), {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    })
    return result.data
  }, [])

  return (
    <div className="app">
      <header>
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
