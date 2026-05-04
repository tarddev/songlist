export const SONG_HEADERS = ['song', 'artist', 'genre', 'notes']

function escapeField(v) {
  const s = v == null ? '' : String(v)
  if (s === '') return ''
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function songsToCSV(rows) {
  const lines = [SONG_HEADERS.join(',')]
  for (const r of rows) {
    lines.push(SONG_HEADERS.map((h) => escapeField(r[h])).join(','))
  }
  return lines.join('\r\n') + '\r\n'
}

function parseCells(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      field += c; i++; continue
    }
    if (c === '"') { inQuotes = true; i++; continue }
    if (c === ',') { row.push(field); field = ''; i++; continue }
    if (c === '\r') { i++; continue }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue }
    field += c; i++
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows
}

export function parseSongsCSV(text) {
  if (!text) throw new Error('CSV is empty')
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)

  const cells = parseCells(text)
  if (cells.length === 0) throw new Error('CSV is empty')

  const header = cells[0].map((h) => h.trim().toLowerCase())
  const idx = SONG_HEADERS.map((h) => header.indexOf(h))
  if (idx.some((i) => i === -1)) {
    throw new Error('CSV must include columns: song, artist, genre, notes')
  }

  const out = []
  for (let r = 1; r < cells.length; r++) {
    const row = cells[r]
    if (row.length === 1 && row[0] === '') continue
    const obj = {}
    let any = false
    for (let h = 0; h < SONG_HEADERS.length; h++) {
      const v = (row[idx[h]] ?? '').trim()
      obj[SONG_HEADERS[h]] = v
      if (v) any = true
    }
    if (!any) continue
    out.push(obj)
  }
  return out
}
