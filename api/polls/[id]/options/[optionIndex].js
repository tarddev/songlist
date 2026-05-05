import { getSupabaseAdmin } from '../../../../lib/supabase.js'
import { readSessionFromCookies } from '../../../../lib/session.js'

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = await readSessionFromCookies(req.headers.cookie)
  if (!session) return res.status(401).json({ error: 'Not authenticated' })

  const id = req.query?.id
  if (typeof id !== 'string' || !id) {
    return res.status(400).json({ error: 'Missing poll id' })
  }

  const optionIndex = Number(req.query?.optionIndex)
  if (!Number.isInteger(optionIndex) || optionIndex < 1) {
    return res.status(400).json({ error: 'Invalid optionIndex' })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('delete_poll_option', {
    p_poll_id:      id,
    p_option_index: optionIndex,
  })

  if (error) {
    console.error('delete_poll_option error', error)
    return res.status(500).json({ error: 'Failed to delete option' })
  }

  if (data === 'not_found') return res.status(404).json({ error: 'Option not found' })

  return res.status(200).json({ ok: true })
}
