import { getSupabaseAdmin } from '../../lib/supabase.js'
import { readSessionFromCookies } from '../../lib/session.js'
import { fetchPollWithOptions, fetchTallies } from '../../lib/polls.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = await readSessionFromCookies(req.headers.cookie)
  if (!session) return res.status(401).json({ error: 'Not authenticated' })

  const supabase = getSupabaseAdmin()
  const { data: row, error } = await supabase
    .from('polls')
    .select('id')
    .is('closed_at', null)
    .maybeSingle()

  if (error) {
    console.error('active poll lookup error', error)
    return res.status(500).json({ error: 'Failed to load active poll' })
  }
  if (!row) return res.status(200).json({ active: null })

  try {
    const poll = await fetchPollWithOptions(row.id)
    if (!poll || !poll.isActive) return res.status(200).json({ active: null })
    const tallies = await fetchTallies(poll.id)
    return res.status(200).json({ active: { ...poll, tallies } })
  } catch (e) {
    console.error('active poll fetch error', e)
    return res.status(500).json({ error: 'Failed to load active poll' })
  }
}
