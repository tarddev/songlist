import { getSupabaseAdmin } from '../../lib/supabase.js'
import { readSessionFromCookies } from '../../lib/session.js'

const FIELDS = ['song', 'artist', 'genre', 'notes']
const MAX_FIELD_LEN = 500

function normalizeField(v) {
  if (typeof v !== 'string') return undefined
  const trimmed = v.trim()
  return trimmed === '' ? null : trimmed
}

export default async function handler(req, res) {
  const session = await readSessionFromCookies(req.headers.cookie)
  if (!session) return res.status(401).json({ error: 'Not authenticated' })

  const id = req.query?.id
  if (typeof id !== 'string' || !id) {
    return res.status(400).json({ error: 'Missing song id' })
  }

  const supabase = getSupabaseAdmin()

  if (req.method === 'DELETE') {
    const { data, error } = await supabase
      .from('songs')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle()
    if (error) {
      console.error('songs delete error', error)
      return res.status(500).json({ error: 'Failed to delete song' })
    }
    if (!data) return res.status(404).json({ error: 'Song not found' })
    return res.status(200).json({ deleted: true, id: data.id })
  }

  if (req.method === 'PATCH') {
    const body = req.body || {}
    const update = {}
    for (const f of FIELDS) {
      if (!(f in body)) continue
      if (typeof body[f] !== 'string') {
        return res.status(400).json({ error: `${f} must be a string` })
      }
      if (body[f].length > MAX_FIELD_LEN) {
        return res.status(400).json({ error: `${f} exceeds ${MAX_FIELD_LEN} chars` })
      }
      update[f] = normalizeField(body[f])
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }

    const { data, error } = await supabase
      .from('songs')
      .update(update)
      .eq('id', id)
      .select('id, song, artist, genre, notes, added_at')
      .maybeSingle()

    if (error) {
      if (error.code === '23514') {
        return res.status(400).json({ error: 'At least one field must be non-empty' })
      }
      console.error('songs update error', error)
      return res.status(500).json({ error: 'Failed to update song' })
    }
    if (!data) return res.status(404).json({ error: 'Song not found' })

    return res.status(200).json({
      song: {
        id: data.id,
        song: data.song ?? '',
        artist: data.artist ?? '',
        genre: data.genre ?? '',
        notes: data.notes ?? '',
        added_at: data.added_at,
      },
    })
  }

  res.setHeader('Allow', 'PATCH, DELETE')
  return res.status(405).json({ error: 'Method not allowed' })
}
