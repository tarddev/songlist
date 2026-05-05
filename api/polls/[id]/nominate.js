import { getSupabaseAdmin } from '../../../lib/supabase.js'

function normalizeOption(opt) {
  if (!opt || typeof opt !== 'object') return null
  const out = {
    song:     typeof opt.song     === 'string' ? opt.song.trim()     : '',
    artist:   typeof opt.artist   === 'string' ? opt.artist.trim()   : '',
    genre:    typeof opt.genre    === 'string' ? opt.genre.trim()    : '',
    mood:     typeof opt.mood     === 'string' ? opt.mood.trim()     : '',
    language: typeof opt.language === 'string' ? opt.language.trim() : '',
  }
  if (!out.song && !out.artist && !out.genre && !out.mood && !out.language) return null
  return out
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const id = req.query?.id
  if (typeof id !== 'string' || !id) {
    return res.status(400).json({ error: 'Missing poll id' })
  }

  const opt = normalizeOption(req.body)
  if (!opt) {
    return res.status(400).json({ error: 'At least one field (song, artist, genre, mood, language) is required' })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('nominate_option', {
    p_poll_id:  id,
    p_song:     opt.song,
    p_artist:   opt.artist,
    p_genre:    opt.genre,
    p_mood:     opt.mood,
    p_language: opt.language,
  })

  if (error) {
    console.error('nominate_option error', error)
    return res.status(500).json({ error: 'Failed to nominate' })
  }

  if (data === 'not_found') return res.status(404).json({ error: 'Poll not found' })
  if (data === 'closed')    return res.status(410).json({ error: 'Poll is closed' })
  if (data === 'limit_reached') return res.status(409).json({ error: 'Nominations are full (10/10)' })

  // data is 'ok:<optionIndex>'
  const optionIndex = Number(data.split(':')[1])
  const nominatedAt = new Date().toISOString()

  return res.status(200).json({ optionIndex, nominatedAt })
}
