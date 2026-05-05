import { getSupabaseAdmin } from '../../lib/supabase.js'
import { readSessionFromCookies } from '../../lib/session.js'

const MAX_QUESTION_LEN = 500
const MAX_OPTIONS = 20
const MIN_OPTIONS = 2
const MAX_CLOSES_AT_DAYS = 30

function isNonEmpty(v) {
  return typeof v === 'string' && v.trim().length > 0
}

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

  const session = await readSessionFromCookies(req.headers.cookie)
  if (!session) return res.status(401).json({ error: 'Not authenticated' })

  const { question, options, closesAt } = req.body || {}

  if (!isNonEmpty(question) || question.length > MAX_QUESTION_LEN) {
    return res.status(400).json({ error: 'Question is required (1-500 chars)' })
  }

  if (!Array.isArray(options) || options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) {
    return res.status(400).json({ error: `Provide between ${MIN_OPTIONS} and ${MAX_OPTIONS} options` })
  }

  const normalized = []
  for (let i = 0; i < options.length; i++) {
    const n = normalizeOption(options[i])
    if (!n) return res.status(400).json({ error: `Option ${i + 1} must have at least one non-empty field` })
    normalized.push(n)
  }

  let closesAtIso = null
  if (closesAt !== undefined && closesAt !== null && closesAt !== '') {
    const t = new Date(closesAt)
    if (Number.isNaN(t.getTime())) {
      return res.status(400).json({ error: 'closesAt is not a valid date' })
    }
    if (t.getTime() <= Date.now()) {
      return res.status(400).json({ error: 'closesAt must be in the future' })
    }
    const maxMs = Date.now() + MAX_CLOSES_AT_DAYS * 24 * 60 * 60 * 1000
    if (t.getTime() > maxMs) {
      return res.status(400).json({ error: `closesAt cannot be more than ${MAX_CLOSES_AT_DAYS} days out` })
    }
    closesAtIso = t.toISOString()
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('create_poll', {
    p_question: question.trim(),
    p_options: normalized,
    p_closes_at: closesAtIso,
  })

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'An active poll already exists' })
    }
    console.error('create_poll error', error)
    return res.status(500).json({ error: 'Failed to create poll' })
  }

  return res.status(200).json({ id: data, shareUrl: `/poll/${data}` })
}
