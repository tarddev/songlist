import { getSupabaseAdmin } from '../../../lib/supabase.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const id = req.query?.id
  if (typeof id !== 'string' || !id) {
    return res.status(400).json({ error: 'Missing poll id' })
  }

  const { optionIndex } = req.body || {}
  const idx = Number(optionIndex)
  if (!Number.isInteger(idx) || idx < 1) {
    return res.status(400).json({ error: 'optionIndex must be a positive integer' })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('cast_vote', {
    p_poll_id: id,
    p_option_index: idx,
  })

  if (error) {
    console.error('cast_vote error', error)
    return res.status(500).json({ error: 'Failed to record vote' })
  }

  switch (data) {
    case 'ok':         return res.status(200).json({ ok: true })
    case 'not_found':  return res.status(404).json({ error: 'Poll not found' })
    case 'closed':     return res.status(410).json({ error: 'Poll is closed' })
    case 'bad_option': return res.status(400).json({ error: 'Invalid optionIndex' })
    default:
      console.error('cast_vote unexpected status', data)
      return res.status(500).json({ error: 'Failed to record vote' })
  }
}
