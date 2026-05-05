import { getSupabaseAdmin } from '../../lib/supabase.js'
import { readSessionFromCookies } from '../../lib/session.js'

const FIELDS = ['song', 'artist', 'genre', 'mood', 'language']
const MAX_FIELD_LEN = 500
const MAX_IMPORT_ROWS = 5000

function normalizeField(v) {
  if (typeof v !== 'string') return undefined
  const trimmed = v.trim()
  return trimmed === '' ? null : trimmed
}

export default async function handler(req, res) {
  const supabase = getSupabaseAdmin()

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('songs')
      .select('id, song, artist, genre, mood, language, added_at')
      .order('added_at', { ascending: false })

    if (error) {
      console.error('songs fetch error', error)
      return res.status(500).json({ error: 'Failed to load songs' })
    }

    const songs = (data || []).map((row) => ({
      id: row.id,
      song: row.song ?? '',
      artist: row.artist ?? '',
      genre: row.genre ?? '',
      mood: row.mood ?? '',
      language: row.language ?? '',
      added_at: row.added_at,
    }))

    return res.status(200).json({ songs })
  }

  if (req.method === 'POST') {
    const session = await readSessionFromCookies(req.headers.cookie)
    if (!session) return res.status(401).json({ error: 'Not authenticated' })

    const body = req.body || {}
    const insert = {}
    for (const f of FIELDS) {
      if (!(f in body)) continue
      if (typeof body[f] !== 'string') {
        return res.status(400).json({ error: `${f} must be a string` })
      }
      if (body[f].length > MAX_FIELD_LEN) {
        return res.status(400).json({ error: `${f} exceeds ${MAX_FIELD_LEN} chars` })
      }
      insert[f] = normalizeField(body[f])
    }

    if (FIELDS.every((f) => !insert[f])) {
      return res.status(400).json({ error: 'At least one field must be non-empty' })
    }

    const { data, error } = await supabase
      .from('songs')
      .insert(insert)
      .select('id, song, artist, genre, mood, language, added_at')
      .maybeSingle()

    if (error) {
      if (error.code === '23514') {
        return res.status(400).json({ error: 'At least one field must be non-empty' })
      }
      console.error('songs insert error', error)
      return res.status(500).json({ error: 'Failed to create song' })
    }

    return res.status(201).json({
      song: {
        id: data.id,
        song: data.song ?? '',
        artist: data.artist ?? '',
        genre: data.genre ?? '',
        mood: data.mood ?? '',
        language: data.language ?? '',
        added_at: data.added_at,
      },
    })
  }

  if (req.method === 'PUT') {
    const session = await readSessionFromCookies(req.headers.cookie)
    if (!session) return res.status(401).json({ error: 'Not authenticated' })

    const body = req.body || {}
    if (!Array.isArray(body.songs)) {
      return res.status(400).json({ error: 'songs must be an array' })
    }
    if (body.songs.length > MAX_IMPORT_ROWS) {
      return res.status(400).json({ error: `Too many rows (max ${MAX_IMPORT_ROWS})` })
    }

    const inserts = []
    for (let i = 0; i < body.songs.length; i++) {
      const item = body.songs[i]
      if (!item || typeof item !== 'object') {
        return res.status(400).json({ error: `Row ${i + 1}: must be an object` })
      }
      const insert = {}
      let any = false
      for (const f of FIELDS) {
        const raw = item[f]
        if (raw == null) { insert[f] = null; continue }
        if (typeof raw !== 'string') {
          return res.status(400).json({ error: `Row ${i + 1}: ${f} must be a string` })
        }
        if (raw.length > MAX_FIELD_LEN) {
          return res.status(400).json({ error: `Row ${i + 1}: ${f} exceeds ${MAX_FIELD_LEN} chars` })
        }
        insert[f] = normalizeField(raw) ?? null
        if (insert[f]) any = true
      }
      if (!any) continue
      inserts.push(insert)
    }

    const { error: delErr } = await supabase
      .from('songs')
      .delete()
      .gte('added_at', '1900-01-01')
    if (delErr) {
      console.error('songs replace delete error', delErr)
      return res.status(500).json({ error: 'Failed to clear existing songs' })
    }

    let inserted = []
    if (inserts.length) {
      const { data, error: insErr } = await supabase
        .from('songs')
        .insert(inserts)
        .select('id, song, artist, genre, mood, language, added_at')
      if (insErr) {
        console.error('songs replace insert error', insErr)
        return res.status(500).json({ error: 'Failed to import songs' })
      }
      inserted = data || []
    }

    const songs = inserted
      .map((row) => ({
        id: row.id,
        song: row.song ?? '',
        artist: row.artist ?? '',
        genre: row.genre ?? '',
        mood: row.mood ?? '',
        language: row.language ?? '',
        added_at: row.added_at,
      }))
      .sort((a, b) => (a.added_at < b.added_at ? 1 : -1))

    return res.status(200).json({ songs })
  }

  res.setHeader('Allow', 'GET, POST, PUT')
  return res.status(405).json({ error: 'Method not allowed' })
}
