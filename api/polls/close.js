import { getSupabaseAdmin } from '../../lib/supabase.js'
import { readSessionFromCookies } from '../../lib/session.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = await readSessionFromCookies(req.headers.cookie)
  if (!session) return res.status(401).json({ error: 'Not authenticated' })

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('close_active_poll')

  if (error) {
    console.error('close_active_poll error', error)
    return res.status(500).json({ error: 'Failed to close poll' })
  }
  if (!data) {
    return res.status(404).json({ error: 'No active poll' })
  }

  return res.status(200).json({ id: data, closed: true })
}
