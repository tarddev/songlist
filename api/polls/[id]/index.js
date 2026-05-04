import { fetchPollWithOptions } from '../../../lib/polls.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const id = req.query?.id
  if (typeof id !== 'string' || !id) {
    return res.status(400).json({ error: 'Missing poll id' })
  }

  try {
    const poll = await fetchPollWithOptions(id)
    if (!poll) return res.status(404).json({ error: 'Poll not found' })
    return res.status(200).json(poll)
  } catch (e) {
    console.error('poll fetch error', e)
    return res.status(500).json({ error: 'Failed to load poll' })
  }
}
