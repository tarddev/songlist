import { getSupabaseAdmin } from '../lib/supabase.js'
import { signSession, buildSetCookie, getCurrentSessionEpoch } from '../lib/session.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { passcode } = req.body || {}
  if (typeof passcode !== 'string' || !passcode) {
    return res.status(400).json({ error: 'Passcode required' })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('verify_passcode', {
    input_passcode: passcode,
  })

  if (error) {
    console.error('verify_passcode error', error)
    return res.status(500).json({ error: 'Verification failed' })
  }
  if (!data) {
    return res.status(401).json({ error: 'Invalid passcode' })
  }

  let epoch
  try {
    epoch = await getCurrentSessionEpoch()
  } catch (e) {
    console.error('session epoch lookup failed', e)
    return res.status(500).json({ error: 'Verification failed' })
  }

  res.setHeader('Set-Cookie', buildSetCookie(signSession({ ok: true, epoch })))
  return res.status(200).json({ authenticated: true })
}
